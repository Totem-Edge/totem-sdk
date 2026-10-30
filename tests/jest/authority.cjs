module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/authority/**/*.test.ts'],
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
        skipLibCheck: true,
      },
      diagnostics: false,
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
    '^@totemsdk/proof$': '<rootDir>/packages/proof/src/index.ts',
    '^@totemsdk/identity$': '<rootDir>/packages/identity/src/index.ts',
    '^@totemsdk/root-identity$': '<rootDir>/packages/root-identity/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
