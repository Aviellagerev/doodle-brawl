import Fastify from "fastify";
import { Server } from "socket.io";
import { RoomStore } from "./roomStore.js"
import { redis } from "./redis.js";
import { pool } from "./db.js"
import { registerRoomHandlers } from "./handlers/roomHandlers.js"
import { config } from "./config.js";
import { installSocketGuard, broadcastPlayerCount } from "./observability.js";
const roomStore = new RoomStore(redis);
const app = Fastify({ logger: true });
app.get("/health", async () => ({ ok: true }));
const start = async () => {
    const r = await pool.query("SELECT now()");
    console.log("🟢 Connected to Postgres:", r.rows[0].now);
    await app.listen({ port: config.port, host: config.host });
    const io = new Server(app.server, {
        cors: { origin: config.corsOrigin === "*" ? true : config.corsOrigin },
    });

    io.on("connection", (socket) => {
        installSocketGuard(socket, app.log);      // structured logging + rate limiting
        registerRoomHandlers(io, socket, roomStore);
    });

    // heartbeat: refresh the live player count for everyone every 30s, so it
    // stays accurate even after room expiries the event hooks don't observe.
    setInterval(() => broadcastPlayerCount(io, roomStore, app.log), 30_000);
};
start();

// Release the port and connections cleanly on Ctrl+C / stop, so the server
// doesn't linger and hold :3001 between restarts.
const shutdown = async () => {
    console.log("shutting down...");
    try {
        await app.close();      // closes the HTTP + Socket.IO server, frees the port
        await pool.end();
        redis.disconnect();     // closes the Redis connection
    } finally {
        process.exit(0);
    }
};

process.on("SIGINT", shutdown);   // Ctrl+C
process.on("SIGTERM", shutdown);  // kill / stop signals
