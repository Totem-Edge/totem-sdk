module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/proof/**/*.test.ts'],
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
    '^.+\\.js$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        allowJs: true,
      },
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/manifest$': '<rootDir>/packages/manifest/src/index.ts',
    '^@totemsdk/identity$': '<rootDir>/packages/identity/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
