module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/edge-mavlink/**/*.test.ts'],
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
        },
      },
    }],
  },
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  moduleNameMapper: {
    '^@totemsdk/act-core$': '<rootDir>/packages/act-core/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/packages/agent-policy/src/index.ts',
    '^@totemsdk/agent-policy/settlement$': '<rootDir>/packages/agent-policy/src/settlement.ts',
    '^@totemsdk/authority$': '<rootDir>/packages/authority/src/index.ts',
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/edge$': '<rootDir>/packages/edge/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/packages/proof/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/sqlite$': '<rootDir>/packages/storage/src/adapters/sqlite-store.ts',
    '^@totemsdk/storage/fs$': '<rootDir>/packages/storage/src/adapters/file-store.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/packages/storage/src/errors.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/packages/storage/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
