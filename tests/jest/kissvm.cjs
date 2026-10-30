module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/kissvm/**/*.test.ts'],
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
    '^@totemsdk/core-wasm': '<rootDir>/packages/kissvm/src/__mocks__/core-wasm-mock.ts',
    '^@totemsdk/core$': '<rootDir>/packages/kissvm/src/__mocks__/core-mock.ts',
    '^\\.\\./rust/pkg/kissvm_wasm\\.js$': '<rootDir>/packages/kissvm/src/__mocks__/kissvm-wasm.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
