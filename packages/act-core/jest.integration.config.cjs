module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/integration/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transformIgnorePatterns: ['node_modules/'],
  transform: {
    '^.+\\.(ts|js)$': ['@swc/jest', {
      module: { type: 'commonjs' },
      sourceMaps: 'inline',
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/../proof/src/index.ts',
    '^@totemsdk/edge$': '<rootDir>/../edge/src/index.ts',
    '^@totemsdk/authority$': '<rootDir>/../authority/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/../agent-policy/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/../storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/../storage/src/errors.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/../storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
