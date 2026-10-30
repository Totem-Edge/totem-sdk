module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/lookup-node/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        baseUrl: '.',
        paths: {
          '@totemsdk/storage': ['../storage/src/index.ts'],
          '@totemsdk/storage/errors': ['../storage/src/errors.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  // The session-ticket/adversarial suites do real TreeKey derivation (WOTS), which
  // is CPU-heavy; running them alongside the timing-sensitive lease tests starves
  // those 1–2s waits. Cap parallelism so the suite is deterministic.
  maxWorkers: 2,
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/lookup-protocol$': '<rootDir>/packages/lookup-protocol/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/packages/chain-provider/src/index.ts',
    '^@totemsdk/minima-rpc$': '<rootDir>/packages/minima-rpc/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/packages/wots-lease/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/packages/storage/src/errors.ts',
    '^@totemsdk/txpow$': '<rootDir>/packages/txpow/src/index.ts',
    '^@totemsdk/manifest$': '<rootDir>/packages/manifest/src/index.ts',
    '^better-sqlite3$': '<rootDir>/packages/lookup-node/src/better-sqlite3.mock.cjs',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
