FROM node:22-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci

COPY . .

WORKDIR /app/server
EXPOSE 3002

CMD ["node", "server.js"]
