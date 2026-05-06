// src/redis.ts
import { Redis } from "ioredis";

// This connects to your Docker container on port 6379
export const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
  // If your Docker setup has a password, add it here:
  // password: "yourpassword", 
});

redis.on("connect", () => console.log("🟢 Connected to Redis"));
redis.on("error", (err) => console.error("🔴 Redis Error:", err));