/**
 * RFC-058 P1 — local signer port + custody-mode config.
 */

import os from 'node:os';
import {
  makeHostedCustody,
  makeSelfCustody,
  signRequestPayload,
  verifyChannelSignature,
  type SignRequest,
} from '@totemsdk/omnia';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createLocalSignerPort, createPolicySignerPort } from '../signer-port.js';

const HEX_SEED = '0x' + 'ab'.repeat(32);
const dbPath = `${os.tmpdir()}/omnia-signer-port-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;

function request(overrides: Partial<SignRequest> = {}): SignRequest {
  return {
    requestId: 'req-signer-1',
    domain: 'channel',
    digest: new Uint8Array(32).fill(9),
    context: { summary: 'Test sign request' },
    signers: [],
    custody: makeSelfCustody(),
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe('createLocalSignerPort', () => {
  const config = loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: dbPath });
  const signing = createHostSigning(config);
  const port = createLocalSignerPort(signing);

  it('signs the domain-separated payload and verifies against the host key', async () => {
    const req = request({ signers: [signing.publicKeyDigest] });
    const signature = await port.sign(req);
    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBeGreaterThan(0);
    expect(verifyChannelSignature(signature, signRequestPayload(req), signing.publicKeyDigest)).toBe(true);
  });

  it('signs raw chain digests (no domain wrapper)', async () => {
    const digest = new Uint8Array(32).fill(5);
    const req = request({ kind: 'chain', digest, signers: [signing.publicKeyDigest] });
    const signature = await port.sign(req);
    expect(verifyChannelSignature(signature, digest, signing.publicKeyDigest)).toBe(true);
  });

  it('uses caller-provided lease indices (channel/factory tx signing)', async () => {
    const digest = new Uint8Array(32).fill(6);
    const req = request({
      kind: 'chain',
      digest,
      signers: [signing.publicKeyDigest],
      signingIndices: { addressIndex: signing.addressIndex, l1: 1, l2: 0 },
    });
    const signature = await port.sign(req);
    expect(verifyChannelSignature(signature, digest, signing.publicKeyDigest)).toBe(true);
  });

  it('refuses requests where the local key is not a required signer', async () => {
    await expect(port.sign(request({ signers: ['0x' + '11'.repeat(32)] }))).rejects.toThrow(/not a required signer/);
  });

  it('refuses expired requests before reserving a lease', async () => {
    await expect(port.sign(request({ signers: [signing.publicKeyDigest], expiresAt: Date.now() - 1 }))).rejects.toThrow(/expired/);
  });
});

describe('createPolicySignerPort', () => {
  const config = loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: dbPath });
  const signing = createHostSigning(config);
  const base = createLocalSignerPort(signing);

  it('enforces domain, disclosure and amount limits before signing', async () => {
    const port = createPolicySignerPort(base, {
      allowedDomains: ['channel'],
      allowedModes: ['hosted'],
      maxAmount: 100n,
      requireDisclosure: true,
    });
    const custody = makeHostedCustody({
      operatorId: 'op-1',
      legalEntity: 'Example Custody Ltd',
      jurisdiction: 'GB',
      disclosureHash: '0x' + 'aa'.repeat(32),
      disclosureVersion: '2026-10-20',
      policySummary: 'limits',
      withdrawalTerms: 'T+1',
    });
    const ok = request({
      signers: [signing.publicKeyDigest],
      custody,
      context: { summary: 'Pay', amount: '100' },
    });
    const signature = await port.sign(ok);
    expect(verifyChannelSignature(signature, signRequestPayload(ok), signing.publicKeyDigest)).toBe(true);

    await expect(port.sign(request({
      signers: [signing.publicKeyDigest],
      custody,
      context: { summary: 'Too much', amount: '101' },
    }))).rejects.toThrow(/policy limit/);
    await expect(port.sign(request({
      signers: [signing.publicKeyDigest],
      domain: 'factory',
      custody,
    }))).rejects.toThrow(/domain/);
    await expect(port.sign(request({
      signers: [signing.publicKeyDigest],
      custody: makeSelfCustody(),
    }))).rejects.toThrow(/custody mode/);
  });
});

describe('custody-mode config', () => {
  it('defaults to self custody', () => {
    expect(loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED }).custodyMode).toBe('self');
  });

  it('accepts explicit hosted/trust-minimised modes and rejects unknown values', () => {
    expect(loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_CUSTODY: 'hosted' }).custodyMode).toBe('hosted');
    expect(loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_CUSTODY: 'trust-minimised' }).custodyMode).toBe('trust-minimised');
    expect(() => loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_CUSTODY: 'nope' })).toThrow(/OMNIA_CUSTODY/);
  });
});
