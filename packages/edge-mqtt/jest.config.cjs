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
        baseUrl: '.',
        paths: {
          '@totemsdk/core': ['../core/src/index.ts'],
          '@totemsdk/manifest': ['../manifest/src/index.ts'],
          '@totemsdk/identity': ['../identity/src/index.ts'],
          '@totemsdk/edge': ['../edge/src/index.ts'],
          '@totemsdk/proof': ['../proof/src/index.ts'],
          '@totemsdk/agent-policy': ['../agent-policy/src/index.ts'],
          '@totemsdk/storage/types': ['../storage/src/types.ts'],
          '@totemsdk/storage/journal': ['../storage/src/journal.ts'],
          '@totemsdk/storage/sqlite': ['../storage/src/adapters/sqlite-store.ts'],
          '@totemsdk/storage/fs': ['../storage/src/adapters/file-store.ts'],
          '@totemsdk/storage/memory': ['../storage/src/adapters/memory-store.ts'],
        },
      },
    }],
    '^.+\\.js$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        allowJs: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/../core/src/index.ts',
    '^@totemsdk/manifest$': '<rootDir>/../manifest/src/index.ts',
    '^@totemsdk/identity$': '<rootDir>/../identity/src/index.ts',
    '^@totemsdk/edge$': '<rootDir>/../edge/src/index.ts',
    '^@totemsdk/proof$': '<rootDir>/../proof/src/index.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/../agent-policy/src/index.ts',
    '^@totemsdk/storage$': '<rootDir>/../storage/src/index.ts',
    '^@totemsdk/storage/journal$': '<rootDir>/../storage/src/journal.ts',
    '^@totemsdk/storage/(.*)$': '<rootDir>/../storage/src/$1',
    '\\.\\./rust/pkg-node/edge_mqtt_wasm\\.js$': '<rootDir>/src/wasm-jest-mock.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
