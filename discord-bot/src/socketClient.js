import { io } from "socket.io-client";

const SERVER_URL = process.env.CHEKSSA_SERVER_URL || "https://chekssa.hodindorian.com";

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

class BotSocketClient {
  constructor() {
    this.socket = null;
    this.joinedCodes = new Set();
  }

  connect() {
    this.socket = io(SERVER_URL, { reconnection: true });

    this.socket.on("connect", () => {
      this.joinedCodes.clear();
      console.log(`[socket] connecté à ${SERVER_URL}`);
    });
    this.socket.on("disconnect", (reason) => {
      console.warn(`[socket] déconnecté (${reason})`);
    });
    this.socket.on("connect_error", (err) => {
      console.error(`[socket] erreur de connexion : ${err.message}`);
    });

    return new Promise((resolve, reject) => {
      this.socket.once("connect", resolve);
      this.socket.once("connect_error", reject);
    });
  }

  async ensureJoined(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) throw new Error("Code de session vide.");
    if (this.joinedCodes.has(code)) return code;
    const ack = await new Promise((resolve) => this.socket.emit("join-session", code, resolve));
    if (!ack?.ok) throw new Error(ack?.error || "Impossible de rejoindre cette session.");
    this.joinedCodes.add(code);
    return code;
  }

  async broadcast(rawCode, media, texts = []) {
    if (!this.socket?.connected) throw new Error("Non connecté au serveur Chekssa.");
    const code = await this.ensureJoined(rawCode);
    const ack = await new Promise((resolve) => this.socket.emit("broadcast", { codes: [code], media, texts }, resolve));
    if (!ack?.ok) throw new Error(ack?.results?.[0]?.error || ack?.error || "Échec de l'envoi.");
    return ack;
  }
}

export const socketClient = new BotSocketClient();
