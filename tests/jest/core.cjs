module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/core/**/*.test.ts'],
  roots: ['<rootDir>/tests/unit/core', '<rootDir>/packages/core/src'],
  modulePathIgnorePatterns: ['<rootDir>/packages/.*/dist/'],
  moduleFileExtensions: ['ts', 'js'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: {
    module: 'CommonJS', moduleResolution: 'bundler', target: 'ES2022', allowJs: true,
    types: ['node', 'jest'], baseUrl: '.', paths: { '@totemsdk/core': ['packages/core/src/index.ts'] },
  } }] },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@totemsdk/core$': '<rootDir>/packages/core/src/index.ts',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    'src/minima32.test.ts', 'src/minimaWireSerializer.test.ts', 'src/index.test.ts',
    'src/address.test.ts', 'src/addr.oracle.test.ts', 'src/mmr.oracle.test.ts', 'src/mx.test.ts',
    'test/wots_digits.test.ts', 'test/wots_java_compatibility.test.ts',
    'test/wots_pkdigest_golden.test.ts', 'test/wots_prf.test.ts', 'test/length.test.ts',
    'test/parity.test.ts', 'test/regression.test.ts', 'src/__tests__/wots-parity.test.ts',
  ],
};
