
import type { FastifyBaseLogger } from "fastify";
import type { Server, Socket } from "socket.io";
import type { RoomStore } from "./stores/roomStore.js";


export function ipFromHeaders(
  h: Record<string, string | string[] | undefined>,
  fallback: string,
): string {
  const cf = h["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  const xff = h["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return fallback;
}

export function clientIp(socket: Socket): string {
  return ipFromHeaders(socket.handshake.headers, socket.handshake.address);
}


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
  
      if (stats.limited <= 3 || stats.limited % 100 === 0) {
        log.warn(
          { evt: "rate_limited", sid: socket.id, ip, event, cls, inWindow: bucket.n, cap: LIMITS[cls], hits: stats.limited, playerId: socket.data.playerId, roomId: socket.data.roomId },
          "rate limit exceeded",
        );
      }
      return next(new Error("rate_limited"));
    }

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

export async function broadcastPlayerCount(io: Server, roomStore: RoomStore, log?: FastifyBaseLogger) {
  try {
    const count = await roomStore.countPlayers();
    io.emit("player_count", count);
  } catch (err) {
    log?.error({ err }, "player count failed");
  }
}
