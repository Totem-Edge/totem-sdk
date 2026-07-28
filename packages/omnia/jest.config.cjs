module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/src/__tests__/**/*.test.ts'],
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
    '^@totemsdk/tx-builder$': '<rootDir>/../tx-builder/src/index.ts',
    '^@totemsdk/txpow$': '<rootDir>/../txpow/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/../wots-lease/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/../chain-provider/src/types.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/../agent-policy/src/types.ts',
    '^@totemsdk/stream-transport$': '<rootDir>/../stream-transport/src/index.ts',
    '^@totemsdk/lookup-protocol$': '<rootDir>/../lookup-protocol/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
