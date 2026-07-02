// Central configuration.
// Reads from environment variables, with sensible defaults for local dev.
// This is the single source of truth for everything the server can be
// configured with — see `.env.example` for the documented list.
//
// Note: values in process.env are always strings, so numeric settings
// are wrapped in Number(). `??` ("nullish coalescing") means: use the
// env var if it's set, otherwise fall back to the default.
export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  redis: {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
};
