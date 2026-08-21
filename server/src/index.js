import { createServer } from "./createServer.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const { httpServer } = createServer();

httpServer.listen(PORT, () => {
  console.log(`Chekssa server listening on port ${PORT}`);
});
