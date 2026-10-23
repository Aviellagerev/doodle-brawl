FROM node:22-alpine
# pnpm, at the version package.json pins ("packageManager")
RUN corepack enable
WORKDIR /app

# Dependencies first, for the layer cache: the workspace manifests and the ONE
# lockfile the app is developed and tested against. --frozen-lockfile makes a
# stale lockfile fail the build — the old `npm ci || npm install` fell through
# to fresh, untested versions on every deploy without a word.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter server

# app source + the shared package (imported as ../../../../packages/shared)
COPY apps/server apps/server
COPY packages packages

ENV NODE_ENV=production
WORKDIR /app/apps/server
# not root: anyone who ever got code running in here starts with nothing
USER node
EXPOSE 3001
# tsx (a dev dependency, installed above) runs the TypeScript directly; calling
# it by path means no npx lookup — or download — at start-up
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
