module.exports = {
  rootDir: '../..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/act-mavlink/**/*.test.ts'],
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
      diagnostics: { ignoreCodes: [2307] },
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/act-core$': '<rootDir>/packages/act-core/src/index.ts',
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/packages/proof/src/index.ts',
    '^@totemsdk/edge$': '<rootDir>/packages/edge/src/index.ts',
    '^@totemsdk/authority$': '<rootDir>/packages/authority/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/packages/agent-policy/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/packages/storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/packages/storage/src/errors.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/packages/storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
