module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit/replication', '<rootDir>/packages/replication/src'],
  testMatch: ['<rootDir>/tests/unit/replication/**/*.test.ts'],
};
