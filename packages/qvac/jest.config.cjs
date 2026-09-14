module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^@totemsdk/intelligence$': '<rootDir>/../intelligence/src/index.ts',
    '^@totemsdk/intelligence/constants$': '<rootDir>/../intelligence/src/constants.ts',
    '^@totemsdk/intelligence/errors$': '<rootDir>/../intelligence/src/errors.ts',
    '^@totemsdk/intelligence/types$': '<rootDir>/../intelligence/src/types.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};