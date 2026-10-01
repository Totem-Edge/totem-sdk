import { createSigningRequest, collectSigningResponses, buildRecursiveWitnessPlan, type CreateSigningRequestConfig, type PolicySigningResponse, type ScriptDisclosure } from '../policy-signing.js';

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

  it('requires an approved signature for every required role', () => {
    const resp = (
      signer: string,
      role: string,
      status: PolicySigningResponse['status'] = 'approved',
    ): PolicySigningResponse => ({
      requestId: 'r',
      responseId: `${signer}:${role}`,
      status,
      signerIdentityId: signer,
      actingAddress: 'Mx',
      role,
      signature: status === 'approved' ? '0xsig' : undefined,
      signedAt: 1,
    });

    const keys = { a: '0xaa', b: '0xbb', c: '0xcc' };
    const verify = { roleKeys: keys, signatureVerifier: () => true };

    // An unrelated approved role must not satisfy a missing required role.
    const unrelated = collectSigningResponses(['a', 'b'], [resp('s1', 'a'), resp('s2', 'c')], verify);
    expect(unrelated.complete).toBe(false);
    expect(unrelated.errors.join(' ')).toContain('Missing required role');

    // Every required role approved → complete.
    const ok = collectSigningResponses(['a', 'b'], [resp('s1', 'a'), resp('s2', 'b')], verify);
    expect(ok.complete).toBe(true);

    // A rejected required role is not complete.
    const rejected = collectSigningResponses(['a'], [resp('s1', 'a', 'rejected')]);
    expect(rejected.complete).toBe(false);

    // RFC-020 P1-2: approved signatures without role keys are not accepted.
    const noKeys = collectSigningResponses(['a'], [resp('s1', 'a')]);
    expect(noKeys.complete).toBe(false);
    expect(noKeys.errors.join(' ')).toContain('No role keys');
  });

  it('fails closed when a disclosure lacks a policy root', () => {
    const bad = { scriptHash: 'aa', script: 'RETURN TRUE', mmrProof: '' } as unknown as ScriptDisclosure;
    expect(() =>
      buildRecursiveWitnessPlan({ roots: [], action: 'a', executionRoot: 'r' }, [bad], new Map()),
    ).toThrow(/no policyRoot/);
  });

  it('keys witness signatures by the authorized signer digest, not the role (RFC-020 P2-8)', () => {
    const ds: ScriptDisclosure = { scriptHash: 'h', script: 'RETURN TRUE', mmrProof: 'p', policyRoot: '0xroot' } as ScriptDisclosure;
    const plan = buildRecursiveWitnessPlan(
      { roots: [], action: 'a', executionRoot: 'r' },
      [ds],
      new Map([['admin', '0xdeadbeef']]),
      { admin: '0x' + 'ab'.repeat(32) },
    );
    expect([...plan.signatures.keys()]).toEqual(['ab'.repeat(32)]);
    expect(plan.signatures.get('ab'.repeat(32))).toBe('deadbeef');
  });
});
