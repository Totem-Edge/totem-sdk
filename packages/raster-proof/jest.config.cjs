module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transformIgnorePatterns: [
    'node_modules/',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        allowJs: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/../proof/src/index.ts',
    '^@totemsdk/proofgraph$': '<rootDir>/../proofgraph/src/index.ts',
    '^@totemsdk/spatial-proof$': '<rootDir>/../spatial-proof/src/index.ts',
    '^@totemsdk/location-proof$': '<rootDir>/../location-proof/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
