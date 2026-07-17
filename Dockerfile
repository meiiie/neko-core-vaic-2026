# Build stage — pinned Node LTS per docs/IMPLEMENTATION_MASTER_PLAN.md §3
FROM node:24.18.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html eslint.config.js ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN npm run typecheck && npm run test -- --run && npm run build

# Runtime stage — Fastify serves /api and the built PWA on one origin.
FROM node:24.18.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/content ./src/content
COPY --from=build /app/src/domain ./src/domain
COPY package.json ./
RUN mkdir -p server/data && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "server/index.ts"]
