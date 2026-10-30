module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/decision/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: { module: 'CommonJS', moduleResolution: 'node' },
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/replication$': '<rootDir>/packages/replication/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
