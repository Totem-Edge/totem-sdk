module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/server/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        baseUrl: '.',
        paths: {
          '@totemsdk/storage/sqlite': ['../storage/src/adapters/sqlite-store.ts'],
          '@totemsdk/storage': ['../storage/src/index.ts'],
          '@totemsdk/storage/fs': ['../storage/src/adapters/file-store.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/txpow$': '<rootDir>/packages/txpow/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/packages/storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/sqlite$': '<rootDir>/packages/storage/src/adapters/sqlite-store.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
