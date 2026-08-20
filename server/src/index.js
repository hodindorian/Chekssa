import express from "express";
import cors from "cors";
import http from "node:http";
import { Server } from "socket.io";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: [...io.sockets.adapter.rooms.keys()].filter((r) => !io.sockets.sockets.has(r)) });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
  // Local video files and large GIFs are sent whole (as base64), capped at
  // 40MB raw on the client - 60MB gives headroom for that plus base64/JSON
  // overhead (~1.37x).
  maxHttpBufferSize: 60 * 1024 * 1024,
});

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function broadcastSessionCount(code) {
  const room = io.sockets.adapter.rooms.get(code);
  io.to(code).emit("session-count", { code, count: room ? room.size : 0 });
}

io.on("connection", (socket) => {
  // Tracked ourselves rather than read off socket.rooms on disconnect: by
  // the time "disconnect" fires the socket has already left every room
  // (which is what we want for an accurate post-departure count), but that
  // also means socket.rooms no longer tells us *which* rooms to notify.
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
    const code = normalizeCode(payload?.code);
    if (!code) {
      ack?.({ ok: false, error: "Code de session manquant." });
      return;
    }
    if (!socket.rooms.has(code)) {
      ack?.({ ok: false, error: "Vous n'êtes pas connecté à cette session." });
      return;
    }
    // io.to (not socket.to) so the sender also gets the overlay on their own
    // screen, showing exactly what recipients see.
    io.to(code).emit("broadcast-receive", {
      code,
      media: payload.media,
      texts: Array.isArray(payload.texts) ? payload.texts : [],
      sentAt: Date.now(),
    });
    ack?.({ ok: true });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Chekssa server listening on port ${PORT}`);
});
