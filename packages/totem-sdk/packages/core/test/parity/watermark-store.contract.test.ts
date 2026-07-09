/**
 * WatermarkStore Contract Tests
 * Tests SDK WatermarkStore against documented legacy behavior fixtures
 */

import { WatermarkStore, type WatermarkState, type WotsIndices } from '../../src/lease';
import { MockStorageAdapter, MockLogger, createParityTest, runParityTests } from './test-utils';

interface WatermarkScenario {
  name: string;
  input: {
    operation: string;
    currentIndices?: { addressIndex: number; l1: number; l2: number };
    localState?: { next_addressIndex: number; next_l1: number; next_l2: number };
    serverWatermark?: { addressIndex: number; l1: number; l2: number };
  };
  expectedOutput: {
    next_addressIndex: number;
    next_l1: number;
    next_l2: number;
    usedIndices?: number[][];
    updated?: boolean;
  };
}

interface WatermarkFixtures {
  description: string;
  version: string;
  scenarios: WatermarkScenario[];
}

const fixtures: WatermarkFixtures = require('./fixtures/watermark-store.fixtures.json');

describe('WatermarkStore Contract Tests (SDK vs Legacy Behavior)', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let watermarkStore: WatermarkStore;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    watermarkStore = new WatermarkStore(storage, logger, { storageKey: 'contract_test_watermark' });
  });

  afterEach(() => {
    storage.reset();
    logger.reset();
  });

  describe('Programmatic Fixture Validation', () => {
    test('all fixture scenarios produce matching outputs via parity runner', async () => {
      const tests = fixtures.scenarios.map(scenario => {
        return createParityTest(
          `[${scenario.name}] ${scenario.input.operation}`,
          async () => {
            if (scenario.input.operation === 'initialize') {
              return {
                next_addressIndex: scenario.expectedOutput.next_addressIndex,
                next_l1: scenario.expectedOutput.next_l1,
                next_l2: scenario.expectedOutput.next_l2,
                usedIndices: scenario.expectedOutput.usedIndices || [],
              };
            }
            if (scenario.input.operation === 'updateFromServer') {
              return {
                updated: scenario.expectedOutput.updated,
                next_addressIndex: scenario.expectedOutput.next_addressIndex,
                next_l1: scenario.expectedOutput.next_l1,
                next_l2: scenario.expectedOutput.next_l2,
              };
            }
            return {
              next_addressIndex: scenario.expectedOutput.next_addressIndex,
              next_l1: scenario.expectedOutput.next_l1,
              next_l2: scenario.expectedOutput.next_l2,
            };
          },
          async () => {
            const freshStorage = new MockStorageAdapter();
            const freshLogger = new MockLogger();
            const store = new WatermarkStore(freshStorage, freshLogger, { storageKey: 'fixture_test' });

            switch (scenario.input.operation) {
              case 'initialize': {
                const state = await store.initialize();
                return {
                  next_addressIndex: state.next_addressIndex,
                  next_l1: state.next_l1,
                  next_l2: state.next_l2,
                  usedIndices: state.usedIndices,
                };
              }
              case 'advanceWatermark': {
                const currentIndices = scenario.input.currentIndices!;
                await store.save({
                  next_addressIndex: currentIndices.addressIndex,
                  next_l1: currentIndices.l1,
                  next_l2: currentIndices.l2,
                  usedIndices: [],
                });
                await store.advanceWatermark(currentIndices as WotsIndices);
                const indices = store.getNextIndices()!;
                return {
                  next_addressIndex: indices.addressIndex,
                  next_l1: indices.l1,
                  next_l2: indices.l2,
                };
              }
              case 'updateFromServer': {
                const localState = scenario.input.localState!;
                const serverWatermark = scenario.input.serverWatermark!;
                await store.save({
                  next_addressIndex: localState.next_addressIndex,
                  next_l1: localState.next_l1,
                  next_l2: localState.next_l2,
                  usedIndices: [],
                });
                const result = await store.updateFromServer(serverWatermark as WotsIndices);
                const indices = store.getNextIndices()!;
                return {
                  updated: result.updated,
                  next_addressIndex: indices.addressIndex,
                  next_l1: indices.l1,
                  next_l2: indices.l2,
                };
              }
              default:
                throw new Error(`Unknown operation: ${scenario.input.operation}`);
            }
          }
        );
      });

      const { passed, failed, results } = await runParityTests(tests);

      console.log('='.repeat(60));
      console.log('WATERMARK STORE PARITY REPORT');
      console.log('='.repeat(60));
      console.log(`Fixtures tested: ${fixtures.scenarios.length}`);
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${failed}`);
      console.log('');

      results.forEach(r => {
        const status = r.passed ? '✓' : '✗';
        console.log(`${status} ${r.description}`);
        if (!r.passed && r.error) {
          console.log(`    Error: ${r.error}`);
        }
        if (!r.passed) {
          console.log(`    Expected: ${JSON.stringify(r.legacyOutput)}`);
          console.log(`    Actual:   ${JSON.stringify(r.sdkOutput)}`);
        }
      });
      console.log('='.repeat(60));

      expect(failed).toBe(0);
    });
  });

  describe('Individual Fixture Validation', () => {
    fixtures.scenarios.forEach(scenario => {
      test(`${scenario.name}: ${scenario.input.operation}`, async () => {
        switch (scenario.input.operation) {
          case 'initialize': {
            const state = await watermarkStore.initialize();
            expect(state.next_addressIndex).toBe(scenario.expectedOutput.next_addressIndex);
            expect(state.next_l1).toBe(scenario.expectedOutput.next_l1);
            expect(state.next_l2).toBe(scenario.expectedOutput.next_l2);
            break;
          }
          case 'advanceWatermark': {
            const currentIndices = scenario.input.currentIndices!;
            await watermarkStore.save({
              next_addressIndex: currentIndices.addressIndex,
              next_l1: currentIndices.l1,
              next_l2: currentIndices.l2,
              usedIndices: [],
            });
            await watermarkStore.advanceWatermark(currentIndices as WotsIndices);
            const indices = watermarkStore.getNextIndices()!;
            
            expect(indices.addressIndex).toBe(scenario.expectedOutput.next_addressIndex);
            expect(indices.l1).toBe(scenario.expectedOutput.next_l1);
            expect(indices.l2).toBe(scenario.expectedOutput.next_l2);
            break;
          }
          case 'updateFromServer': {
            const localState = scenario.input.localState!;
            const serverWatermark = scenario.input.serverWatermark!;
            await watermarkStore.save({
              next_addressIndex: localState.next_addressIndex,
              next_l1: localState.next_l1,
              next_l2: localState.next_l2,
              usedIndices: [],
            });
            const result = await watermarkStore.updateFromServer(serverWatermark as WotsIndices);
            const indices = watermarkStore.getNextIndices()!;
            
            expect(result.updated).toBe(scenario.expectedOutput.updated);
            expect(indices.addressIndex).toBe(scenario.expectedOutput.next_addressIndex);
            expect(indices.l1).toBe(scenario.expectedOutput.next_l1);
            expect(indices.l2).toBe(scenario.expectedOutput.next_l2);
            break;
          }
        }
      });
    });
  });
});
