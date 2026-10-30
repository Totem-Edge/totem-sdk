module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/qvac/**/*.test.ts'],
  roots: ['<rootDir>/tests/unit/qvac', '<rootDir>/packages/qvac/src'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/packages/qvac/tsconfig.jest.json', diagnostics: false }],
  },
  modulePaths: ['<rootDir>/packages/qvac/node_modules', '<rootDir>/packages/replication-holepunch/node_modules'],
  moduleNameMapper: {
    '^@totemsdk/intelligence$': '<rootDir>/packages/intelligence/src/index.ts',
    '^@totemsdk/intelligence/constants$': '<rootDir>/packages/intelligence/src/constants.ts',
    '^@totemsdk/intelligence/errors$': '<rootDir>/packages/intelligence/src/errors.ts',
    '^@totemsdk/intelligence/types$': '<rootDir>/packages/intelligence/src/types.ts',
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/artifacts$': '<rootDir>/packages/storage/src/artifacts/index.ts',
    '^@totemsdk/storage/artifacts/local-fs-backend$': '<rootDir>/packages/storage/src/artifacts/backends/local-fs-backend.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};