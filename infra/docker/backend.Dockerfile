FROM node:22-alpine

WORKDIR /app

# Install security updates (Alpine-based)
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

COPY . .

WORKDIR /app/server
EXPOSE 3002

CMD ["node", "server.js"]
