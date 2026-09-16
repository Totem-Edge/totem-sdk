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
          '@totemsdk/storage': ['../storage/src/index.ts'],
          '@totemsdk/storage/errors': ['../storage/src/errors.ts'],
          '@totemsdk/storage/fs': ['../storage/src/adapters/file-store.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/lookup-protocol$': '<rootDir>/../lookup-protocol/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/../storage/src/errors.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/../storage/src/adapters/file-store.ts',
    '^@totemsdk/txpow$': '<rootDir>/../txpow/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
