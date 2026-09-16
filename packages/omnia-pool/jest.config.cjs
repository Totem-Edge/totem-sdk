module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
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
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/../agent-policy/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/../storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/sqlite$': '<rootDir>/../storage/src/adapters/sqlite-store.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/../storage/src/$1',
    '^@totemsdk/authority$': '<rootDir>/../authority/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/../proof/src/index.ts',
    '^@totemsdk/identity$': '<rootDir>/../identity/src/index.ts',
    '^@totemsdk/liquidity-bond$': '<rootDir>/../liquidity-bond/src/index.ts',
    '^@totemsdk/tx-builder$': '<rootDir>/../tx-builder/src/index.ts',
    '^@totemsdk/omnia$': '<rootDir>/../omnia/src/index.ts',
    '^@totemsdk/omnia-factory$': '<rootDir>/../omnia-factory/src/index.ts',
    '^@totemsdk/omnia-router$': '<rootDir>/../omnia-router/src/index.ts',
    '^@totemsdk/omnia-splice$': '<rootDir>/../omnia-splice/src/index.ts',
    '^@totemsdk/omnia-vtxo$': '<rootDir>/../omnia-vtxo/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/../wots-lease/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/../chain-provider/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
