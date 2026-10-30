module.exports = {
  rootDir: '../..', preset: 'ts-jest', testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/pear/**/*.test.ts'],
  roots: ['<rootDir>/tests/unit/pear', '<rootDir>/packages/pear/src'],
  moduleFileExtensions: ['ts', 'js'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS', moduleResolution: 'node', allowJs: true, types: ['node','jest'] } }] },
  moduleNameMapper: {
    '^@totemsdk/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@totemsdk/storage/codec$': '<rootDir>/packages/storage/src/codec.ts',
    '^@totemsdk/storage/errors$': '<rootDir>/packages/storage/src/errors.ts',
    '^@totemsdk/storage/types$': '<rootDir>/packages/storage/src/types.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
