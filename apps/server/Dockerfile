# Socket.IO game server. Runs the TypeScript directly via tsx.
# Build context is the REPO ROOT (so packages/shared is available):
#   docker compose -f docker-compose.prod.yml build server
FROM node:22-alpine
WORKDIR /app/apps/server

# deps first (layer cache). tsx is a devDependency used to run TS at runtime,
# so we install the full dependency set.
COPY apps/server/package.json apps/server/package-lock.json ./
RUN npm ci || npm install

# app source + the shared package (imported via ../../../../packages/shared)
COPY apps/server ./
COPY packages /app/packages

ENV NODE_ENV=production
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
