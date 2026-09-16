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
        lib: ['ES2022'],
        target: 'ES2022',
        baseUrl: '.',
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/../storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/../storage/src/$1',
    '^@totemsdk/omnia-vtxo$': '<rootDir>/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
