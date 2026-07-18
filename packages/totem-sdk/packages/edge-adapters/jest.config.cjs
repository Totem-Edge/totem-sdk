module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: { module: 'CommonJS', moduleResolution: 'node' },
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/edge$': '<rootDir>/../edge/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/../agent-policy/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/../chain-provider/src/index.ts',
    '^@totemsdk/identity$': '<rootDir>/../identity/src/index.ts',
    '^@totemsdk/manifest$': '<rootDir>/../manifest/src/index.ts',
    '^@totemsdk/omnia-router$': '<rootDir>/../omnia-router/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/../proof/src/index.ts',
    '^@totemsdk/lookup-client$': '<rootDir>/../lookup-client/src/index.ts',
    '^@totemsdk/root-identity$': '<rootDir>/../root-identity/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
