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
  maxHttpBufferSize: 10 * 1024 * 1024, // images can be a few MB as base64
});

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

io.on("connection", (socket) => {
  socket.on("join-session", (rawCode, ack) => {
    const code = normalizeCode(rawCode);
    if (!code) {
      ack?.({ ok: false, error: "Code de session vide." });
      return;
    }
    socket.join(code);
    ack?.({ ok: true, code });
  });

  socket.on("leave-session", (rawCode, ack) => {
    const code = normalizeCode(rawCode);
    socket.leave(code);
    ack?.({ ok: true, code });
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
    socket.to(code).emit("broadcast-receive", {
      code,
      imageDataUrl: payload.imageDataUrl,
      imageAspectRatio: payload.imageAspectRatio,
      texts: Array.isArray(payload.texts) ? payload.texts : [],
      sentAt: Date.now(),
    });
    ack?.({ ok: true });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Chekssa server listening on port ${PORT}`);
});
