# Tests

End-to-end, against a **running** server and a real database — there are no
mocks. Start the stack first:

    docker compose up -d                       # postgres + redis
    cd apps/server && pnpm dev                 # :3001

then

    pnpm test                                  # all four suites
    ./node_modules/.bin/tsx --test test/game.test.ts   # just one

| suite | what it covers |
|---|---|
| `game.test.ts`  | rooms, host-only powers, the round loop, guessing, chat |
| `match.test.ts` | a full rite, what it writes to the chronicle, strokes, reconnect, malformed input |
| `auth.test.ts`  | guest identity, signup/login/logout, and who may read whose chronicle |
| `cors.test.ts`  | the one place a browser `Origin` is exercised — run the server with its real `CORS_ORIGIN` |
| `security.test.ts` | what leaks, what a hostile payload does, and whether the doors lock |
| `proxy-trust.test.ts` | who is allowed to claim a client's IP (pure logic — every local peer is loopback, and loopback is trusted) |
| `prune.test.ts` | the guest janitor: it deletes rows, so the guards are what is tested |

Notes:

- The suites run **one at a time** (`--test-concurrency=1`): they share one
  server and one database, and signup's 5/hour cap is per IP, not per file.
  `resetRateLimits()` clears the limiter's Redis counters; the auth and security
  suites call it before they start, and again before any test whose point is to
  exhaust a bucket.
- The suite writes real rows. Apart from the fixtures `prune.test.ts` cleans up
  after itself, nothing is deleted, so a long-lived dev database slowly fills
  with test matches; `docker compose down -v` resets it (and drops the schema —
  the compose file re-seeds it on the next `up`).
- Identity is lazy: `GET /api/me` mints nobody, so `Client.connect()` POSTs.
  `connectAnonymously()` opens a socket that never asks to be anyone, which is
  what a visitor still sitting on the join screen looks like.
- `playToFinish` in `helpers.ts` plays a room to the end: whoever is casting
  takes the first spell offered and everyone else shouts it.
