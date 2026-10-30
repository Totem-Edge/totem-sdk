module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/storage/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: { module: 'CommonJS', moduleResolution: 'node' },
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};