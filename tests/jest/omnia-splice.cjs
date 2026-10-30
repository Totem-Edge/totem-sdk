module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/omnia-splice/**/*.test.ts'],
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
        lib: ['ES2022', 'DOM'],
        target: 'ES2022',
        baseUrl: '.',
        paths: {
          '@totemsdk/core':       ['../core/src/index.ts'],
          '@totemsdk/wots-lease': ['../wots-lease/src/index.ts'],
          '@totemsdk/txpow':      ['../txpow/src/index.ts'],
          '@totemsdk/tx-builder': ['../tx-builder/src/index.ts'],
          '@totemsdk/omnia':      ['../omnia/src/index.ts'],
          '@totemsdk/storage':    ['../storage/src/index.ts'],
          '@totemsdk/storage/snapshot': ['../storage/src/snapshot.ts'],
          '@totemsdk/storage/fs': ['../storage/src/adapters/file-store.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
    '^.+\\.js$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        allowJs: true,
      },
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  moduleNameMapper: {
    '^@totemsdk/core$':       '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/packages/wots-lease/src/index.ts',
    '^@totemsdk/txpow$':      '<rootDir>/packages/txpow/src/index.ts',
    '^@totemsdk/tx-builder$': '<rootDir>/packages/tx-builder/src/index.ts',
    '^@totemsdk/omnia$':      '<rootDir>/packages/omnia/src/index.ts',
    '^@totemsdk/storage$':      '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/snapshot$': '<rootDir>/packages/storage/src/snapshot.ts',
    '^@totemsdk/storage/fs$':   '<rootDir>/packages/storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/packages/storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
