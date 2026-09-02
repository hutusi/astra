<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Standard commands live in `README.md` and `package.json` scripts. Notes below are the non-obvious bits for this environment.

- **Bun is required** and is the package manager + test runner (Next itself runs under Node — no `Bun.*` APIs in app code). Bun is installed at `~/.bun/bin` and is on `PATH` via `~/.bashrc`; the startup update script already runs `bun install`. If `bun` is not found in a non-login shell, run `export PATH="$HOME/.bun/bin:$PATH"`.
- **Local DB is a gitignored SQLite file** at `data/astra.db` (see `src/db/url.ts`); no env vars are needed for local dev. The file is not in the repo, so on a fresh checkout create it with `bun db:push`, then load demo data with `bun run seed`. Re-run `bun db:push` after any change to `src/db/schema.ts`.
- **Seed demo credentials** (`bun run seed`, which wipes and recreates local demo data): family code `ASTRA`; guardians `papa@astra.family` / `mama@astra.family` (password `astra-dev`); child `小星` (PIN `1234`). The core loop is: child checks in a habit → pending → guardian confirms in the parent queue.
- **Run / check:** `bun dev` (http://localhost:3000), `bun run lint`, and `bun run verify` (`tsc --noEmit && bun test`).
