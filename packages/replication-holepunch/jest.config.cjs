module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        target: 'ES2022',
        lib: ['ES2022'],
        esModuleInterop: true,
        skipLibCheck: true,
      },
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/replication$': '<rootDir>/../replication/src/index.ts',
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/artifacts/local-fs-backend$': '<rootDir>/../storage/src/artifacts/backends/local-fs-backend.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/../storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
