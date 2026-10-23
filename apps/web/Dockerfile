# Next.js web app (production: next build → next start).
# Build context is the REPO ROOT (so packages/shared and the lockfile are there).
# NEXT_PUBLIC_SERVER_URL is baked into the client bundle AT BUILD TIME, so it
# must be passed as a build arg.
FROM node:22-alpine
# pnpm, at the version package.json pins ("packageManager")
RUN corepack enable
WORKDIR /app

# the same one lockfile as the server; a stale one fails the build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter web

COPY apps/web apps/web
COPY packages packages

ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
WORKDIR /app/apps/web
RUN ./node_modules/.bin/next build

ENV NODE_ENV=production
# not root (the build above needed it; serving does not)
USER node
EXPOSE 3000
# next start binds 0.0.0.0:3000 by default
CMD ["./node_modules/.bin/next", "start"]
