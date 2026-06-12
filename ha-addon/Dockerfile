FROM node:20-alpine

# jq to read HA config; python3/make/g++ to compile better-sqlite3 native module;
# tzdata so the container clock matches Dutch time (logs + any Date usage)
RUN apk add --no-cache jq python3 make g++ tzdata

# Tournament runs on Dutch time
ENV TZ=Europe/Amsterdam

WORKDIR /app

# Copy backend source and pre-built frontend
COPY backend/package.json ./
RUN npm install --omit=dev

COPY backend/src ./src
COPY backend/public ./public

# Create data directory
RUN mkdir -p /data

# Start script
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3001

CMD ["/run.sh"]
