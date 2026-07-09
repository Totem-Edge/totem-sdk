export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts', '**/src/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    // Force jest to load TypeScript sources instead of pre-compiled .js stubs
    // in src/. Without this, imports like '../treekey.js' resolve to the
    // stale pre-compiled src/treekey.js rather than the current src/treekey.ts.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    // vitest-based tests — incompatible with jest runner
    'src/minima32.test.ts',
    'src/minimaWireSerializer.test.ts',
    'src/index.test.ts',
    'src/address.test.ts',
    'src/addr.oracle.test.ts',
    'src/mmr.oracle.test.ts',
    'src/mx.test.ts',
    'test/wots_digits.test.ts',
    'test/wots_java_compatibility.test.ts',
    'test/wots_pkdigest_golden.test.ts',
    'test/wots_prf.test.ts',
    'test/length.test.ts',
    // stale tests targeting a superseded WOTS API (old L=89/w=8 base-8 params
    // and full-pubkey return; current impl uses L=34 byte-per-digit and digest)
    'test/parity.test.ts',
    'test/regression.test.ts',
    'src/__tests__/wots-parity.test.ts',
  ],
};
