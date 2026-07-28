/**
 * Parity Test Suite Entry Point
 * 
 * This module provides a comprehensive test harness for comparing
 * SDK implementations against expected behavior captured in fixtures.
 * 
 * The fixtures document legacy Totem Wallet behavior, enabling safe migration.
 * 
 * Test files:
 * - *.parity.test.ts: Unit tests for SDK components
 * - *.contract.test.ts: Contract tests comparing SDK to fixture-defined behavior
 * 
 * Run all parity tests: npm test -- --testPathPattern=parity
 */

export * from './test-utils';

export const PARITY_TEST_SUITES = [
  'lease-store.parity.test.ts',
  'lease-store.contract.test.ts',
  'watermark-store.parity.test.ts',
  'watermark-store.contract.test.ts',
  'transaction-service.parity.test.ts',
];

export const FIXTURES = {
  leaseStore: { 
    path: './fixtures/lease-store.fixtures.json', 
    implemented: true, 
    package: 'sdk-core',
    tests: 3,
    note: 'save, updateStatus, cleanupExpired operations validated'
  },
  watermarkStore: { 
    path: './fixtures/watermark-store.fixtures.json', 
    implemented: true, 
    package: 'sdk-core',
    tests: 6,
    note: 'initialize, advanceWatermark overflow scenarios, server sync validated'
  },
  balanceCache: { 
    path: './fixtures/balance-cache.fixtures.json', 
    implemented: true, 
    package: 'sdk-realtime',
    tests: 5,
    testLocation: 'sdk-tests/test/parity/balance-cache.parity.test.ts',
    note: 'store_and_retrieve, expiry_after_max_age, in_memory_cache_first, cleanup, clear operations validated' 
  },
  rpcClient: { 
    path: './fixtures/rpc-client.fixtures.json', 
    implemented: true, 
    package: 'sdk-client',
    tests: 5,
    testLocation: 'sdk-tests/test/parity/rpc-client.parity.test.ts',
    note: 'successful_rpc_call, retry_on_500, quota_exceeded_error, network_error_retry, parse_quota_headers validated' 
  },
};

export interface ParitySummary {
  totalSuites: number;
  totalTests: number;
  passed: number;
  failed: number;
  coverage: {
    leaseStore: boolean;
    watermarkStore: boolean;
    transactionService: boolean;
    balanceCache: boolean;
    rpcClient: boolean;
  };
  fixtureValidation: {
    leaseStore: boolean;
    watermarkStore: boolean;
    balanceCache: boolean;
    rpcClient: boolean;
  };
}

export function generateParityReport(summary: ParitySummary): string {
  const lines = [
    '='.repeat(60),
    'SDK PARITY TEST REPORT',
    '='.repeat(60),
    '',
    `Total Suites: ${summary.totalSuites}`,
    `Total Tests: ${summary.totalTests}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
    '',
    'Unit Test Coverage:',
    `  LeaseStore:          ${summary.coverage.leaseStore ? '✓' : '✗'}`,
    `  WatermarkStore:      ${summary.coverage.watermarkStore ? '✓' : '✗'}`,
    `  TransactionService:  ${summary.coverage.transactionService ? '✓' : '✗'}`,
    `  BalanceCache:        ${summary.coverage.balanceCache ? '✓' : '✗'}`,
    `  RPC Client:          ${summary.coverage.rpcClient ? '✓' : '✗'}`,
    '',
    'Fixture Validation (Legacy Behavior):',
    `  LeaseStore:          ${summary.fixtureValidation.leaseStore ? '✓' : '✗'}`,
    `  WatermarkStore:      ${summary.fixtureValidation.watermarkStore ? '✓' : '✗'}`,
    `  BalanceCache:        ${summary.fixtureValidation.balanceCache ? '✓' : '✗'}`,
    `  RPC Client:          ${summary.fixtureValidation.rpcClient ? '✓' : '✗'}`,
    '',
    summary.failed === 0
      ? '✓ All parity tests passed - safe to migrate'
      : '✗ Parity tests failed - review differences before migration',
    '='.repeat(60),
  ];
  
  return lines.join('\n');
}

export function isMigrationSafe(summary: ParitySummary): boolean {
  const allTestsPassed = summary.failed === 0;
  const coreModulesHaveFixtures =
    summary.fixtureValidation.leaseStore &&
    summary.fixtureValidation.watermarkStore;
  
  return allTestsPassed && coreModulesHaveFixtures;
}

export function getImplementedFixtures(): string[] {
  return Object.entries(FIXTURES)
    .filter(([, config]) => (config as any).implemented)
    .map(([name]) => name);
}

export function getPendingFixtures(): Array<{ name: string; note: string }> {
  return Object.entries(FIXTURES)
    .filter(([, config]) => !(config as any).implemented)
    .map(([name, config]) => ({ name, note: (config as any).note || '' }));
}
