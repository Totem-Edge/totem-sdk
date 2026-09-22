import {
  concatBytes,
  serializeTreeSignature,
  writeMiniNumber,
} from '@totemsdk/core';
import type { TreeSignature } from '@totemsdk/core';

function multiConcat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 0) return new Uint8Array(0);
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) {
    result = concatBytes(result, parts[i]);
  }
  return result;
}

/**
 * Canonical Minima witness serializer for TreeKey signers (RFC-009).
 *
 * Emits the signatures section as a list of Minima `Signature` objects — each
 * serialized via `serializeTreeSignature`, byte-identical to Java
 * `Signature.writeDataStream()` — followed by the empty coin-proof and script
 * sections:
 *
 *   `[MiniNumber(count)][Signature…][MiniNumber(0)][MiniNumber(0)]`
 *
 * This is the witness shape a Minima node expects for a cooperative
 * `MULTISIG`/`SIGNEDBY` spend when the signers are TreeKey roots. It is the
 * single source of truth shared by `@totemsdk/statechain`.
 */
export function buildMinimaWitnessBytes(signatures: TreeSignature[]): Uint8Array {
  const parts: Uint8Array[] = [writeMiniNumber(BigInt(signatures.length), 0)];
  for (const sig of signatures) parts.push(serializeTreeSignature(sig));
  parts.push(writeMiniNumber(0n, 0));
  parts.push(writeMiniNumber(0n, 0));
  return multiConcat(parts);
}
