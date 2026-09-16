/**
 * @module @totemsdk/storage/transaction
 *
 * Transaction + CAS helpers. The primary primitives live on the stores
 * (`TransactionalStore.transaction()`, `CasStore.conditionalUpdate`); this
 * module adds the single-commit outbox-style enqueue generalization of
 * `transitionAndEnqueue`.
 */

import type { TransactionalStore } from './types.js';

export interface EnqueueReceipt {
  readonly index: number;
}

export async function enqueueItem<T>(
  store: TransactionalStore,
  key: string,
  item: T,
): Promise<EnqueueReceipt> {
  const tx = store.transaction();
  const current = (await tx.get<T[]>(key)) ?? [];
  tx.set(key, [...current, item]);
  await tx.commit();
  return { index: current.length };
}