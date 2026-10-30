module.exports = {
  modulePaths: ['<rootDir>/packages/p2p-hub/node_modules'],
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit/p2p-hub', '<rootDir>/packages/p2p-hub/src'],
  testMatch: ['<rootDir>/tests/unit/p2p-hub/**/*.test.ts'],
};
