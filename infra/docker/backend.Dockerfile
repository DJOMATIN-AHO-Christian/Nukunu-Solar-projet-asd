FROM node:22-slim

WORKDIR /app

# Install security updates (Debian-based)
RUN apt-get update && apt-get upgrade -y && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

COPY . .

WORKDIR /app/server
EXPOSE 3002

CMD ["node", "server.js"]
