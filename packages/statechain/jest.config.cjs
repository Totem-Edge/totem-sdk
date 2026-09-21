module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/src/__tests__/**/*.test.ts'],
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
          '@totemsdk/core':           ['../core/src/index.ts'],
          '@totemsdk/storage':        ['../storage/src/index.ts'],
          '@totemsdk/storage/fs':     ['../storage/src/adapters/file-store.ts'],
          '@totemsdk/storage/errors': ['../storage/src/errors.ts'],
          '@totemsdk/storage/snapshot': ['../storage/src/snapshot.ts'],
          '@totemsdk/storage/types':  ['../storage/src/types.ts'],
          '@totemsdk/wots-lease':     ['../wots-lease/src/index.ts'],
          '@totemsdk/kissvm/simulate': ['../kissvm/src/simulate.ts'],
          '@totemsdk/kissvm/witness': ['../kissvm/src/witness.ts'],
          '@totemsdk/kissvm/types':   ['../kissvm/src/types.ts'],
          '@totemsdk/tx-builder':     ['../tx-builder/src/index.ts'],
          '@totemsdk/txpow':          ['../txpow/src/index.ts'],
          '@totemsdk/chain-provider': ['../chain-provider/src/index.ts'],
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
  moduleNameMapper: {
    '^@totemsdk/core$':           '<rootDir>/../core/src/index.ts',
    '^@totemsdk/storage$':        '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/fs$':     '<rootDir>/../storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/../storage/src/errors.ts',
    '^@totemsdk/storage/(.*)$':   '<rootDir>/../storage/src/$1',
    '^@totemsdk/wots-lease$':     '<rootDir>/../wots-lease/src/index.ts',
    '^@totemsdk/kissvm/simulate$': '<rootDir>/../kissvm/src/simulate.ts',
    '^@totemsdk/kissvm/witness$': '<rootDir>/../kissvm/src/witness.ts',
    '^@totemsdk/kissvm/types$':   '<rootDir>/../kissvm/src/types.ts',
    '^@totemsdk/tx-builder$':     '<rootDir>/../tx-builder/src/index.ts',
    '^@totemsdk/txpow$':          '<rootDir>/../txpow/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/../chain-provider/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
