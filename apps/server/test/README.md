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

Notes:

- `auth.test.ts` clears the rate limiter's Redis counters before it runs, or the
  second run of the day would be locked out (signup is 5/hour per IP).
- The suite writes real rows. It never deletes them, so a long-lived dev
  database slowly fills with test matches; `docker compose down -v` resets it
  (and drops the schema — the compose file re-seeds it on the next `up`).
- `playToFinish` in `helpers.ts` plays a room to the end: whoever is casting
  takes the first spell offered and everyone else shouts it.
