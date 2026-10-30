module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/edge/**/*.test.ts'],
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
        baseUrl: '.',
        paths: {
          '@totemsdk/storage/sqlite': ['../storage/src/adapters/sqlite-store.ts'],
          '@totemsdk/storage/fs': ['../storage/src/adapters/file-store.ts'],
          '@totemsdk/storage/memory': ['../storage/src/adapters/memory-store.ts'],
          '@totemsdk/storage/journal': ['../storage/src/journal.ts'],
          '@totemsdk/storage': ['../storage/src/index.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
    '^.+\\.js$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        allowJs: true,
        baseUrl: '.',
        paths: {
          '@totemsdk/storage/sqlite': ['../storage/src/adapters/sqlite-store.ts'],
          '@totemsdk/storage/fs': ['../storage/src/adapters/file-store.ts'],
          '@totemsdk/storage/memory': ['../storage/src/adapters/memory-store.ts'],
          '@totemsdk/storage/journal': ['../storage/src/journal.ts'],
          '@totemsdk/storage': ['../storage/src/index.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  modulePaths: ['<rootDir>/packages/edge/node_modules'],
  moduleNameMapper: {
    '^@totemsdk/edge$': '<rootDir>/packages/edge/src/index.ts',
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/manifest$': '<rootDir>/packages/manifest/src/index.ts',
    '^@totemsdk/identity$': '<rootDir>/packages/identity/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/packages/agent-policy/src/index.ts',
    '^@totemsdk/intelligence$': '<rootDir>/packages/intelligence/src/index.ts',
    '^@totemsdk/decision$': '<rootDir>/packages/decision/src/index.ts',
    '^@totemsdk/decision/testing$': '<rootDir>/packages/decision/src/testing/mock-provider.ts',
    '^@totemsdk/authority$': '<rootDir>/packages/authority/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/packages/proof/src/index.ts',
    '^@totemsdk/connect$': '<rootDir>/packages/connect/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/journal$': '<rootDir>/packages/storage/src/journal.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/packages/storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/memory$': '<rootDir>/packages/storage/src/adapters/memory-store.ts',
    '^@totemsdk/storage/sqlite$': '<rootDir>/packages/storage/src/adapters/sqlite-store.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/packages/storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
