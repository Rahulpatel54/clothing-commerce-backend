# Multi-stage build: install once, run as a non-root user, keep the final image lean.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
# No lockfile is committed (see README); npm install resolves and caches it in the image.
RUN npm install --omit=dev

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

USER app
EXPOSE 4000

# Runs migrations then boots the API; the compose healthcheck below gives the DB
# time to accept connections before this loop stops retrying.
CMD ["sh", "-c", "until npx sequelize-cli db:migrate; do echo 'waiting for database...'; sleep 2; done; node src/server.js"]
