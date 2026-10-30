module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/wallet-adapter/**/*.test.ts'],
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
    '^@totemsdk/connect$': '<rootDir>/packages/connect/src/index.ts',
    '^@totemsdk/connect/wallet$': '<rootDir>/packages/connect/src/wallet.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};