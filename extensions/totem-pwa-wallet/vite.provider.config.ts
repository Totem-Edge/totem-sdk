import { defineConfig } from 'vite';
import { resolve } from 'path';

const WALLET_ORIGIN = process.env.VITE_WALLET_ORIGIN ?? 'https://wallet.totem.ing';

export default defineConfig({
  define: {
    // __WALLET_ORIGIN__ is a standard esbuild/Vite identifier injection.
    // provider-entry.ts reads: const WALLET_ORIGIN: string = __WALLET_ORIGIN__;
    __WALLET_ORIGIN__: JSON.stringify(WALLET_ORIGIN),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/provider/provider-entry.ts'),
      name: 'TotemProvider',
      fileName: () => 'provider.js',
      formats: ['iife'],
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
