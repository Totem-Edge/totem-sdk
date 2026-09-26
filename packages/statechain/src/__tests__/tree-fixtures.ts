/**
 * RFC-009 test fixtures — real TreeKey owners and a real, client-verifiable
 * test SE.
 *
 * The statechain owner is now a Minima-faithful TreeKey signer (root-bound), and
 * transfer/claim require a leased-leaf SE signature envelope authorized by the
 * SE root's `OwnershipProof`. These fixtures build both from real `TreeKey`s so
 * `verifyStateChain` / `verifySeSignatureEnvelope` run their real verification
 * paths (no mock overrides).
 */

import {
  TreeKey,
  bytesToHex,
  sha3_256,
  scriptFromWotsPk,
  scriptToAddress,
  serializeTreeSignature,
} from '@totemsdk/core';
import type {
  StateChain,
  StatechainOwner,
  SEClient,
  SESignature,
  SeOwnershipProof,
} from '../types.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Address controlled by a 32-byte WOTS/TreeKey public key. */
export function addressOfPublicKey(pk: Uint8Array): string {
  return scriptToAddress(scriptFromWotsPk(pk));
}

// ─── Owners ──────────────────────────────────────────────────────────────────

const OWNER_KEYS = new Map<string, TreeKey>();

/** Deterministic, cached TreeKey for a party (capacity 16^2 = 256 signatures). */
export function ownerKey(partyId: string): TreeKey {
  let tk = OWNER_KEYS.get(partyId);
  if (!tk) {
    tk = new TreeKey(sha3_256(enc(`owner:${partyId}`)), 16, 2);
    OWNER_KEYS.set(partyId, tk);
  }
  return tk;
}

/** TreeKey root public key hex — the owner's `publicKeyDigest`. */
export function ownerRoot(partyId: string): string {
  return bytesToHex(ownerKey(partyId).getPublicKey());
}

export interface MakeOwnerOptions {
  address?: string;
  tokenId?: string;
  amount?: bigint;
}

/** A real TreeKey-backed `StatechainOwner`. */
export function makeOwner(partyId: string, opts: MakeOwnerOptions = {}): StatechainOwner {
  return {
    partyId,
    publicKeyDigest: ownerRoot(partyId),
    signTree: async (message: Uint8Array) => ownerKey(partyId).sign(message),
    ...(opts.address !== undefined ? { address: opts.address } : {}),
    ...(opts.tokenId !== undefined ? { tokenId: opts.tokenId } : {}),
    ...(opts.amount !== undefined ? { amount: opts.amount } : {}),
  };
}

// ─── Test SE ─────────────────────────────────────────────────────────────────

const SE_ROOT_SEED = sha3_256(enc('test-se-root'));

/**
 * A test SE with a published `OwnershipProof` over leased leaves.
 *
 * Each `blindSign` leases the next leaf and returns a real one-time
 * `TreeSignature` envelope. The leaf set is grown lazily and pushed into the
 * published proof arrays (which chains hold by reference), so membership
 * checks pass for every leaf used. This mirrors a federation-shaped SE
 * (`n=k=1`) without pre-generating an unused leaf pool.
 */
export class TestSE {
  readonly root: TreeKey;
  readonly rootPublicKey: string;
  readonly ownershipProof: SeOwnershipProof;
  private readonly leaves = new Map<number, TreeKey>();
  private nextLeaf = 0;

  constructor() {
    this.root = new TreeKey(SE_ROOT_SEED, 4, 2);
    this.rootPublicKey = bytesToHex(this.root.getPublicKey());
    const rootAddress = addressOfPublicKey(this.root.getPublicKey());
    this.ownershipProof = {
      rootAddress,
      rootPublicKey: this.rootPublicKey,
      childAddresses: [],
      childPublicKeys: [],
      rootProof: { address: rootAddress, publicKey: this.rootPublicKey, signature: '00', message: 'test-se-proof' },
      timestamp: '1970-01-01T00:00:00.000Z',
    };
  }

  private leafAt(index: number): TreeKey {
    let leaf = this.leaves.get(index);
    if (!leaf) {
      leaf = new TreeKey(sha3_256(enc(`test-se-leaf:${index}`)), 4, 2);
      this.leaves.set(index, leaf);
      const pk = leaf.getPublicKey();
      this.ownershipProof.childPublicKeys.push(bytesToHex(pk));
      this.ownershipProof.childAddresses.push(addressOfPublicKey(pk));
    }
    return leaf;
  }

  /** Lease the next leaf and produce its signature envelope over a commitment. */
  sign(commitmentHex: string): SESignature {
    const idx = this.nextLeaf++;
    const leaf = this.leafAt(idx);
    const pk = leaf.getPublicKey();
    // verifySignatureDetailed re-hashes the message string, so sign sha3(message).
    const signature = leaf.sign(sha3_256(enc(commitmentHex)));
    return {
      kind: 'child',
      member: 'se',
      childIndex: idx,
      address: addressOfPublicKey(pk),
      publicKey: bytesToHex(pk),
      signature: bytesToHex(serializeTreeSignature(signature)),
      message: commitmentHex,
      proofVersion: 1,
    };
  }

  client(): SEClient & {
    revokedKeys: string[];
    registeredChains: string[];
    registeredDetails: Array<{
      chainId: string;
      coinId: string;
      ownerPublicKeyDigest: string;
      lockingScript: string;
      ownerPartyId?: string;
      tokenId?: string;
      reclaimTxHex?: string;
    }>;
  } {
    const revokedKeys: string[] = [];
    const registeredChains: string[] = [];
    const registeredDetails: Array<{
      chainId: string;
      coinId: string;
      ownerPublicKeyDigest: string;
      lockingScript: string;
      ownerPartyId?: string;
      tokenId?: string;
      reclaimTxHex?: string;
    }> = [];
    return {
      revokedKeys,
      registeredChains,
      registeredDetails,
      registerChain: async (chainId, coinId, ownerPublicKeyDigest, lockingScript, details) => {
        registeredChains.push(chainId);
        registeredDetails.push({
          chainId, coinId, ownerPublicKeyDigest, lockingScript,
          ownerPartyId: details?.ownerPartyId,
          tokenId: details?.tokenId,
          reclaimTxHex: details?.reclaimTxHex,
        });
      },
      blindSign: async (_chainId: string, commitmentHex: string) => this.sign(commitmentHex),
      revokeKey: async (_chainId: string, details: { previousOwnerPartyId: string }) => {
        revokedKeys.push(details.previousOwnerPartyId);
      },
      isRevoked: async (ownerPartyId: string) => revokedKeys.includes(ownerPartyId),
    };
  }
}

let _se: TestSE | undefined;

/** Shared, lazily-created test SE (leaf pool is consumed across the suite). */
export function testSE(): TestSE {
  return (_se ??= new TestSE());
}

/** Attach the SE identity + published leaf proof to a freshly created chain. */
export function attachSe(chain: StateChain, se: TestSE): StateChain {
  return {
    ...chain,
    sePublicKey: se.rootPublicKey,
    seOwnershipProof: se.ownershipProof,
    seProofVersion: 1,
  };
}
