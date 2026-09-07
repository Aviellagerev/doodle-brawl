import Fastify from "fastify";
import { Server } from "socket.io";
import { RoomStore } from "./stores/roomStore.js"
import { redis } from "./redis.js";
import { pool } from "./db.js"
import { registerRoomHandlers } from "./handlers/roomHandlers.js"
import { config } from "./config.js";
import { authRoutes } from "./routes/authRoutes.js";
import { historyRoutes } from "./routes/historyRoutes.js";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { installSocketGuard, broadcastPlayerCount, ipFromHeaders } from "./observability.js";
import { verifySession, deleteExpiredSessions } from "./stores/sessionStore.js";
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
    await app.register(rateLimit, {
        global: false,
        redis,
        keyGenerator: (req) => ipFromHeaders(req.headers, req.ip),
    });
    await app.register(authRoutes);
    await app.register(historyRoutes);


    await app.listen({ port: config.port, host: config.host });
    const io = new Server(app.server, {
        cors: {
            origin: config.corsOrigin === "*" ? true : config.corsOrigin,
            credentials: true,
        },
    });


    io.use(async (socket, next) => {
        try {
            const header = socket.handshake.headers.cookie;
            const raw = header ? app.parseCookie(header).sid : undefined;
            const playerId = raw ? await verifySession(raw) : null;
            if (!playerId) return next(new Error("unauthorized"));
            socket.data.playerId = playerId;
            next();
        }
        catch (err) {
            app.log.error({ err }, "handshake auth failed");
            next(new Error("unauthorized"));
        }

    });


    io.on("connection", (socket) => {
        installSocketGuard(socket, app.log);
        registerRoomHandlers(io, socket, roomStore);
    });

    setInterval(() => broadcastPlayerCount(io, roomStore, app.log), 30_000);

    // expired rows are already ignored by verifySession; this stops them piling up
    const sweepSessions = async () => {
        try {
            const gone = await deleteExpiredSessions();
            if (gone > 0) app.log.info({ deleted: gone }, "swept expired sessions");
        } catch (err) {
            app.log.error({ err }, "session sweep failed");
        }
    };
    await sweepSessions();
    setInterval(sweepSessions, 6 * 60 * 60 * 1000).unref();
};
start();

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
