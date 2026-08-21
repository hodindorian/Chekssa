import { beforeEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import { socketClient } from "./socketClient.js";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

function createFakeSocket() {
  const listeners = new Map();
  return {
    connected: false,
    on(event, cb) {
      (listeners.get(event) ?? listeners.set(event, []).get(event)).push(cb);
    },
    once(event, cb) {
      this.on(event, cb);
    },
    trigger(event, ...args) {
      for (const cb of listeners.get(event) ?? []) cb(...args);
    },
    emit: vi.fn(),
  };
}

beforeEach(() => {
  socketClient.joinedCodes.clear();
});

describe("socketClient.connect", () => {
  it("resolves once the socket connects and clears any stale joined codes", async () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.joinedCodes.add("STALE");

    const connectPromise = socketClient.connect();
    fakeSocket.trigger("connect");
    await connectPromise;

    expect(socketClient.joinedCodes.size).toBe(0);
  });

  it("rejects when the socket reports a connect_error", async () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);

    const connectPromise = socketClient.connect();
    fakeSocket.trigger("connect_error", new Error("boom"));
    await expect(connectPromise).rejects.toThrow("boom");
  });

  it("doesn't blow up when the socket disconnects", async () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    const connectPromise = socketClient.connect();
    fakeSocket.trigger("connect");
    await connectPromise;

    expect(() => fakeSocket.trigger("disconnect", "transport close")).not.toThrow();
  });
});

describe("socketClient.ensureJoined / broadcast", () => {
  it("joins once and caches the code for subsequent calls", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit.mockImplementation((event, payload, ack) => {
      if (event === "join-session") ack({ ok: true, code: payload });
    });
    io.mockReturnValue(fakeSocket);
    socketClient.socket = fakeSocket;

    await socketClient.ensureJoined("team1");
    await socketClient.ensureJoined("team1");

    const joinCalls = fakeSocket.emit.mock.calls.filter((c) => c[0] === "join-session");
    expect(joinCalls).toHaveLength(1);
    expect(socketClient.joinedCodes.has("TEAM1")).toBe(true);
  });

  it("throws when the server refuses the join", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit.mockImplementation((event, payload, ack) => ack({ ok: false, error: "nope" }));
    socketClient.socket = fakeSocket;

    await expect(socketClient.ensureJoined("team1")).rejects.toThrow("nope");
  });

  it("falls back to a generic error when the join ack has no detail", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit.mockImplementation((event, payload, ack) => ack({ ok: false }));
    socketClient.socket = fakeSocket;

    await expect(socketClient.ensureJoined("team1")).rejects.toThrow("Impossible de rejoindre");
  });

  it("rejects an empty/blank session code before ever contacting the server", async () => {
    const fakeSocket = createFakeSocket();
    socketClient.socket = fakeSocket;

    await expect(socketClient.ensureJoined("   ")).rejects.toThrow("Code de session vide");
    await expect(socketClient.ensureJoined(null)).rejects.toThrow("Code de session vide");
    expect(fakeSocket.emit).not.toHaveBeenCalled();
  });

  it("refuses to broadcast while not connected", async () => {
    socketClient.socket = { connected: false };
    await expect(socketClient.broadcast("team1", {})).rejects.toThrow("Non connecté");
  });

  it("sends a single-code broadcast for the joined session", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit.mockImplementation((event, payload, ack) => {
      if (event === "join-session") ack({ ok: true, code: payload });
      if (event === "broadcast") ack({ ok: true, results: [] });
    });
    socketClient.socket = fakeSocket;

    const media = { kind: "image" };
    const ack = await socketClient.broadcast("team1", media, []);
    expect(ack).toEqual({ ok: true, results: [] });
    const broadcastCall = fakeSocket.emit.mock.calls.find((c) => c[0] === "broadcast");
    expect(broadcastCall[1]).toEqual({ codes: ["TEAM1"], media, texts: [] });
  });

  it("throws the per-session error when the broadcast ack reports one", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit.mockImplementation((event, payload, ack) => {
      if (event === "join-session") ack({ ok: true, code: payload });
      if (event === "broadcast") ack({ ok: false, results: [{ error: "pas dans cette session" }] });
    });
    socketClient.socket = fakeSocket;

    await expect(socketClient.broadcast("team1", {})).rejects.toThrow("pas dans cette session");
  });

  it("falls back to a generic error when the broadcast ack has no detail", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit.mockImplementation((event, payload, ack) => {
      if (event === "join-session") ack({ ok: true, code: payload });
      if (event === "broadcast") ack({ ok: false });
    });
    socketClient.socket = fakeSocket;

    await expect(socketClient.broadcast("team1", {})).rejects.toThrow("Échec de l'envoi");
  });
});
