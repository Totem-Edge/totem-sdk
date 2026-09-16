/**
 * @module @totemsdk/storage/types
 *
 * Provider-neutral storage contract types.
 *
 * The base `StorageAdapter` interface is canonical in `@totemsdk/core`; this
 * module re-exports it and extends it with capability declarations, write
 * acknowledgment / failure-policy vocabulary, CAS, and transaction primitives.
 */

import type { StorageAdapter } from '@totemsdk/core';

export type { StorageAdapter } from '@totemsdk/core';

export const WriteAckModes = ['volatile', 'buffered', 'durably-acknowledged'] as const;
export type WriteAckMode = (typeof WriteAckModes)[number];

export const FailurePolicies = ['strict', 'lenient'] as const;
export type FailurePolicy = (typeof FailurePolicies)[number];

export interface StoreCapabilities {
  readonly acknowledge: WriteAckMode;
  readonly atomic: boolean;
  readonly conditional: boolean;
}

export interface StorageAdapterWithCapabilities extends StorageAdapter {
  readonly capabilities: StoreCapabilities;
  close?(): Promise<void>;
}

export interface ConditionalResult<T> {
  readonly applied: boolean;
  readonly value: T | null;
  readonly revision: number;
}

export type ConditionalUpdateDecision<T> =
  | { readonly next: T }
  | { readonly abort: string };

export type ConditionalUpdater<T> = (current: T | null) => ConditionalUpdateDecision<T>;

export interface CasStore {
  conditionalUpdate<T>(key: string, update: ConditionalUpdater<T>): Promise<ConditionalResult<T>>;
}

export interface Transaction {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Transaction;
  remove(key: string): Transaction;
  commit(): Promise<void>;
}

export interface TransactionalStore {
  transaction(): Transaction;
}

const ACKNOWLEDGE_ORDER: Record<WriteAckMode, number> = {
  volatile: 0,
  buffered: 1,
  'durably-acknowledged': 2,
};

/**
 * No-silent-downgrade guard (RFC-007 §4.2). A consumer that requires
 * `durably-acknowledged`, atomic, or conditional writes must reject an adapter
 * that cannot provide them at construction time.
 */
export function assertCapabilities(
  adapter: StorageAdapterWithCapabilities,
  required: Partial<StoreCapabilities>,
): void {
  if (required.acknowledge && ACKNOWLEDGE_ORDER[adapter.capabilities.acknowledge] < ACKNOWLEDGE_ORDER[required.acknowledge]) {
    throw new Error(
      `adapter acknowledges "${adapter.capabilities.acknowledge}" but consumer requires "${required.acknowledge}"`,
    );
  }
  if (required.atomic && !adapter.capabilities.atomic) {
    throw new Error('adapter is not atomic but consumer requires atomic writes');
  }
  if (required.conditional && !adapter.capabilities.conditional) {
    throw new Error('adapter does not support conditional (CAS) writes');
  }
}