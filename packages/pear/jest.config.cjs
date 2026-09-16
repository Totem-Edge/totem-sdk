module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        baseUrl: '.',
        paths: {
          '@totemsdk/storage': ['../storage/src/index.ts'],
          '@totemsdk/storage/codec': ['../storage/src/codec.ts'],
          '@totemsdk/storage/errors': ['../storage/src/errors.ts'],
          '@totemsdk/storage/types': ['../storage/src/types.ts'],
        },
      },
      diagnostics: { ignoreCodes: [2307] }, // workspace subpath exports resolved by moduleNameMapper
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/codec$': '<rootDir>/../storage/src/codec.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/../storage/src/errors.ts',
    '^@totemsdk/storage/types$': '<rootDir>/../storage/src/types.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
