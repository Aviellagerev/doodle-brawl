import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Allow the dev server's HMR/dev assets to be requested from the LAN IP
  // (so phones/tablets on the same WiFi work). Dev-only. Update if the IP changes.
  allowedDevOrigins: ["192.168.68.58"],
  // The monorepo root, so imports of ../../packages/shared resolve. Turbopack
  // won't resolve files above its root, and it defaults to apps/web (there's a
  // lockfile here). __dirname → apps/web in dev and /app/apps/web in Docker,
  // so this points at the repo root in both.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
