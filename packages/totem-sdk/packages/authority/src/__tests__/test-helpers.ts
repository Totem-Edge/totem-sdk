import { createIdentityDocument, createDelegationClaim, signIdentityClaim } from '@totemsdk/identity';
import { createProof, signProof } from '@totemsdk/proof';
import { wotsKeypairFromSeed, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import type { IdentityGraph, SignedIdentityClaim } from '@totemsdk/identity';
import type { SignedProof } from '@totemsdk/proof';
import type { AuthorityIdentityResolver, MandateBody, ActionIntent } from '../types.js';

export function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  s[1] = (n >> 8) & 0xff;
  return s;
}

export function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return scriptToAddress(scriptFromWotsPk(kp.pk));
}

export const SEED_ROOT = testSeed(100);
export const SEED_CTRL = testSeed(101);
export const SEED_DELEGATE = testSeed(102);
export const SEED_AGENT = testSeed(103);
export const SEED_ATTACKER = testSeed(200);

export const ADDR_ROOT = deriveAddress(SEED_ROOT, 0);
export const ADDR_CTRL = deriveAddress(SEED_CTRL, 0);
export const ADDR_DELEGATE = deriveAddress(SEED_DELEGATE, 0);
export const ADDR_AGENT = deriveAddress(SEED_AGENT, 0);
export const ADDR_ATTACKER = deriveAddress(SEED_ATTACKER, 0);

export interface IdentityGraphWithId {
  graph: IdentityGraph;
  identityId: string;
}

export async function makeIdentityGraph(
  rootSeed: Uint8Array,
  ctrlSeed: Uint8Array,
  delegates: Array<{ seed: Uint8Array; keyIndex: number; scopes: string[] }>,
): Promise<IdentityGraphWithId> {
  const rootAddr = deriveAddress(rootSeed, 0);
  const ctrlAddr = deriveAddress(ctrlSeed, 0);

  const doc = createIdentityDocument({
    kind: 'agent',
    rootAddress: rootAddr,
    controllerAddress: ctrlAddr,
  });

  const claims: SignedIdentityClaim[] = [];

  for (const d of delegates) {
    const delegateAddr = deriveAddress(d.seed, d.keyIndex);
    const claim = createDelegationClaim({
      issuer: rootAddr,
      subject: doc.id,
      delegatedAddress: delegateAddr,
      scopes: d.scopes,
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(claim, rootSeed, 0);
    claims.push(signed);
  }

  return { graph: { document: doc, claims }, identityId: doc.id };
}

export function makeResolver(graphs: Map<string, IdentityGraph>): AuthorityIdentityResolver {
  return {
    resolve(identityId: string) {
      return graphs.get(identityId);
    },
  };
}

export function makeMandateProof(
  mandate: MandateBody,
  signerSeed: Uint8Array,
  keyIndex: number,
): SignedProof {
  const unsigned = createProof({
    kind: 'custom',
    subject: { id: mandate.grantee, kind: 'agent' },
    issuer: mandate.grantor,
    issuedAt: mandate.issuedAt,
    expiresAt: mandate.expiresAt,
    payload: {
      schema: 'totem:authority:mandate/v1',
      mandate,
    },
  });
  return signProof(unsigned, signerSeed, keyIndex);
}

export function makeSimpleAction(action?: Partial<ActionIntent>): ActionIntent {
  return {
    action: 'data:read',
    principal: 'totem:id:agent:principal',
    agent: ADDR_AGENT,
    ...action,
  };
}
