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
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/lookup-protocol$': '<rootDir>/../lookup-protocol/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/../chain-provider/src/index.ts',
    '^@totemsdk/minima-rpc$': '<rootDir>/../minima-rpc/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/../wots-lease/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/../storage/src/errors.ts',
    '^@totemsdk/txpow$': '<rootDir>/../txpow/src/index.ts',
    '^better-sqlite3$': '<rootDir>/src/better-sqlite3.mock.cjs',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
