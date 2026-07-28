/**
 * Wire types for @totemsdk/root-identity
 */

/**
 * A single WOTS signing proof tied to an on-chain address.
 *
 * Both `signature` and `publicKey` are lower-case hex strings (no 0x prefix).
 * `message` is the exact UTF-8 string that was signed so callers can
 * reconstruct the SHA3-256 digest independently.
 */
export interface WotsProof {
  address: string;
  publicKey: string;
  signature: string;
  message: string;
}

/**
 * Ownership proof demonstrating that a root key controls a set of child addresses.
 *
 * The root key signs a canonical JSON message that includes all child public keys
 * and a timestamp, allowing third parties to verify the claim without any
 * interaction with the blockchain.
 *
 * Verification steps:
 * 1. Rebuild the canonical message from `rootAddress`, `childPublicKeys`, and `timestamp`.
 * 2. Verify `rootProof.signature` over that message with `rootProof.publicKey`.
 * 3. For each `(childPublicKeys[i], childAddresses[i])` pair confirm the address
 *    is correctly derived from the public key.
 */
export interface OwnershipProof {
  rootAddress: string;
  rootPublicKey: string;
  childAddresses: string[];
  childPublicKeys: string[];
  rootProof: WotsProof;
  timestamp: string;
}
