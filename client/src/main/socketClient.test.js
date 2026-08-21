import { beforeEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import { store } from "./store.js";
import { socketClient } from "./socketClient.js";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

vi.mock("./store.js", () => {
  const data = { serverUrl: "http://localhost:1234", sessionCodes: [] };
  return {
    store: {
      get: (key) => data[key],
      set: (key, value) => {
        data[key] = value;
      },
    },
  };
});

function createFakeSocket() {
  const listeners = new Map();
  return {
    connected: false,
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(cb);
    },
    removeAllListeners() {
      listeners.clear();
    },
    disconnect() {},
    trigger(event, ...args) {
      for (const cb of listeners.get(event) || []) cb(...args);
    },
    emit: vi.fn((_event, _payload, ack) => ack?.({ ok: true })),
  };
}

beforeEach(() => {
  store.set("sessionCodes", []);
});

describe("socketClient.connect", () => {
  it("re-joins every stored session code once connected", () => {
    store.set("sessionCodes", ["A", "B"]);
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);

    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("connect");

    const joinCalls = fakeSocket.emit.mock.calls.filter((c) => c[0] === "join-session").map((c) => c[1]);
    expect(joinCalls).toEqual(["A", "B"]);
    expect(socketClient.getState().connected).toBe(true);
  });

  it("clears sessionCounts and records the reason on disconnect", () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("connect");
    fakeSocket.trigger("session-count", { code: "A", count: 3 });
    expect(socketClient.getState().sessionCounts).toEqual({ A: 3 });

    fakeSocket.trigger("disconnect", "transport close");
    const state = socketClient.getState();
    expect(state.connected).toBe(false);
    expect(state.sessionCounts).toEqual({});
    expect(state.lastError).toBe("transport close");
  });

  it("builds a readable message from a connect_error", () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("connect_error", { message: "xhr poll error", description: 0 });
    expect(socketClient.getState().lastError).toContain("xhr poll error");
    expect(socketClient.getState().lastError).toContain("status 0");
  });

  it("describes a string description as-is", () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("connect_error", { message: "m", description: "already a string" });
    expect(socketClient.getState().lastError).toContain("already a string");
  });

  it("describes an Error-instance description by its message", () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("connect_error", { message: "m", description: new Error("boom") });
    expect(socketClient.getState().lastError).toContain("boom");
  });

  it("describes a non-object/non-primitive description via String()", () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("connect_error", { message: "m", description: true });
    expect(socketClient.getState().lastError).toContain("true");
  });

  it("pulls every useful field out of an XHR-shaped context object", () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("connect_error", {
      message: "m",
      context: {
        status: 0,
        statusText: "line one\nline two",
        responseText: "resp one\nresp two",
        message: "ctx message",
        code: "ECONNRESET",
        type: "TransportError",
      },
    });
    const lastError = socketClient.getState().lastError;
    expect(lastError).toContain("status 0");
    expect(lastError).toContain("line one");
    expect(lastError).not.toContain("line two");
    expect(lastError).toContain("resp one");
    expect(lastError).toContain("ctx message");
    expect(lastError).toContain("ECONNRESET");
    expect(lastError).toContain("TransportError");
  });

  it("falls back to JSON when a context object has no useful field", () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("connect_error", { message: "m", context: { irrelevant: true } });
    expect(socketClient.getState().lastError).toContain('{"irrelevant":true}');
  });

  it("falls back to String(error) when there's no message/description/context", () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("connect_error", {});
    expect(socketClient.getState().lastError).toBe("[object Object]");
  });

  it("re-emits a broadcast-receive event from the socket", () => {
    const fakeSocket = createFakeSocket();
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    const received = vi.fn();
    socketClient.once("broadcast-receive", received);
    fakeSocket.trigger("broadcast-receive", { codes: ["A"] });
    expect(received).toHaveBeenCalledWith({ codes: ["A"] });
  });

  it("disconnects any previous socket before reconnecting", () => {
    const first = createFakeSocket();
    io.mockReturnValue(first);
    socketClient.connect("http://localhost:1234");

    const disconnectSpy = vi.spyOn(first, "disconnect");
    const second = createFakeSocket();
    io.mockReturnValue(second);
    socketClient.connect("http://localhost:5678");

    expect(disconnectSpy).toHaveBeenCalled();
  });
});

describe("socketClient.joinSession / leaveSession", () => {
  it("adds the normalized code to sessionCodes even while offline", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = false;
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");

    const res = await socketClient.joinSession("  team1  ");
    expect(res).toEqual({ ok: true, code: "TEAM1", pending: true });
    expect(store.get("sessionCodes")).toEqual(["TEAM1"]);
  });

  it("rejects an empty session code", async () => {
    const res = await socketClient.joinSession("   ");
    expect(res).toEqual({ ok: false, error: "Code de session vide." });
  });

  it("rejects a nullish session code", async () => {
    const res = await socketClient.joinSession(null);
    expect(res).toEqual({ ok: false, error: "Code de session vide." });
  });

  it("removes the code and its cached count on leave", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    fakeSocket.trigger("session-count", { code: "TEAM1", count: 2 });
    store.set("sessionCodes", ["TEAM1"]);

    await socketClient.leaveSession("TEAM1");
    expect(store.get("sessionCodes")).toEqual([]);
    expect(socketClient.getState().sessionCounts).toEqual({});
    const leaveCalls = fakeSocket.emit.mock.calls.filter((c) => c[0] === "leave-session");
    expect(leaveCalls).toHaveLength(1);
  });

  it("doesn't try to emit leave-session while offline", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = false;
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");
    store.set("sessionCodes", ["TEAM1"]);

    await socketClient.leaveSession("TEAM1");
    expect(fakeSocket.emit).not.toHaveBeenCalled();
  });

  it("round-trips a real ack when joining while connected", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit = vi.fn((_event, code, ack) => ack({ ok: true, code }));
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");

    const res = await socketClient.joinSession("team2");
    expect(res).toEqual({ ok: true, code: "TEAM2" });
  });

  it("falls back to a synthesized ack when the server sends none", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit = vi.fn((_event, code, ack) => ack());
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");

    const res = await socketClient.joinSession("team3");
    expect(res).toEqual({ ok: true, code: "TEAM3" });
  });
});

describe("socketClient.sendBroadcast", () => {
  it("fails fast when not connected", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = false;
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");

    const res = await socketClient.sendBroadcast({ codes: ["A"], media: {}, texts: [] });
    expect(res).toEqual({ ok: false, error: "Non connecté au serveur." });
  });

  it("sends a single broadcast event with every normalized code", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit = vi.fn((_event, _payload, ack) => ack({ ok: true, results: [] }));
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");

    const res = await socketClient.sendBroadcast({ codes: [" a ", "b"], media: { kind: "image" }, texts: [] });
    expect(res).toEqual({ ok: true, results: [] });
    expect(fakeSocket.emit).toHaveBeenCalledTimes(1);
    const [event, payload] = fakeSocket.emit.mock.calls[0];
    expect(event).toBe("broadcast");
    expect(payload.codes).toEqual(["A", "B"]);
  });

  it("falls back to a generic error when the server sends no ack", async () => {
    const fakeSocket = createFakeSocket();
    fakeSocket.connected = true;
    fakeSocket.emit = vi.fn((_event, _payload, ack) => ack());
    io.mockReturnValue(fakeSocket);
    socketClient.connect("http://localhost:1234");

    const res = await socketClient.sendBroadcast({ codes: ["A"], media: {}, texts: [] });
    expect(res).toEqual({ ok: false, error: "Pas de réponse du serveur." });
  });
});
