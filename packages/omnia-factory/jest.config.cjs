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
          '@totemsdk/omnia':          ['../omnia/src/index.ts'],
          '@totemsdk/wots-lease':     ['../wots-lease/src/index.ts'],
          '@totemsdk/tx-builder':     ['../tx-builder/src/index.ts'],
          '@totemsdk/txpow':          ['../txpow/src/index.ts'],
          '@totemsdk/chain-provider': ['../chain-provider/src/types.ts'],
          '@totemsdk/agent-policy':   ['../agent-policy/src/types.ts'],
          '@totemsdk/lookup-protocol':['../lookup-protocol/src/index.ts'],
          '@totemsdk/storage':        ['../storage/src/index.ts'],
          '@totemsdk/storage/snapshot': ['../storage/src/snapshot.ts'],
          '@totemsdk/storage/fs':     ['../storage/src/adapters/file-store.ts'],
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
    '^@totemsdk/core$':            '<rootDir>/../core/src/index.ts',
    '^@totemsdk/omnia$':           '<rootDir>/../omnia/src/index.ts',
    '^@totemsdk/wots-lease$':      '<rootDir>/../wots-lease/src/index.ts',
    '^@totemsdk/tx-builder$':      '<rootDir>/../tx-builder/src/index.ts',
    '^@totemsdk/txpow$':           '<rootDir>/../txpow/src/index.ts',
    '^@totemsdk/chain-provider$':  '<rootDir>/../chain-provider/src/types.ts',
    '^@totemsdk/agent-policy$':    '<rootDir>/../agent-policy/src/types.ts',
    '^@totemsdk/lookup-protocol$': '<rootDir>/../lookup-protocol/src/index.ts',
    '^@totemsdk/storage$':         '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/snapshot$':'<rootDir>/../storage/src/snapshot.ts',
    '^@totemsdk/storage/fs$':      '<rootDir>/../storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/(.*)$':    '<rootDir>/../storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
