import { OperationStore } from '../stores/operations.js';
import { withOperation } from '../api/methods.js';
import type { HostApiContext } from '../api/methods.js';

/**
 * OMN-075 / OMN-076 / OMN-077 — the host's idempotency boundary.
 *
 * These run against the real SQLite-backed `OperationStore` rather than a mock,
 * because the defects were in the interaction between the store's method
 * receiver, the observer and the state machine. A mocked store hid all three.
 */

function context(store: OperationStore, emit?: (event: unknown) => Promise<void>): HostApiContext {
  return {
    operations: store,
    ...(emit ? { observe: { emit: emit as never } } : {}),
  } as unknown as HostApiContext;
}

const params = { operationId: 'op-1', channelId: 'chan-1' };

describe('withOperation idempotency', () => {
  it('returns the committed result on retry instead of throwing (OMN-075)', async () => {
    const store = new OperationStore(':memory:');
    const ctx = context(store);
    const run = jest.fn(async () => ({ channelId: 'chan-1' }));

    const first = await withOperation(ctx, params, run);
    const second = await withOperation(ctx, params, run);

    expect(second).toEqual(first);
    expect(run).toHaveBeenCalledTimes(1);
    store.close();
  });

  it('rejects a retry whose request differs', async () => {
    const store = new OperationStore(':memory:');
    const ctx = context(store);
    await withOperation(ctx, params, async () => 'ok');

    await expect(
      withOperation(ctx, { ...params, channelId: 'chan-2' }, async () => 'ok'),
    ).rejects.toThrow(/does not match the original request/);
    store.close();
  });

  it('survives an observer that throws (OMN-076)', async () => {
    const store = new OperationStore(':memory:');
    const ctx = context(store, async () => {
      throw new Error('observer offline');
    });

    const result = await withOperation(ctx, params, async () => 'committed anyway');

    expect(result).toBe('committed anyway');
    expect(store.get('op-1')?.status).toBe('committed');
    store.close();
  });

  it('records an ambiguous failure as unknown, not as retryable (OMN-077)', async () => {
    const store = new OperationStore(':memory:');
    const ctx = context(store);

    await expect(
      withOperation(ctx, params, async () => {
        throw new Error('connection lost after broadcast');
      }),
    ).rejects.toThrow(/connection lost/);

    expect(store.get('op-1')?.status).toBe('unknown');

    // A retry must not silently repeat the effect.
    await expect(withOperation(ctx, params, async () => 'retried')).rejects.toThrow(/reconcile/);
    store.close();
  });
});
