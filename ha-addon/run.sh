#!/bin/sh

# Read JWT secret from HA add-on config (/data/options.json)
# Falls back to a default if not set
JWT_SECRET=$(jq -r '.jwt_secret // "changeme-set-this-in-ha-config"' /data/options.json 2>/dev/null || echo "changeme-set-this-in-ha-config")

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
