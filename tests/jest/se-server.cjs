module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/se-server/**/*.test.ts'],
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
        esModuleInterop: true,
        baseUrl: '.',
        paths: {
          '@totemsdk/core': ['../core/src/index.ts'],
          '@totemsdk/root-identity': ['../root-identity/src/index.ts'],
          '@totemsdk/wots-lease': ['../wots-lease/src/index.ts'],
          '@totemsdk/txpow': ['../txpow/src/index.ts'],
          '@totemsdk/storage': ['../storage/src/index.ts'],
          '@totemsdk/storage/errors': ['../storage/src/errors.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] },
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/root-identity$': '<rootDir>/packages/root-identity/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/packages/wots-lease/src/index.ts',
    '^@totemsdk/txpow$': '<rootDir>/packages/txpow/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/packages/storage/src/errors.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/packages/storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
