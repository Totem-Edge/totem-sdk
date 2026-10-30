module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/lookup-client/**/*.test.ts'],
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
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/lookup-protocol$': '<rootDir>/packages/lookup-protocol/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/packages/chain-provider/src/index.ts',
    '^@totemsdk/root-identity$': '<rootDir>/packages/root-identity/src/index.ts',
    '^@totemsdk/replication$': '<rootDir>/packages/replication/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
