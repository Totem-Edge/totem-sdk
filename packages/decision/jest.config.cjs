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
    '^@totemsdk/replication$': '<rootDir>/../replication/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
