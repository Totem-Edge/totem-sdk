import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
// Vite config for standalone Totem UI development on port 6000
export default defineConfig({
  // Expose environment variables to the client
  define: {
    'import.meta.env.VITE_AXIA_API_URL': JSON.stringify(process.env.VITE_AXIA_API_URL || ''),
    'import.meta.env.VITE_AXIA_PROJECT_ID': JSON.stringify(process.env.VITE_AXIA_PROJECT_ID || ''),
    
    // DESIGNER_MODE: Compile-time constant for Designer/MockRPC features
    // This is the Vite equivalent of webpack's DefinePlugin for __DESIGNER_MODE__
    // Dev builds = true (enables mock RPC and Designer features)
    '__DESIGNER_MODE__': JSON.stringify(true),
    
    // Security: Allowed RPC hosts for development mode
    // Development builds include localhost for Designer testing
    // Note: PQ-TLS is automatically enabled via Cloudflare on all proxied domains
    '__ALLOWED_HOSTS__': JSON.stringify([
      'api.axia.to', 
      'rpc.axia.to',
      'localhost', 
      '127.0.0.1'
    ]),
    
    // Define process.env.NODE_ENV for consistency with webpack
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.env.WOTS_PARAMSET': JSON.stringify(process.env.WOTS_PARAMSET || 'v2-spec'),
    'process.env.WOTS_ALLOW_V1_DEV': JSON.stringify(process.env.WOTS_ALLOW_V1_DEV || ''),
  },
  
  plugins: [
    react(),
    nodePolyfills({
      // Polyfill Node.js globals for browser environment (needed for bip39, crypto libs)
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Include specific modules needed
      include: ['buffer', 'process', 'stream', 'util'],
    }),
    {
      name: 'totem-dev-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/totem-dev' || req.url === '/totem-dev/' || req.url === '/totem-dev/index.html') {
            req.url = '/totem-dev/dev-popup.html';
          }
          next();
        });
      },
    },
  ],
  
  base: '/totem-dev/',
  root: '.',
  publicDir: 'icons',
  
  server: {
    port: 6000,
    host: '0.0.0.0',
    strictPort: true,
    open: false,
    // Disable HMR completely to prevent auto-refresh during testing
    hmr: false,
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  
  build: {
    outDir: 'dist/totem-dev',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'dev-server.html'),
        popup: path.resolve(__dirname, 'dev-popup.html'),
      },
    },
  },
});
