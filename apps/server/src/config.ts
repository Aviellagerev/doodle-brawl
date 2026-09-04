
export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  // "*" allows any origin (fine for local/LAN dev). In production set
  // CORS_ORIGIN to the web domain (e.g. https://draw.lagerev.dev) to lock it down.
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  redis: {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
  postgres: {
  host:     process.env.PGHOST     ?? "127.0.0.1",
  port:     Number(process.env.PGPORT ?? 5432),
  user:     process.env.PGUSER     ?? "postgres",
  password: process.env.PGPASSWORD ?? "devpassword",
  database: process.env.PGDATABASE ?? "skribbl",
},
};
