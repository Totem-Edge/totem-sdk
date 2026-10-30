module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/omnia-pool/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transformIgnorePatterns: [
    'node_modules/',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        allowJs: true,
        lib: ['ES2022'],
        target: 'ES2022',
        baseUrl: '.',
        paths: {
          '@totemsdk/storage/sqlite': ['../storage/src/adapters/sqlite-store.ts'],
          '@totemsdk/storage': ['../storage/src/index.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/packages/agent-policy/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/packages/storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/sqlite$': '<rootDir>/packages/storage/src/adapters/sqlite-store.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/packages/storage/src/$1',
    '^@totemsdk/authority$': '<rootDir>/packages/authority/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/packages/proof/src/index.ts',
    '^@totemsdk/identity$': '<rootDir>/packages/identity/src/index.ts',
    '^@totemsdk/liquidity-bond$': '<rootDir>/packages/liquidity-bond/src/index.ts',
    '^@totemsdk/tx-builder$': '<rootDir>/packages/tx-builder/src/index.ts',
    '^@totemsdk/omnia$': '<rootDir>/packages/omnia/src/index.ts',
    '^@totemsdk/omnia-factory$': '<rootDir>/packages/omnia-factory/src/index.ts',
    '^@totemsdk/omnia-router$': '<rootDir>/packages/omnia-router/src/index.ts',
    '^@totemsdk/omnia-splice$': '<rootDir>/packages/omnia-splice/src/index.ts',
    '^@totemsdk/omnia-vtxo$': '<rootDir>/packages/omnia-vtxo/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/packages/wots-lease/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/packages/chain-provider/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
