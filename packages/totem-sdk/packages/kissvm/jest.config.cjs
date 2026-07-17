module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        baseUrl: '.',
        paths: {
          '@totemsdk/core': ['../core/src/index.ts'],
        },
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/',
  ],
  moduleNameMapper: {
    '^@totemsdk/core-wasm': '<rootDir>/src/__mocks__/core-wasm-mock.ts',
    '^@totemsdk/core$': '<rootDir>/src/__mocks__/core-mock.ts',
    '^\\.\\./rust/pkg/kissvm_wasm\\.js$': '<rootDir>/src/__mocks__/kissvm-wasm.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
