module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
      },
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    // RFC-031: tests use the sync WASM bridge (no async init); production uses
    // the async `@totemsdk/core/wasm` entry.
    '^@totemsdk/core/wasm$': '<rootDir>/../core/src/wasm-sync.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
