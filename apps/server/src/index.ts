import Fastify from "fastify";
import { Server } from "socket.io";
import { RoomStore } from "./roomStore.js"
import { redis } from "./redis.js";
import { registerRoomHandlers } from "./handlers/roomHandlers.js"
import { config } from "./config.js";
const roomStore = new RoomStore(redis);
const app = Fastify({ logger: true });
app.get("/health", async () => ({ ok: true }));
const start = async () => {
    await app.listen({ port: config.port, host: config.host });
    const io = new Server(app.server, {
        cors: { origin: config.corsOrigin },
    });

    io.on("connection", (socket) => {
        console.log("connected");
        registerRoomHandlers(io, socket, roomStore);

    });
};
start();

// Release the port and connections cleanly on Ctrl+C / stop, so the server
// doesn't linger and hold :3001 between restarts.
const shutdown = async () => {
    console.log("shutting down...");
    try {
        await app.close();      // closes the HTTP + Socket.IO server, frees the port
        redis.disconnect();     // closes the Redis connection
    } finally {
        process.exit(0);
    }
};

process.on("SIGINT", shutdown);   // Ctrl+C
process.on("SIGTERM", shutdown);  // kill / stop signals
