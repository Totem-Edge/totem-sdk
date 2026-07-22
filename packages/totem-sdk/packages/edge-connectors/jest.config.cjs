module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transformIgnorePatterns: ['node_modules/'],
  transform: {
    '^.+\\.(ts|js)$': ['@swc/jest', {
      module: { type: 'commonjs' },
      sourceMaps: 'inline',
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/edge$': '<rootDir>/../edge/src/index.ts',
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/manifest$': '<rootDir>/../manifest/src/index.ts',
    '^@totemsdk/identity$': '<rootDir>/../identity/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/../proof/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/../agent-policy/src/index.ts',
    '^@totemsdk/pubsub-transport$': '<rootDir>/../pubsub-transport/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
