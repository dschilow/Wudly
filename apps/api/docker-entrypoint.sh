#!/bin/sh
set -e

# Apply pending migrations against the configured DATABASE_URL, then launch the API.
# `migrate deploy` is idempotent and safe to run on every container start.
echo "▶ Running Prisma migrations…"
# prisma is a production dependency, so its binary is in ./node_modules/.bin.
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma || {
  echo "✖ Migration failed" >&2
  exit 1
}

echo "▶ Starting Wudly API…"
# tsconfig rootDir "." (src + prisma compiled together) puts the entry at dist/src/main.js.
exec node dist/src/main.js
