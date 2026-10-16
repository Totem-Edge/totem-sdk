/**
 * Deterministic address derivation (CAN-005).
 *
 * Minima's `newaddress` is non-deterministic, and not every node build honours a
 * `modifier:` argument, so an address taken from the node can differ across
 * containers/restarts and break cross-container resolution. These helpers derive
 * the address **from the seed** instead, using the same schemes the node uses, so
 * the result is reproducible and (for the matching scheme) node-spendable.
 *
 * - `deriveDeterministicAddress` — Minima `Wallet.createNewKey()` parity:
 *   `privseed = hash(baseSeed, index)` → `TreeKey(privseed, 64, 3)` → pubkey → Mx.
 * - `deriveUnifiedAddress` — RFC-037 hierarchical child key.
 *
 * `verifyDeterministicAddress` asserts an address a node handed back matches the
 * seed-derived one — the fail-loud check that replaces a silent fallback.
 */

import { derivePerAddressSeed } from './javaStreamables.js';
import { TreeKey, createUnifiedChildTreeKey } from './treekey.js';
import { deriveAddressFromPublicKey, bytesToHex } from './verify.js';

export type AddressScheme = 'per-address' | 'unified';

export interface DerivedAddress {
  addressIndex: number;
  /** 0x-hex 32-byte WOTS public key. */
  publicKey: string;
  /** Mx… address derived from the public key. */
  address: string;
  scheme: AddressScheme;
}

function assertIndex(addressIndex: number): void {
  if (!Number.isInteger(addressIndex) || addressIndex < 0) {
    throw new Error(`addressIndex must be a non-negative integer, got ${JSON.stringify(addressIndex)}`);
  }
}

function toDerived(addressIndex: number, scheme: AddressScheme, publicKeyBytes: Uint8Array): DerivedAddress {
  const publicKey = '0x' + bytesToHex(publicKeyBytes).toUpperCase();
  return { addressIndex, publicKey, address: deriveAddressFromPublicKey(publicKey), scheme };
}

/** Minima Wallet.java parity: `baseSeed + index → privseed → TreeKey(64,3) → address`. */
export function deriveDeterministicAddress(baseSeed: Uint8Array, addressIndex: number): DerivedAddress {
  assertIndex(addressIndex);
  const privSeed = derivePerAddressSeed(baseSeed, addressIndex);
  const publicKey = new TreeKey(privSeed, 64, 3).getPublicKey();
  return toDerived(addressIndex, 'per-address', publicKey);
}

/** RFC-037 unified hierarchical scheme: `baseSeed + index → child TreeKey → address`. */
export function deriveUnifiedAddress(baseSeed: Uint8Array, addressIndex: number): DerivedAddress {
  assertIndex(addressIndex);
  const publicKey = createUnifiedChildTreeKey(baseSeed, addressIndex).getPublicKey();
  return toDerived(addressIndex, 'unified', publicKey);
}

/** Derive the address for a scheme (default: the node-parity per-address scheme). */
export function deriveAddress(
  baseSeed: Uint8Array,
  addressIndex: number,
  scheme: AddressScheme = 'per-address',
): DerivedAddress {
  return scheme === 'unified'
    ? deriveUnifiedAddress(baseSeed, addressIndex)
    : deriveDeterministicAddress(baseSeed, addressIndex);
}

/**
 * Fail-loud check: does the node-returned `expectedAddress` equal the address
 * derived from the seed? Use this instead of trusting `newaddress` blindly.
 */
export function verifyDeterministicAddress(
  baseSeed: Uint8Array,
  addressIndex: number,
  expectedAddress: string,
  scheme: AddressScheme = 'per-address',
): boolean {
  return deriveAddress(baseSeed, addressIndex, scheme).address === expectedAddress;
}
