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
  // TreeKey/WOTS derivation is CPU-heavy; cap parallelism so identity/ticket
  // tests are not starved by other workers.
  maxWorkers: 2,
  testTimeout: 20_000,
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/lookup-protocol$': '<rootDir>/../lookup-protocol/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/../chain-provider/src/index.ts',
    '^@totemsdk/root-identity$': '<rootDir>/../root-identity/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
