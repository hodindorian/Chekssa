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
});
