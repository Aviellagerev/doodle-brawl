// src/redis.ts
import { Redis } from "ioredis";
import { config } from "./config.js";

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

redis.on("connect", () => console.log("🟢 Connected to Redis"));
redis.on("error", (err) => console.error("🔴 Redis Error:", err));
