FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src ./src
COPY services/api ./services/api
# Runtime data read by module-relative paths: config/partner-registry.json
# (grounding lookup_partner) and third_party/mirodan (actor-director generate).
COPY config ./config
COPY third_party ./third_party
EXPOSE 8080
CMD ["pnpm", "exec", "tsx", "services/api/server.ts"]
