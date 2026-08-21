import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { io as ioClient } from "socket.io-client";
import { createServer, normalizeCode } from "./createServer.js";

describe("normalizeCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeCode("  team1  ")).toBe("TEAM1");
  });

  it("returns an empty string for nullish input", () => {
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode(undefined)).toBe("");
  });
});

describe("server", () => {
  let httpServer;
  let url;
  const clients = [];

  beforeAll(async () => {
    ({ httpServer } = createServer());
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address();
    url = `http://localhost:${port}`;
  });

  afterAll(() => {
    httpServer.close();
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.close();
  });

  function connect() {
    const client = ioClient(url, { reconnection: false, transports: ["websocket"] });
    clients.push(client);
    return new Promise((resolve, reject) => {
      client.once("connect", () => resolve(client));
      client.once("connect_error", reject);
    });
  }

  function emitAsync(client, event, payload) {
    return new Promise((resolve) => client.emit(event, payload, resolve));
  }

  function waitFor(client, event) {
    return new Promise((resolve) => client.once(event, resolve));
  }

  it("answers /health with ok and the list of active rooms", async () => {
    const client = await connect();
    await emitAsync(client, "join-session", "HEALTHROOM");

    const res = await fetch(`${url}/health`);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.rooms).toContain("HEALTHROOM");
  });

  it("rejects a broadcast with no codes at all", async () => {
    const client = await connect();
    await expect(emitAsync(client, "broadcast", { codes: [], media: {}, texts: [] })).resolves.toEqual({
      ok: false,
      error: "Aucune session cible.",
    });
    await expect(emitAsync(client, "broadcast", {})).resolves.toEqual({
      ok: false,
      error: "Aucune session cible.",
    });
  });

  it("acks join-session and rejects an empty code", async () => {
    const client = await connect();
    await expect(emitAsync(client, "join-session", "  team1  ")).resolves.toEqual({ ok: true, code: "TEAM1" });
    await expect(emitAsync(client, "join-session", "")).resolves.toEqual({
      ok: false,
      error: "Code de session vide.",
    });
  });

  it("broadcasts a session-count update on join and leave", async () => {
    const a = await connect();
    const b = await connect();
    const aCounts = [];
    a.on("session-count", (payload) => aCounts.push(payload));

    await emitAsync(a, "join-session", "COUNTROOM");
    await emitAsync(b, "join-session", "COUNTROOM");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(aCounts.at(-1)).toEqual({ code: "COUNTROOM", count: 2 });

    await emitAsync(b, "leave-session", "COUNTROOM");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(aCounts.at(-1)).toEqual({ code: "COUNTROOM", count: 1 });
  });

  it("rejects broadcasting to a session the sender hasn't joined", async () => {
    const client = await connect();
    const ack = await emitAsync(client, "broadcast", { codes: ["NOPE"], media: {}, texts: [] });
    expect(ack).toEqual({
      ok: false,
      results: [{ code: "NOPE", ok: false, error: "Vous n'êtes pas connecté à cette session." }],
    });
  });

  it("delivers a broadcast to every member of the target session", async () => {
    const sender = await connect();
    const receiver = await connect();
    await emitAsync(sender, "join-session", "ROOMX");
    await emitAsync(receiver, "join-session", "ROOMX");

    const received = waitFor(receiver, "broadcast-receive");
    const ack = await emitAsync(sender, "broadcast", { codes: ["ROOMX"], media: { kind: "image" }, texts: [] });

    expect(ack.ok).toBe(true);
    await expect(received).resolves.toMatchObject({ codes: ["ROOMX"], media: { kind: "image" } });
  });

  it("defaults texts to an empty array when the payload doesn't include one", async () => {
    const sender = await connect();
    const receiver = await connect();
    await emitAsync(sender, "join-session", "ROOMNOTEXT");
    await emitAsync(receiver, "join-session", "ROOMNOTEXT");

    const received = waitFor(receiver, "broadcast-receive");
    await emitAsync(sender, "broadcast", { codes: ["ROOMNOTEXT"], media: {} });

    await expect(received).resolves.toMatchObject({ texts: [] });
  });

  it("passes the sender's display name through, trimmed and capped", async () => {
    const from = await connect();
    const to = await connect();
    await emitAsync(from, "join-session", "ROOMY");
    await emitAsync(to, "join-session", "ROOMY");

    const received = waitFor(to, "broadcast-receive");
    await emitAsync(from, "broadcast", {
      codes: ["ROOMY"],
      media: {},
      texts: [],
      sender: "  " + "x".repeat(40),
    });

    await expect(received).resolves.toMatchObject({ sender: "x".repeat(32) });
  });

  it("defaults sender to an empty string when not provided", async () => {
    const from = await connect();
    const to = await connect();
    await emitAsync(from, "join-session", "ROOMZ");
    await emitAsync(to, "join-session", "ROOMZ");

    const received = waitFor(to, "broadcast-receive");
    await emitAsync(from, "broadcast", { codes: ["ROOMZ"], media: {}, texts: [] });

    await expect(received).resolves.toMatchObject({ sender: "" });
  });

  it("delivers exactly once to the sender and to a receiver in several of the target sessions", async () => {
    const sender = await connect();
    const receiver = await connect();
    await emitAsync(sender, "join-session", "A");
    await emitAsync(sender, "join-session", "B");
    await emitAsync(receiver, "join-session", "A");
    await emitAsync(receiver, "join-session", "B");

    let senderReceiveCount = 0;
    let receiverReceiveCount = 0;
    sender.on("broadcast-receive", () => senderReceiveCount++);
    receiver.on("broadcast-receive", () => receiverReceiveCount++);

    await emitAsync(sender, "broadcast", { codes: ["A", "B"], media: {}, texts: [] });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(senderReceiveCount).toBe(1);
    expect(receiverReceiveCount).toBe(1);
  });

  it("still delivers exactly once to someone in only one of the target sessions", async () => {
    const sender = await connect();
    const onlyInA = await connect();
    await emitAsync(sender, "join-session", "A2");
    await emitAsync(sender, "join-session", "B2");
    await emitAsync(onlyInA, "join-session", "A2");

    let receiveCount = 0;
    onlyInA.on("broadcast-receive", () => receiveCount++);

    await emitAsync(sender, "broadcast", { codes: ["A2", "B2"], media: {}, texts: [] });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(receiveCount).toBe(1);
  });
});
