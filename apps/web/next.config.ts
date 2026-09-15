import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Allow the dev server's HMR/dev assets to be requested from the LAN, so
  // phones on the same WiFi work. Dev-only, and the lease moves: this covers
  // the whole subnet rather than naming one address that goes stale.
  allowedDevOrigins: ["192.168.68.0/24"],
  // The monorepo root, so imports of ../../packages/shared resolve. Turbopack
  // won't resolve files above its root, and it defaults to apps/web (there's a
  // lockfile here). __dirname → apps/web in dev and /app/apps/web in Docker,
  // so this points at the repo root in both.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
