# ================================
# Stage 1: Build
# ================================
FROM oven/bun:1 AS builder

WORKDIR /app

# The API base URL is baked in at build time (Vite inlines VITE_* vars).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ================================
# Stage 2: Production
# ================================
FROM oven/bun:1-alpine AS production

WORKDIR /app

COPY --from=builder /app/.output ./.output

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
