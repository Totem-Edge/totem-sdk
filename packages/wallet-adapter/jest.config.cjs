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
        types: ['jest', 'node'],
      },
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/connect$': '<rootDir>/../connect/src/index.ts',
    '^@totemsdk/connect/wallet$': '<rootDir>/../connect/src/wallet.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};