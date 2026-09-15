import Fastify from "fastify";
import { Server } from "socket.io";
import { RoomStore } from "./stores/roomStore.js"
import { redis } from "./redis.js";
import { pool } from "./db.js"
import { registerRoomHandlers, resumeRoundTimers } from "./handlers/roomHandlers.js"
import { config } from "./config.js";
import { authRoutes } from "./routes/authRoutes.js";
import { historyRoutes } from "./routes/historyRoutes.js";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { installSocketGuard, broadcastPlayerCount, ipFromHeaders } from "./observability.js";
import { verifySession, deleteExpiredSessions } from "./stores/sessionStore.js";
import { pruneIdleGuests } from "./stores/playerStore.js";
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
    // A failure the code did not anticipate is ours to read in the logs, not
    // the visitor's to read on screen: driver messages name the database, its
    // types and its error codes. Deliberate 4xx replies pass through untouched.
    app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
        const status = err.statusCode ?? 500;
        if (status < 500) return reply.status(status).send(err);
        req.log.error({ err, url: req.url }, "unhandled route error");
        return reply.status(500).send({ message: "Something went wrong. Try again." });
    });

    await app.register(authRoutes);
    await app.register(historyRoutes);


    // Bind first: a server that cannot listen must die loudly, not linger as a
    // process that answers nothing.
    await app.listen({ port: config.port, host: config.host });

    // Only now soften failures. A thrown handler should cost one player their
    // action, not every player their game — the alternative is that a single
    // malformed message ends every rite in progress.
    process.on("unhandledRejection", (reason) => app.log.error({ reason }, "unhandled rejection"));
    process.on("uncaughtException", (err) => app.log.error({ err }, "uncaught exception"));
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
            // A visitor with no session may still connect — the join screen needs
            // the player count before anyone has an identity. They are nobody
            // until they ask to be someone, and create_room / join_room are the
            // only doors that require it, so a nameless socket can never end up
            // inside a room.
            const playerId = raw ? await verifySession(raw) : null;
            if (playerId) socket.data.playerId = playerId;
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
        // tell this socket the count straight away — otherwise a new arrival
        // waits up to 30s for the next sweep before the join screen can say
        // how many wizards are awake
        roomStore.countPlayers()
            .then((n) => socket.emit("player_count", n))
            .catch((err) => app.log.error({ err }, "player count on connect failed"));
    });

    // rooms outlive this process in Redis, but their clocks do not: pick the
    // in-flight ones back up, then keep sweeping in case a timer is ever lost
    await resumeRoundTimers(io, roomStore, app.log);
    setInterval(() => resumeRoundTimers(io, roomStore, app.log), 15_000);

    setInterval(() => broadcastPlayerCount(io, roomStore, app.log), 30_000);

    // expired rows are already ignored by verifySession; this stops them piling up
    const sweepSessions = async () => {
        try {
            const gone = await deleteExpiredSessions();
            if (gone > 0) app.log.info({ deleted: gone }, "swept expired sessions");
        } catch (err) {
            app.log.error({ err }, "session sweep failed");
        }
        try {
            // guests who never played, and are too old to be mid-rite
            const gone = await pruneIdleGuests(config.guestRetentionDays);
            if (gone > 0) app.log.info({ deleted: gone, olderThanDays: config.guestRetentionDays }, "pruned idle guests");
        } catch (err) {
            app.log.error({ err }, "guest prune failed");
        }
    };
    await sweepSessions();
    setInterval(sweepSessions, 6 * 60 * 60 * 1000).unref();
};
start().catch((err) => {
    // nothing is listening yet, so there is no logger worth trusting
    console.error("🔴 failed to start:", err);
    process.exit(1);
});

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
