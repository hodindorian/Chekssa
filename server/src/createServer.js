import express from "express";
import cors from "cors";
import http from "node:http";
import { Server } from "socket.io";

export function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function createServer() {
  const app = express();
  app.use(cors());

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    maxHttpBufferSize: 60 * 1024 * 1024,
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, rooms: [...io.sockets.adapter.rooms.keys()].filter((r) => !io.sockets.sockets.has(r)) });
  });

  function broadcastSessionCount(code) {
    const room = io.sockets.adapter.rooms.get(code);
    io.to(code).emit("session-count", { code, count: room ? room.size : 0 });
  }

  io.on("connection", (socket) => {
    const joinedCodes = new Set();

    socket.on("join-session", (rawCode, ack) => {
      const code = normalizeCode(rawCode);
      if (!code) {
        ack?.({ ok: false, error: "Code de session vide." });
        return;
      }
      socket.join(code);
      joinedCodes.add(code);
      ack?.({ ok: true, code });
      broadcastSessionCount(code);
    });

    socket.on("leave-session", (rawCode, ack) => {
      const code = normalizeCode(rawCode);
      socket.leave(code);
      joinedCodes.delete(code);
      ack?.({ ok: true, code });
      broadcastSessionCount(code);
    });

    socket.on("disconnect", () => {
      for (const code of joinedCodes) {
        broadcastSessionCount(code);
      }
    });

    socket.on("broadcast", (payload, ack) => {
      const codes = Array.isArray(payload?.codes) ? payload.codes.map(normalizeCode).filter(Boolean) : [];
      if (codes.length === 0) {
        ack?.({ ok: false, error: "Aucune session cible." });
        return;
      }

      const results = codes.map((code) => ({
        code,
        ok: socket.rooms.has(code),
        error: socket.rooms.has(code) ? undefined : "Vous n'êtes pas connecté à cette session.",
      }));
      const validCodes = results.filter((r) => r.ok).map((r) => r.code);

      if (validCodes.length > 0) {
        const targetSocketIds = new Set();
        for (const code of validCodes) {
          const room = io.sockets.adapter.rooms.get(code);
          if (room) for (const id of room) targetSocketIds.add(id);
        }
        const message = {
          codes: validCodes,
          media: payload.media,
          texts: Array.isArray(payload.texts) ? payload.texts : [],
          sender: String(payload.sender || "").trim().slice(0, 32),
          sentAt: Date.now(),
        };
        for (const id of targetSocketIds) {
          io.to(id).emit("broadcast-receive", message);
        }
      }

      ack?.({ ok: results.every((r) => r.ok), results });
    });
  });

  return { app, httpServer, io };
}
