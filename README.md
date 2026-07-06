# Astra ✨

家庭成长与习惯星图 — a family web app for children's habit building and growth. Annual plan (Constellation) → daily habits → star ledger, with permissions that mature as the child grows.

See [docs/DESIGN.md](docs/DESIGN.md) for the full design.

## Development

```bash
bun install
bun db:push      # create/update the local SQLite db (data/astra.db)
bun run seed     # seed a demo family (dev only)
bun dev          # http://localhost:3000
```

No env vars needed locally. Production uses Vercel + Turso — see `.env.example`.

## Verify

```bash
bun run verify   # typecheck (+ tests from slice 5)
```
