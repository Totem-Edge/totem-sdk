module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/omnia/**/*.test.ts'],
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
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  modulePaths: ['<rootDir>/packages/omnia/node_modules'],
  moduleNameMapper: {
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
    '^@totemsdk/tx-builder$': '<rootDir>/packages/tx-builder/src/index.ts',
    '^@totemsdk/txpow$': '<rootDir>/packages/txpow/src/index.ts',
    '^@totemsdk/wots-lease$': '<rootDir>/packages/wots-lease/src/index.ts',
    '^@totemsdk/chain-provider$': '<rootDir>/packages/chain-provider/src/types.ts',
    '^@totemsdk/agent-policy$': '<rootDir>/packages/agent-policy/src/types.ts',
    '^@totemsdk/stream-transport$': '<rootDir>/packages/stream-transport/src/index.ts',
    '^@totemsdk/lookup-protocol$': '<rootDir>/packages/lookup-protocol/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
