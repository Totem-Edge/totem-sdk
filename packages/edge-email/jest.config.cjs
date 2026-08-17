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
          types: ['node', 'jest'],
          baseUrl: '.',
        paths: {
          '@totemsdk/edge': ['../edge/src/index.ts'],
        },
      },
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/edge$': '<rootDir>/../edge/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};