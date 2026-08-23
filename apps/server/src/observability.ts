// Socket-level observability: structured logging (who connected, when, what
// events they sent) + per-socket rate limiting so a flood gets dropped and
// flagged rather than hammering the game. Logs go to stdout as JSON (pino via
// Fastify) — on the server: `docker compose -f docker-compose.prod.yml logs -f server`.
import type { FastifyBaseLogger } from "fastify";
import type { Server, Socket } from "socket.io";
import type { RoomStore } from "./roomStore.js";

// Real client IP through Cloudflare (cf-connecting-ip) → Caddy (x-forwarded-for)
// → the direct socket address as a last resort.
export function clientIp(socket: Socket): string {
  const h = socket.handshake.headers;
  const cf = h["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  const xff = h["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return socket.handshake.address;
}

// Sliding-window caps per socket, per 10s. Drawing is bursty and legitimate, so
// its cap is generous; everything else ("control": chat, guesses, settings,
// joins…) is capped tight enough to stop spam but never a real human.
const WINDOW_MS = 10_000;
const LIMITS = { draw: 2000, control: 80 } as const;

type Bucket = { n: number; resetAt: number };
type SocketStats = {
  ip: string;
  connectedAt: number;
  draw: Bucket;
  control: Bucket;
  totalEvents: number;
  totalDraws: number;
  limited: number;
};

// Attach logging + rate limiting to a freshly connected socket. Call this before
// registering the game handlers so the rate-limit middleware runs first.
export function installSocketGuard(socket: Socket, log: FastifyBaseLogger) {
  const now = Date.now();
  const ip = clientIp(socket);
  const stats: SocketStats = {
    ip,
    connectedAt: now,
    draw: { n: 0, resetAt: now + WINDOW_MS },
    control: { n: 0, resetAt: now + WINDOW_MS },
    totalEvents: 0,
    totalDraws: 0,
    limited: 0,
  };
  socket.data.stats = stats;

  log.info({ evt: "connect", sid: socket.id, ip, ua: socket.handshake.headers["user-agent"] }, "socket connected");

  // Runs before every incoming event reaches its handler. next(Error) drops the
  // packet (the handler never sees it) and notifies the client via an error.
  socket.use((packet, next) => {
    const event = String(packet[0] ?? "");
    const t = Date.now();
    const cls: keyof typeof LIMITS = event === "draw" ? "draw" : "control";
    const bucket = stats[cls];
    if (t >= bucket.resetAt) { bucket.n = 0; bucket.resetAt = t + WINDOW_MS; }
    bucket.n += 1;
    stats.totalEvents += 1;
    if (cls === "draw") stats.totalDraws += 1;

    if (bucket.n > LIMITS[cls]) {
      stats.limited += 1;
      // don't drown the log if a flood is sustained — first few, then every 100th
      if (stats.limited <= 3 || stats.limited % 100 === 0) {
        log.warn(
          { evt: "rate_limited", sid: socket.id, ip, event, cls, inWindow: bucket.n, cap: LIMITS[cls], hits: stats.limited, playerId: socket.data.playerId, roomId: socket.data.roomId },
          "rate limit exceeded",
        );
      }
      return next(new Error("rate_limited"));
    }

    // Log the meaningful control events (skip the high-frequency canvas noise).
    if (cls === "control" && event !== "clear" && event !== "undo") {
      log.info({ evt: "req", sid: socket.id, ip, event, playerId: socket.data.playerId, roomId: socket.data.roomId }, event);
    }
    next();
  });

  socket.on("disconnect", (reason) => {
    log.info(
      {
        evt: "disconnect", sid: socket.id, ip, reason,
        durationMs: Date.now() - stats.connectedAt,
        events: stats.totalEvents, draws: stats.totalDraws, limited: stats.limited,
        playerId: socket.data.playerId, roomId: socket.data.roomId,
      },
      "socket disconnected",
    );
  });
}

// Compute the live player count and push it to every connected client.
export async function broadcastPlayerCount(io: Server, roomStore: RoomStore, log?: FastifyBaseLogger) {
  try {
    const count = await roomStore.countPlayers();
    io.emit("player_count", count);
  } catch (err) {
    log?.error({ err }, "player count failed");
  }
}
