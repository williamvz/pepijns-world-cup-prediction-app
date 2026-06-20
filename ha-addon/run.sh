#!/bin/sh

# Read JWT secret from HA add-on config (/data/options.json). There is no
# fallback on purpose: starting without a real secret would let anyone forge a
# valid (admin) token. Refuse to start until one is configured.
JWT_SECRET=$(jq -r '.jwt_secret // ""' /data/options.json 2>/dev/null || echo "")
if [ -z "$JWT_SECRET" ]; then
  echo "❌ jwt_secret is niet ingesteld."
  echo "   Ga naar de add-on → Configuratie en zet jwt_secret op een lang, willekeurig geheim."
  exit 1
fi

export PORT=3001
export NODE_ENV=production
export DB_PATH=/data/wkpool.db
export JWT_SECRET="${JWT_SECRET}"
export JWT_EXPIRES_IN=30d

echo "⚽ WK Pool 2026 wordt gestart..."
echo "Database: ${DB_PATH}"

# Run seed on first start (idempotent - safe to run every time)
node /app/src/db/seed.js

echo "🚀 Server start op poort ${PORT}"
exec node /app/src/server.js
