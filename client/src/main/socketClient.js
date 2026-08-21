import { EventEmitter } from "node:events";
import { io } from "socket.io-client";
import { store } from "./store.js";

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function describeErrorDetail(detail) {
  if (typeof detail === "string") return detail;
  if (typeof detail === "number") return `status ${detail}`;
  if (detail instanceof Error) return detail.message;
  if (detail && typeof detail === "object") {
    const bits = [
      detail.status != null && `status ${detail.status}`,
      detail.statusText && String(detail.statusText).split("\n")[0],
      detail.responseText && String(detail.responseText).split("\n")[0],
      detail.message,
      detail.code,
      detail.type,
    ].filter(Boolean);
    return bits.length ? bits.join(" - ") : JSON.stringify(detail).slice(0, 200);
  }
  return String(detail);
}

class SocketClient extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.lastError = null;
    this.sessionCounts = {};
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
      sessionCounts: this.sessionCounts,
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
      this.sessionCounts = {};
      this.emitStateChanged();
    });

    socket.on("session-count", ({ code, count }) => {
      this.sessionCounts = { ...this.sessionCounts, [code]: count };
      this.emitStateChanged();
    });

    socket.on("connect_error", (error) => {
      this.connected = false;
      const details = [
        error.message,
        error.description != null && `description: ${describeErrorDetail(error.description)}`,
        error.context != null && `context: ${describeErrorDetail(error.context)}`,
      ].filter(Boolean);
      this.lastError = details.join(" | ") || String(error);
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
    const { [code]: _removed, ...rest } = this.sessionCounts;
    this.sessionCounts = rest;
    this.emitStateChanged();

    if (this.socket?.connected) {
      this.socket.emit("leave-session", code);
    }
    return { ok: true, code };
  }

  async sendBroadcast({ codes, media, texts, sender }) {
    if (!this.socket?.connected) {
      return { ok: false, error: "Non connecté au serveur." };
    }
    return new Promise((resolve) => {
      this.socket.emit(
        "broadcast",
        { codes: codes.map(normalizeCode), media, texts, sender },
        (ack) => resolve(ack ?? { ok: false, error: "Pas de réponse du serveur." })
      );
    });
  }
}

export const socketClient = new SocketClient();
