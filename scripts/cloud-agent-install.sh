#!/usr/bin/env bash
# Install script for the Cursor Cloud Agent environment (.cursor/environment.json).
# Must stay idempotent: it runs for every environment Build, sometimes against
# disk state a previous Build already prepared.
set -euo pipefail

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

# Bun is the package manager and test runner, and is not in the base image.
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
fi

# A Build snapshots the disk but not exported shell variables, and the ~/.bashrc
# line the installer writes is only read by interactive shells. A symlink on the
# default PATH is what makes `bun` resolve in every agent shell.
if [ ! -e /usr/local/bin/bun ] && command -v sudo >/dev/null 2>&1; then
  sudo ln -s "$BUN_INSTALL/bin/bun" /usr/local/bin/bun ||
    echo "warning: could not symlink bun into /usr/local/bin; non-interactive shells may need PATH=\$HOME/.bun/bin:\$PATH"
fi

bun install --frozen-lockfile

# The local database is a gitignored SQLite file (data/astra.db), so a fresh
# checkout has none. Both commands are safe to repeat; seed wipes and recreates
# the demo family, which is the point in a throwaway dev environment.
bun db:push
bun run seed
