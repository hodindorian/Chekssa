import { EventEmitter } from "node:events";
import { io } from "socket.io-client";
import { store } from "./store.js";

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

class SocketClient extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.lastError = null;
  }

  get serverUrl() {
    return store.get("serverUrl");
  }

  get sessionCodes() {
    return store.get("sessionCodes");
  }

  getState() {
    return {
      serverUrl: this.serverUrl,
      connected: this.connected,
      sessionCodes: this.sessionCodes,
      lastError: this.lastError,
    };
  }

  emitStateChanged() {
    this.emit("state-changed", this.getState());
  }

  connect(serverUrl = this.serverUrl) {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }
    store.set("serverUrl", serverUrl);

    // Let socket.io negotiate polling -> websocket upgrade (more resilient behind
    // reverse proxies that don't perfectly support the websocket upgrade handshake).
    const socket = io(serverUrl, { reconnection: true });
    this.socket = socket;

    socket.on("connect", () => {
      this.connected = true;
      this.lastError = null;
      for (const code of this.sessionCodes) {
        socket.emit("join-session", code);
      }
      this.emitStateChanged();
    });

    socket.on("disconnect", (reason) => {
      this.connected = false;
      this.lastError = reason;
      this.emitStateChanged();
    });

    socket.on("connect_error", (error) => {
      this.connected = false;
      this.lastError = error.message || String(error);
      this.emitStateChanged();
    });

    socket.on("broadcast-receive", (payload) => {
      this.emit("broadcast-receive", payload);
    });
  }

  async joinSession(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) return { ok: false, error: "Code de session vide." };

    const codes = new Set(this.sessionCodes);
    codes.add(code);
    store.set("sessionCodes", [...codes]);
    this.emitStateChanged();

    if (!this.socket?.connected) return { ok: true, code, pending: true };

    return new Promise((resolve) => {
      this.socket.emit("join-session", code, (ack) => resolve(ack ?? { ok: true, code }));
    });
  }

  async leaveSession(rawCode) {
    const code = normalizeCode(rawCode);
    const codes = this.sessionCodes.filter((c) => c !== code);
    store.set("sessionCodes", codes);
    this.emitStateChanged();

    if (this.socket?.connected) {
      this.socket.emit("leave-session", code);
    }
    return { ok: true, code };
  }

  async sendBroadcast({ codes, imageDataUrl, imageAspectRatio, texts }) {
    if (!this.socket?.connected) {
      return { ok: false, error: "Non connecté au serveur." };
    }
    const results = await Promise.all(
      codes.map(
        (code) =>
          new Promise((resolve) => {
            this.socket.emit(
              "broadcast",
              { code: normalizeCode(code), imageDataUrl, imageAspectRatio, texts },
              (ack) => resolve({ code, ...(ack ?? { ok: false, error: "Pas de réponse du serveur." }) })
            );
          })
      )
    );
    return { ok: results.every((r) => r.ok), results };
  }
}

export const socketClient = new SocketClient();
