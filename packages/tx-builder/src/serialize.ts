/**
 * @module @totemsdk/tx-builder/serialize
 *
 * Transaction serialization surface. The byte-exact object serializer and its
 * inverse live in `@totemsdk/core` (Java parity); this module re-exports them
 * from the transaction-builder package so callers do not have to pair with core
 * directly, and adds hex conveniences.
 *
 * RFC-005 Gap #9: tx-builder previously provided coin selection and types but
 * no transaction serialization.
 *
 * Note: `@totemsdk/core` also exposes a distinct WASM `serializeTransaction`
 * that takes a JSON string; this surface is the object-based `MinimaTransaction`
 * serializer paired with `deserializeTransaction`.
 */

import {
  serializeTransactionObject as serializeTransaction,
  deserializeTransaction,
  bytesToHex,
  hexToBytes,
} from '@totemsdk/core';
import type { MinimaTransaction } from '@totemsdk/core';

export { serializeTransaction, deserializeTransaction };

/** Serialize a transaction to lowercase hex (no `0x` prefix). */
export function serializeTransactionHex(tx: MinimaTransaction): string {
  return bytesToHex(serializeTransaction(tx));
}

/** Deserialize a transaction from hex (with or without a `0x` prefix). */
export function deserializeTransactionHex(hex: string): MinimaTransaction {
  return deserializeTransaction(hexToBytes(hex));
}
