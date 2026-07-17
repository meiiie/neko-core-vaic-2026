import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// PWA policy (docs/IMPLEMENTATION_MASTER_PLAN.md §8):
// - generateSW with prompt-for-update; never autoUpdate during an active diagnostic.
// - Precache the hashed app shell only. No runtime caching of /api/**.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'offline.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'NekoPath — Trợ giảng thích ứng',
        short_name: 'NekoPath',
        description:
          'Chẩn đoán khoảng trống kiến thức gốc và gợi ý lộ trình luyện tập từ dữ liệu đánh giá mẫu.',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f4f7fb',
        theme_color: '#0b234d',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        // The SPA fallback must never swallow future API routes.
        navigateFallbackDenylist: [/^\/api\//, /^\/healthz/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      // The virtual module only exists inside the Vite plugin pipeline.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
  },
});
