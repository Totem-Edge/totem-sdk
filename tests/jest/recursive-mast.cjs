module.exports = {
  rootDir: '../..',
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit/recursive-mast', '<rootDir>/packages/recursive-mast/src'],
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['<rootDir>/tests/unit/recursive-mast/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/kissvm$': '<rootDir>/packages/kissvm/src/index.ts',
    '^@totemsdk/lookup-client$': '<rootDir>/packages/lookup-client/src/index.ts',
    '^@totemsdk/omnia$': '<rootDir>/packages/omnia/src/index.ts',
    '^@totemsdk/recursive-mast$': '<rootDir>/packages/recursive-mast/src/index.ts',
    '^@totemsdk/tx-builder$': '<rootDir>/packages/tx-builder/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/packages/wots-lease/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 10000,
};
