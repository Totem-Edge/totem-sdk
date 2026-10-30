module.exports = {
  rootDir: '../..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/industrial-action/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transformIgnorePatterns: [
    'node_modules/',
  ],
  transform: {
    '^.+\\.(ts|js)$': ['@swc/jest', {
      module: {
        type: 'commonjs',
      },
      sourceMaps: 'inline',
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/packages/proof/src/index.ts',
    '^@totemsdk/edge$': '<rootDir>/packages/edge/src/index.ts',
    '^@totemsdk/authority$': '<rootDir>/packages/authority/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/packages/agent-policy/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/packages/storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/packages/storage/src/errors.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/packages/storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
