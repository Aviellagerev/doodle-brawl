# Next.js web app (production: next build → next start).
# Build context is the REPO ROOT (so packages/shared is available).
# NEXT_PUBLIC_SERVER_URL is baked into the client bundle AT BUILD TIME, so it
# must be passed as a build arg.
FROM node:22-alpine
WORKDIR /app/apps/web

COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci || npm install

COPY apps/web ./
COPY packages /app/packages

ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
# next start binds 0.0.0.0:3000 by default
CMD ["npm", "run", "start"]
