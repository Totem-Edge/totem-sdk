module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/kissvm-parity/**/*.test.ts'],
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
  transformIgnorePatterns: ['node_modules/'],
  moduleNameMapper: {
    '^@totemsdk/core/wasm$': '<rootDir>/packages/core/src/wasm-sync.ts',
    '^@totemsdk/core/scripts$': '<rootDir>/packages/core/src/scripts/index.ts',
    // No core mock here: these fixtures exercise real WOTS/tree verification.
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/kissvm$': '<rootDir>/packages/kissvm/src/index.ts',
    '^@totemsdk/omnia$': '<rootDir>/packages/omnia/src/index.ts',
    '^@totemsdk/tx-builder$': '<rootDir>/packages/tx-builder/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
