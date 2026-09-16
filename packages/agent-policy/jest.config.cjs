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
        types: ['node', 'jest'],
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
    '^@totemsdk/authority$': '<rootDir>/../authority/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/../proof/src/index.ts',
    '^@totemsdk/identity$': '<rootDir>/../identity/src/index.ts',
    '^@totemsdk/intelligence$': '<rootDir>/../intelligence/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/sqlite$': '<rootDir>/../storage/src/adapters/sqlite-store.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
