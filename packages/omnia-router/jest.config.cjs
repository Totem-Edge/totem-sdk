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
        baseUrl: '.',
        paths: {
          '@totemsdk/core': ['../core/src/index.ts'],
          '@totemsdk/storage': ['../storage/src/index.ts'],
          '@totemsdk/storage/snapshot': ['../storage/src/snapshot.ts'],
          '@totemsdk/storage/fs': ['../storage/src/adapters/file-store.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/snapshot$': '<rootDir>/../storage/src/snapshot.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/../storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/../storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
