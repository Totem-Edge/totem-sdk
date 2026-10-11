import { defineConfig } from 'vite';
import { resolve } from 'path';

const WALLET_ORIGIN = process.env.VITE_WALLET_ORIGIN ?? 'https://wallet.totem.ing';

// Node-only modules reached through the Omnia closure but never taken by the
// browser relay path (RFC-034 A4). Rewrite them (and `node:*` builtins) to a
// throw-on-load shim so the guarded fallbacks run instead of failing the build.
const NODE_ONLY_PACKAGES = ['hyperswarm', 'sodium-native', 'sodium-universal', 'ws'];
const emptyNodeModule = resolve(__dirname, 'empty-node-module.js');

export default defineConfig({
  define: {
    // __WALLET_ORIGIN__ is a standard esbuild/Vite identifier injection.
    // provider-entry.ts reads: const WALLET_ORIGIN: string = __WALLET_ORIGIN__;
    __WALLET_ORIGIN__: JSON.stringify(WALLET_ORIGIN),
  },
  resolve: {
    conditions: ['import', 'require', 'browser', 'default'],
    alias: [
      { find: /^node:.*$/, replacement: emptyNodeModule },
      {
        find: new RegExp(`^(${NODE_ONLY_PACKAGES.join('|')})$`),
        replacement: emptyNodeModule,
      },
      // kissvm's Rust wasm is an optional accelerator (guarded require + TS
      // fallback); its wasm init uses top-level await, which the provider IIFE
      // format cannot express. Shim it so kissvm falls back to TypeScript.
      { find: '../rust/pkg/kissvm_wasm.js', replacement: emptyNodeModule },
    ],
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
