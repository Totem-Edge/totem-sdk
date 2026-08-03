module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/kissvm$': '<rootDir>/../kissvm/src/index.ts',
    '^@totemsdk/lookup-client$': '<rootDir>/../lookup-client/src/index.ts',
    '^@totemsdk/omnia$': '<rootDir>/../omnia/src/index.ts',
    '^@totemsdk/recursive-mast$': '<rootDir>/src/index.ts',
    '^@totemsdk/tx-builder$': '<rootDir>/../tx-builder/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/../wots-lease/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 10000,
};
