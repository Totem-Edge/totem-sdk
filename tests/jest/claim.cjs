module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/claim/**/*.test.ts'],
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
        lib: ['ES2022'],
        target: 'ES2022',
        baseUrl: '.',
      },
      diagnostics: false,
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  modulePaths: ['<rootDir>/packages/claim/node_modules'],
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/claim$': '<rootDir>/packages/claim/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
