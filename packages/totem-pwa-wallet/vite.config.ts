import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { realpathSync } from 'fs';
import { createRequire } from 'module';

// Resolve @noble/hashes to the real CJS path — required because
// @totemsdk/core imports '@noble/hashes/sha3' without .js extension and
// pnpm may hoist the package to the workspace root.
let nobleHashesDir: string;
try {
  const req = createRequire(import.meta.url ?? __filename);
  const sha3CjsPath = req.resolve('@noble/hashes/sha3');
  nobleHashesDir = realpathSync(resolve(sha3CjsPath, '..'));
} catch {
  const fallbacks = [
    resolve(__dirname, '../../node_modules/@noble/hashes'),
    resolve(__dirname, 'node_modules/@noble/hashes'),
  ];
  nobleHashesDir = fallbacks[0];
  for (const candidate of fallbacks) {
    try { nobleHashesDir = realpathSync(candidate); break; } catch { /* try next */ }
  }
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.axia\.to\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'axia-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['@totemsdk/core', '@totemsdk/realtime', '@totemsdk/root-identity'],
  },
  resolve: {
    // Tell Rollup which export conditions to use when resolving workspace
    // packages whose package.json uses "import"/"require" but not "browser".
    conditions: ['import', 'require', 'browser', 'default'],
    alias: [
      {
        find: /^@noble\/hashes\/(.+?)(\.js)?$/,
        replacement: `${nobleHashesDir}/$1.js`,
      },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/totem-sdk/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        connect: resolve(__dirname, 'approval/connect.html'),
        verify: resolve(__dirname, 'approval/verify.html'),
        send: resolve(__dirname, 'approval/send.html'),
        'protocol-handler': resolve(__dirname, 'approval/protocol-handler.html'),
      },
    },
  },
  worker: {
    format: 'es',
  },
});
