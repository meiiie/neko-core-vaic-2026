import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';

function buildCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

// PWA policy (docs/IMPLEMENTATION_MASTER_PLAN.md §8):
// - generateSW with prompt-for-update; never autoUpdate during an active diagnostic.
// - Precache the hashed app shell only. No runtime caching of /api/**.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'NekoPath — Trợ giảng thích ứng cho lớp học đa trình độ',
        short_name: 'NekoPath',
        description:
          'Giúp giáo viên nhận diện khoảng trống kiến thức nền, gợi ý lộ trình ngắn và nhóm nhu cầu lớp học từ dữ liệu đánh giá mẫu.',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F4F0E6',
        theme_color: '#006B61',
        icons: [
          { src: '/icons/nekopath-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/nekopath-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/nekopath-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // The 6MB WebLLM engine and worker chunks are teacher-only: keep them OUT of the
        // precache every student pays for, but cache it on first use so the
        // in-browser Gemma brain works offline afterwards (with its weights,
        // which WebLLM itself caches). Still no /api response caching.
        globIgnores: [
          '**/webllm*.js',
          '**/nekopath-share-v1.png',
          '**/nekopath-mark-v1.png',
          '**/icons/icon-192.png',
          '**/icons/icon-512.png',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        // The SPA fallback must never swallow future API routes.
        navigateFallbackDenylist: [/^\/api\//, /^\/healthz/],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/webllm(?:\.worker)?-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'webllm-engine' },
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('@mlc-ai/web-llm')) return 'webllm';
        },
      },
    },
  },
  optimizeDeps: {
    // Keep Vite's discovery inside the application. The cloned reference
    // repositories under ref/ have independent dependency graphs.
    entries: ['index.html'],
  },
  server: {
    proxy: { '/api': 'http://127.0.0.1:3001' },
    headers: {
      'Origin-Agent-Cluster': '?1',
      'Permissions-Policy': 'tools=(self)',
    },
  },
  preview: {
    proxy: { '/api': 'http://127.0.0.1:3001' },
    headers: {
      'Origin-Agent-Cluster': '?1',
      'Permissions-Policy': 'tools=(self)',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Reference repositories and UX/research labs are evidence, not part of
    // this application's test graph. In particular, ref/neko-core carries its
    // own Vitest suites and dependency assumptions.
    exclude: ['**/node_modules/**', '**/dist/**', 'ref/**', 'lab/**', 'labs/**'],
    alias: {
      // The virtual module only exists inside the Vite plugin pipeline.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
  },
});
