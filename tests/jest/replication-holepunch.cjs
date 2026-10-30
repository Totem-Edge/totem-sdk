module.exports = {
  rootDir: '../..', preset: 'ts-jest', testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/qualification/replication-holepunch/**/*.test.ts'],
  roots: ['<rootDir>/tests/qualification/replication-holepunch', '<rootDir>/packages/replication-holepunch/src'],
  moduleFileExtensions: ['ts', 'js'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS', moduleResolution: 'node', allowJs: true, types: ['node','jest'] } }] },
  moduleNameMapper: {
    '^@totemsdk/replication$': '<rootDir>/packages/replication/src/index.ts',
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/artifacts/local-fs-backend$': '<rootDir>/packages/storage/src/artifacts/backends/local-fs-backend.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/packages/storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  modulePaths: ['<rootDir>/packages/replication-holepunch/node_modules'],
};
