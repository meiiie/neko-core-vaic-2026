import fastifyStatic from '@fastify/static';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { buildApp } from './app.ts';
import { openDb } from './db.ts';
import { seed } from './seed.ts';

/**
 * Boot: open (and seed) the SQLite database, start the API, and — in
 * production — serve the built PWA from the same origin so cookies stay
 * first-party and no CORS surface exists.
 */

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '127.0.0.1'; // compose sets 0.0.0.0 behind Caddy
const DB_PATH = process.env.NEKOPATH_DB ?? 'server/data/nekopath.db';

mkdirSync('server/data', { recursive: true });
const db = openDb(DB_PATH);
seed(db);

// Uploaded learning resources persist beside the database on the same volume.
const app = buildApp(db, { resourcesDir: join(dirname(DB_PATH), 'resources') });

if (process.env.NODE_ENV === 'production') {
  await app.register(fastifyStatic, {
    root: resolve(process.cwd(), 'dist'),
    // Resolve hashed assets at request time. A production rebuild can change
    // filenames while this local server stays up.
    wildcard: true,
  });
  app.setNotFoundHandler((request, reply) => {
    const path = request.raw.url?.split('?', 1)[0] ?? '/';
    if (path.startsWith('/api/')) {
      void reply.code(404).send({ error: 'NOT_FOUND' });
      return;
    }
    if (path.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(path)) {
      void reply.code(404).type('text/plain').send('Not found');
      return;
    }
    void reply.sendFile('index.html');
  });
}

await app.listen({ port: PORT, host: HOST });
console.log(`NekoPath API listening on http://${HOST}:${PORT} (db: ${DB_PATH})`);
