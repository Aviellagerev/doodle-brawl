# web

Next.js frontend for the Skribbl clone. See the repo root `CLAUDE.md` for the
full architecture and dev commands.

## Run

```bash
pnpm --filter web dev     # http://localhost:3000
```

The app connects to the game server over WebSockets. Configure the server URL
via `NEXT_PUBLIC_SERVER_URL` — see `.env.example`.
