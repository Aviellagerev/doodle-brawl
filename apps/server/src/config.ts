
export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  // "*" allows any origin (fine for local/LAN dev). In production set
  // CORS_ORIGIN to the web domain (e.g. https://draw.lagerev.dev) to lock it down.
corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",

  // Guests who never played are deleted after this long. Accounts and anyone
  // with match history are never pruned.
  guestRetentionDays: Number(process.env.GUEST_RETENTION_DAYS ?? 30),

  /**
   * Who may tell us a client's real IP.
   *
   * `cf-connecting-ip` / `x-forwarded-for` are trusted only when the connection
   * itself comes from one of these — otherwise anyone reaching the port could
   * mint a fresh rate-limit bucket per request by inventing a header. In
   * production the only peer is the reverse proxy over WireGuard; set
   * TRUSTED_PROXIES if that address changes. "*" restores the old blind trust.
   */
  trustedProxies: (process.env.TRUSTED_PROXIES ?? "127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")
    .split(",").map((s) => s.trim()).filter(Boolean),

  redis: {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
  postgres: {
  host:     process.env.PGHOST     ?? "127.0.0.1",
  port:     Number(process.env.PGPORT ?? 5432),
  user:     process.env.PGUSER     ?? "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? "skribbl",
},
};
