import Fastify from "fastify";
import { Server } from "socket.io";
import { RoomStore } from "./roomStore.js"
import { redis } from "./redis.js";
import { pool } from "./db.js"
import { registerRoomHandlers } from "./handlers/roomHandlers.js"
import { config } from "./config.js";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { installSocketGuard, broadcastPlayerCount } from "./observability.js";
import { issueSession, verifySession } from "./sessionStore.js";
import { getPlayer, createGuest, } from "./playerStore.js";
const roomStore = new RoomStore(redis);
const app = Fastify({ logger: true });
app.get("/health", async () => ({ ok: true }));
const start = async () => {
    const r = await pool.query("SELECT now()");
    console.log("🟢 Connected to Postgres:", r.rows[0].now);
    await app.register(cookie);
    await app.register(cors, {
        origin: config.corsOrigin,
        credentials: true,
    });
    app.get("/api/me", async (req, res) => {
        const raw = req.cookies.sid;
        const playerId = raw ? await verifySession(raw) : null;
        const player = playerId ? await getPlayer(playerId) : null;
        if (player) return { playerId: player.id, displayName: player.displayName };
        const fresh = await createGuest("Guest")
        const token = await issueSession(fresh.id);
        res.setCookie("sid", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 180,
        });

        return { playerId: fresh.id, displayName: fresh.displayName };

    });


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
