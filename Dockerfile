# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Production backend
FROM node:20-alpine AS production

WORKDIR /app

# Install backend dependencies
COPY backend/package.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend into backend/public
# Vite outDir is '../backend/public' relative to /app/frontend → resolves to /app/backend/public
COPY --from=frontend-builder /app/backend/public ./public

# Create data directory for SQLite
RUN mkdir -p ./data

# Environment defaults
ENV PORT=3001
ENV NODE_ENV=production
ENV DB_PATH=/app/data/wkpool.db
ENV JWT_SECRET=verander-dit-in-productie

EXPOSE 3001

# Run seed then start server
CMD ["sh", "-c", "node src/db/seed.js && node src/server.js"]
