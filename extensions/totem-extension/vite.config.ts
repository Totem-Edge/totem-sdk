import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
export default defineConfig({
  plugins: [react(), nodePolyfills({ include: ['buffer','crypto','stream'] })],
  define: { global: 'globalThis' },
  build: {
    rollupOptions: {
      input: {
        popup: 'src/ui/popup/index.html',
        notify: 'src/ui/notify/index.html'
      }
    }
  }
});