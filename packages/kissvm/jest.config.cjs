module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      diagnostics: false,
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        target: 'ES2022',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        allowJs: true,
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
