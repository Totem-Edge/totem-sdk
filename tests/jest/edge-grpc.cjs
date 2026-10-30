module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/edge-grpc/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transformIgnorePatterns: ['node_modules/'],
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
          '@totemsdk/stream-transport': ['../stream-transport/src/index.ts'],
        },
      },
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  moduleNameMapper: {
    '^@totemsdk/edge$': '<rootDir>/packages/edge/src/index.ts',
    '^@totemsdk/stream-transport$': '<rootDir>/packages/stream-transport/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
