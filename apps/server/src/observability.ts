
import type { FastifyBaseLogger } from "fastify";
import type { Server, Socket } from "socket.io";
import type { RoomStore } from "./stores/roomStore.js";
import { config } from "./config.js";
import { isIP } from "node:net";


/** Strip the IPv6 form of an IPv4 address, and any :port. */
function bare(ip: string): string {
  const v = ip.replace(/^::ffff:/i, "");
  return v.includes("%") ? v.slice(0, v.indexOf("%")) : v;
}

function ipToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const b = Number(part);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    n = n * 256 + b;
  }
  return n;
}

/** Is `ip` inside `rule`, where rule is an address or an IPv4 CIDR block? */
function withinRule(ip: string, rule: string): boolean {
  if (rule === "*") return true;
  if (!rule.includes("/")) return bare(rule) === ip;
  const [net, bitsRaw] = rule.split("/");
  const bits = Number(bitsRaw);
  const a = ipToLong(ip);
  const b = ipToLong(bare(net));
  if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

/**
 * Only a known proxy may tell us who the client is.
 *
 * Behind Caddy the peer address is the tunnel, so the real IP has to come from
 * a header — but a header is just a string anyone can send. Trusting it from
 * any peer means every request can claim a different IP, and every per-IP limit
 * in the app quietly stops existing. So the header counts only when the
 * connection itself came from `config.trustedProxies`.
 */
export function trustsProxyHeaders(peer: string): boolean {
  const ip = bare(peer);
  if (!isIP(ip)) return false;
  return config.trustedProxies.some((rule) => withinRule(ip, rule));
}

export function ipFromHeaders(
  h: Record<string, string | string[] | undefined>,
  fallback: string,
): string {
  if (!trustsProxyHeaders(fallback)) return bare(fallback);
  const cf = h["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return bare(cf.trim());
  const xff = h["x-forwarded-for"];
  if (typeof xff === "string" && xff) return bare(xff.split(",")[0].trim());
  return bare(fallback);
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
