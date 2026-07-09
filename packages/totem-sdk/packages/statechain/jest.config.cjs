module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transformIgnorePatterns: [
    'node_modules/\\.pnpm/(?!@noble)',
    'node_modules/(?!\\.pnpm|@noble)',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        allowJs: true,
        lib: ['ES2022'],
        target: 'ES2022',
        baseUrl: '.',
        paths: {
          '@totemsdk/core':           ['../core/src/index.ts'],
          '@totemsdk/wots-lease':     ['../wots-lease/src/index.ts'],
          '@totemsdk/tx-builder':     ['../tx-builder/src/index.ts'],
          '@totemsdk/txpow':          ['../txpow/src/index.ts'],
          '@totemsdk/chain-provider': ['../chain-provider/src/index.ts'],
        },
      },
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
    '^@totemsdk/wots-lease$':     '<rootDir>/../wots-lease/src/index.ts',
    '^@totemsdk/tx-builder$':     '<rootDir>/../tx-builder/src/index.ts',
    '^@totemsdk/txpow$':          '<rootDir>/../txpow/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/../chain-provider/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
