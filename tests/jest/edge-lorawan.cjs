module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/edge-lorawan/**/*.test.ts'],
  roots: ['<rootDir>/tests/unit/edge-lorawan', '<rootDir>/packages/edge-lorawan/src'],
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  moduleFileExtensions: ['ts', 'js'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: {
    module: 'CommonJS', moduleResolution: 'node', allowJs: true, types: ['node', 'jest'],
  } }] },
  moduleNameMapper: {
    '^@totemsdk/edge-lorawan$': '<rootDir>/packages/edge-lorawan/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
