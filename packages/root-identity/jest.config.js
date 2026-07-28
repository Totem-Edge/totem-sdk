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
  // Only @totemsdk/* packages need special handling.
  transformIgnorePatterns: [
    'node_modules/',
  ],
  // WOTS TreeKey generation is compute-intensive (CPU-bound crypto).
  // Allow up to 5 minutes per test so CI environments can complete all tests.
  testTimeout: 300_000,
};
