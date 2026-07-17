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
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
