module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/vtxo/**/*.test.ts'],
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
      diagnostics: false, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  modulePaths: ['<rootDir>/packages/vtxo/node_modules'],
  moduleNameMapper: {
    '^@totemsdk/claim$': '<rootDir>/packages/claim/src/index.ts',
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/packages/storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/packages/storage/src/$1',
    '^@totemsdk/vtxo$': '<rootDir>/packages/vtxo/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
