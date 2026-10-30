import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: {
    alias: {
      '@totemsdk/core/adapters': fileURLToPath(new URL('../../packages/core/src/adapters/index.ts', import.meta.url)),
      '@totemsdk/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/realtime/**/*.test.ts'],
  },
});
