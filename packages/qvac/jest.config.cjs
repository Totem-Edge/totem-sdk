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
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/artifacts$': '<rootDir>/../storage/src/artifacts/index.ts',
    '^@totemsdk/storage/artifacts/local-fs-backend$': '<rootDir>/../storage/src/artifacts/backends/local-fs-backend.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};