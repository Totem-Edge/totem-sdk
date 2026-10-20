/**
 * RFC-058 P1 — local signer port + custody-mode config.
 */

import os from 'node:os';
import {
  makeSelfCustody,
  signRequestPayload,
  verifyChannelSignature,
  type SignRequest,
} from '@totemsdk/omnia';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createLocalSignerPort } from '../signer-port.js';

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

  it('refuses requests where the local key is not a required signer', async () => {
    await expect(port.sign(request({ signers: ['0x' + '11'.repeat(32)] }))).rejects.toThrow(/not a required signer/);
  });

  it('refuses expired requests before reserving a lease', async () => {
    await expect(port.sign(request({ signers: [signing.publicKeyDigest], expiresAt: Date.now() - 1 }))).rejects.toThrow(/expired/);
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
