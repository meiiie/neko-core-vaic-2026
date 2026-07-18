# Build stage — pinned Node LTS per docs/IMPLEMENTATION_MASTER_PLAN.md §3
FROM node:24.18.0-alpine AS build
WORKDIR /app
# The repository is intentionally excluded from the Docker context. Inject the
# immutable source revision at build time so the in-product version screen can
# identify the deployed artifact without shipping Git into the runtime image.
ARG GITHUB_SHA=dev
ENV GITHUB_SHA=${GITHUB_SHA}
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html eslint.config.js ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN npm run typecheck && npm run test -- --run && npm run build
# Boot smoke: resolve the SERVER module graph with plain Node ESM. Vite and
# vitest tolerate directory/extension-less imports that node cannot — twice
# on 18/07 that gap crash-looped production while every test was green.
RUN node --input-type=module -e "await import('./server/app.ts'); console.log('server module graph OK');"

# Runtime stage — Fastify serves /api and the built PWA on one origin.
FROM node:24.18.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
# Ship ALL of src: the server imports across src/content, src/domain and
# src/storage, and a hand-maintained allowlist already crash-looped
# production once (18/07) when a new cross-import landed.
COPY --from=build /app/src ./src
COPY package.json ./
RUN mkdir -p server/data && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "server/index.ts"]
