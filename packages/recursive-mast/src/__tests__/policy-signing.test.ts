import { createSigningRequest, type CreateSigningRequestConfig } from '../policy-signing.js';

function baseConfig(): CreateSigningRequestConfig {
  return {
    policyId: 'pol',
    policyVersion: 1,
    policyEpoch: 0,
    action: 'act',
    subjectId: 'subj',
    requestedRole: 'role',
    transactionDigest: '0x' + 'ab'.repeat(32),
    transactionTemplate: new Uint8Array([1, 2, 3]),
    selectedPath: { roots: ['r1', 'r2'], action: 'act', executionRoot: 'r3' },
    disclosedScripts: [{ scriptHash: 'aa', script: 'RETURN TRUE', mmrProof: '', policyRoot: 'r1' }],
    evidence: [{ evidenceId: 'e1', type: 't', data: 'd', signerPkd: 'pk', signature: 'sig' }],
    expectedInputs: [{ coinId: '0xc', address: 'Mx', amount: '10' }],
    expectedOutputs: [{ address: 'Mx', amount: '10' }],
    replyEndpoint: 'https://totem.ing',
    requesterIdentity: {
      identityId: 'id',
      identity: 'did:totem:x',
      issuerPkd: 'ip',
      issuerSignature: 'is',
      subjectPkd: 'sp',
      subjectSignature: 'ss',
    },
  };
}

async function canonicalOf(cfg: CreateSigningRequestConfig): Promise<string> {
  let captured = '';
  await createSigningRequest(cfg, (data) => {
    captured = new TextDecoder().decode(data);
    return new Uint8Array(64);
  });
  return captured;
}

describe('RFC-016 hardening: signing request canonicalization', () => {
  it('binds nested semantic fields into the signed canonical form', async () => {
    const a = await canonicalOf(baseConfig());
    const cfg = baseConfig();
    cfg.expectedOutputs = [{ address: 'Mx', amount: '99' }];
    const b = await canonicalOf(cfg);

    // A nested field change must change the signed bytes.
    expect(a).not.toBe(b);
    // Nested semantics survive serialization (previously filtered out).
    expect(a).toContain('executionRoot');
    expect(a).toContain('expectedOutputs');
    expect(a).toContain('subjectPkd');
  });
});
