export default {
  extensionsToTreatAsEsm: ['.ts'],
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'nodenext',
          moduleResolution: 'nodenext',
          esModuleInterop: true,
          isolatedModules: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    // Strip .js extensions from relative imports so ts-jest can resolve .ts files.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // @totemsdk/core resolves to its pre-built ESM dist (via the exports field).
  // @noble/* also ships ESM — both are excluded from the ignore pattern so
  // jest-runtime can load them as native ESM modules.
  // Only @totemsdk/* packages need special handling; @noble/* is native ESM
  // and must NOT be in the exception list (it must be loaded natively, not
  // re-processed by ts-jest which has no .js transform defined).
  transformIgnorePatterns: [
    'node_modules/',
  ],
  // WOTS TreeKey generation is compute-intensive (CPU-bound crypto).
  // Allow up to 5 minutes per test so CI environments can complete all tests.
  testTimeout: 300_000,
};
