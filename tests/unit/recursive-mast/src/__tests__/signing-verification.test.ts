/**
 * RFC-018 P1-1 / P1-2: signing request + session verification.
 */
import {
  verifySigningRequest,
  createSigningSession,
  acceptResponse,
  canonicalSigningResponseMessage,
} from '../index.js';
import type { PolicySigningRequest, PolicySigningResponse } from '../index.js';
import { computeCanonicalScriptHash } from '@totemsdk/kissvm';

function makeRequest(overrides: Partial<PolicySigningRequest> = {}): PolicySigningRequest {
  const now = 1_000_000;
  return {
    requestId: 'req-1',
    policyId: 'policy-1',
    policyVersion: 1,
    policyEpoch: 5,
    action: 'firmware:install',
    subjectId: 'veh-1',
    requestedRole: 'owner',
    transactionDigest: '0x' + 'ab'.repeat(32),
    transactionTemplate: new Uint8Array([1, 2, 3]),
    selectedPath: { roots: ['0xanchor'], action: 'firmware:install', executionRoot: '0xexec' },
    disclosedScripts: [],
    evidence: [],
    expectedInputs: [],
    expectedOutputs: [],
    requestedAt: now,
    expiresAt: now + 60_000,
    replyEndpoint: 'https://example.invalid/reply',
    requesterIdentity: {
      identityId: 'id-1',
      identity: 'did:totem:requester',
      issuerPkd: '0x' + '11'.repeat(32),
      issuerSignature: '0x00',
      subjectPkd: '0x' + '22'.repeat(32),
      subjectSignature: '0x00',
    },
    requesterSignature: '0x' + '33'.repeat(1088),
    ...overrides,
  };
}

const baseOptions = (req: PolicySigningRequest) => ({
  currentEpoch: req.policyEpoch,
  trustRequester: true,
  now: req.requestedAt,
  requesterSignatureVerifier: () => true,
});

describe('RFC-018 P1-1: verifySigningRequest', () => {
  it('rejects an invalid requester signature', () => {
    const req = makeRequest();
    const report = verifySigningRequest(req, {
      ...baseOptions(req),
      requesterSignatureVerifier: () => false,
    });
    expect(report.valid).toBe(false);
    expect(report.checks.requesterSignature).toBe(false);
    expect(report.errors.join(' ')).toMatch(/Requester signature is invalid/);
  });

  it('verifies the signature over the canonical request bytes', () => {
    const req = makeRequest();
    let seen = '';
    const report = verifySigningRequest(req, {
      ...baseOptions(req),
      requesterSignatureVerifier: (msg, sig, pkd) => {
        seen = new TextDecoder().decode(msg);
        return sig === req.requesterSignature && pkd === req.requesterIdentity.subjectPkd;
      },
    });
    expect(report.valid).toBe(true);
    expect(report.checks.requesterSignature).toBe(true);
    expect(seen).toContain('req-1');
    expect(seen).toContain('firmware:install');
  });

  it('fails closed on an unknown action', () => {
    const req = makeRequest();
    const report = verifySigningRequest(req, {
      ...baseOptions(req),
      policyManifest: {
        policyRoot: '0xanchor',
        version: 1,
        epoch: req.policyEpoch,
        actions: [{ action: 'other', requiredRoles: ['owner'] }],
      },
    });
    expect(report.valid).toBe(false);
    expect(report.errors.join(' ')).toMatch(/Unknown action/);
  });

  it('passes each disclosure its own policy root to the branch verifier', () => {
    const req = makeRequest({
      disclosedScripts: [
        { scriptHash: '0xh1', script: 'RETURN TRUE', mmrProof: '', policyRoot: '0xroot1' },
        { scriptHash: '0xh2', script: 'RETURN TRUE', mmrProof: '', policyRoot: '0xroot2' },
      ],
    });
    const seen: string[] = [];
    verifySigningRequest(req, {
      ...baseOptions(req),
      branchVerifier: (_scriptHash, policyRoot) => {
        seen.push(policyRoot);
        return true;
      },
    });
    expect(seen).toEqual(['0xroot1', '0xroot2']);
  });

  it('populates outputsMatch from actual outputs', () => {
    const req = makeRequest({ expectedOutputs: [{ address: 'Mx', amount: '1' }] });
    const ok = verifySigningRequest(req, {
      ...baseOptions(req),
      actualOutputs: [{ address: 'Mx', amount: '1' }],
    });
    expect(ok.checks.outputsMatch).toBe(true);
    expect(ok.valid).toBe(true);

    const bad = verifySigningRequest(req, {
      ...baseOptions(req),
      actualOutputs: [{ address: 'Mx', amount: '2' }],
    });
    expect(bad.checks.outputsMatch).toBe(false);
    expect(bad.valid).toBe(false);
  });

  it('checks the selected path starts at the anchor root', () => {
    const req = makeRequest({
      selectedPath: { roots: ['0xanchor'], action: 'firmware:install', executionRoot: '0xexec' },
    });
    const report = verifySigningRequest(req, {
      ...baseOptions(req),
      anchorCoin: { coinId: 'c', policyRoot: '0xanchor', epoch: req.policyEpoch, manifestHash: 'm' },
    });
    expect(report.checks.pathStartsAtAnchor).toBe(true);

    const badReq = makeRequest({
      selectedPath: { roots: ['0xother'], action: 'firmware:install', executionRoot: '0xexec' },
    });
    const bad = verifySigningRequest(badReq, {
      ...baseOptions(badReq),
      anchorCoin: { coinId: 'c', policyRoot: '0xanchor', epoch: badReq.policyEpoch, manifestHash: 'm' },
    });
    expect(bad.checks.pathStartsAtAnchor).toBe(false);
    expect(bad.valid).toBe(false);
  });

  it('rejects a disclosure whose script does not hash to its scriptHash (RFC-020 P1-1)', () => {
    const script = 'RETURN TRUE';
    const good = makeRequest({
      disclosedScripts: [{ scriptHash: computeCanonicalScriptHash(script), script, mmrProof: '', policyRoot: '0xroot' }],
    });
    expect(verifySigningRequest(good, baseOptions(good)).checks.disclosedScriptContent).toBe(true);

    const tampered = makeRequest({
      disclosedScripts: [{ scriptHash: '0x' + 'aa'.repeat(32), script, mmrProof: '', policyRoot: '0xroot' }],
    });
    const report = verifySigningRequest(tampered, baseOptions(tampered));
    expect(report.checks.disclosedScriptContent).toBe(false);
    expect(report.valid).toBe(false);
  });
});

describe('RFC-018 P1-2: acceptResponse', () => {
  const makeSession = () =>
    createSigningSession({
      policyId: 'policy-1',
      policyVersion: 1,
      policyEpoch: 5,
      action: 'firmware:install',
      transactionDigest: '0x' + 'ab'.repeat(32),
      requiredRoles: ['owner', 'se'],
      requiredEvidence: [],
    });

  const makeResponse = (
    sessionId: string,
    overrides: Partial<PolicySigningResponse> = {},
  ): PolicySigningResponse => ({
    requestId: `req-${sessionId}`,
    responseId: 'resp-1',
    status: 'approved',
    signerIdentityId: 'signer-A',
    actingAddress: 'MxAAA',
    role: 'owner',
    signature: '0x' + '44'.repeat(1088),
    signedAt: Date.now(),
    ...overrides,
  });

  it('rejects a response bound to a different request', () => {
    const session = makeSession();
    expect(() =>
      acceptResponse(session, makeResponse(session.sessionId, { requestId: 'req-other' })),
    ).toThrow(/does not match session/);
  });

  it('rejects a role that is not part of the session', () => {
    const session = makeSession();
    expect(() =>
      acceptResponse(session, makeResponse(session.sessionId, { role: 'intruder' })),
    ).toThrow(/not part of the session/);
  });

  it('rejects one signer filling several roles', () => {
    const session = makeSession();
    const opts = {
      roleKeys: { owner: '0x' + '22'.repeat(32), se: '0x' + '33'.repeat(32) },
      signatureVerifier: () => true,
    };
    const afterOwner = acceptResponse(session, makeResponse(session.sessionId), opts);
    expect(() =>
      acceptResponse(afterOwner, makeResponse(session.sessionId, { role: 'se', responseId: 'resp-2' }), opts),
    ).toThrow(/already signed role/);
  });

  it('requires roleKeys to accept an approved response (RFC-020 P1-2)', () => {
    const session = makeSession();
    expect(() => acceptResponse(session, makeResponse(session.sessionId))).toThrow(/roleKeys is required/);
  });

  it('verifies the signature against the authorized role key', () => {
    const session = makeSession();
    const response = makeResponse(session.sessionId);
    let signedMessage = '';
    const ok = acceptResponse(session, response, {
      roleKeys: { owner: '0x' + '22'.repeat(32) },
      signatureVerifier: (msg, sig, pkd) => {
        signedMessage = new TextDecoder().decode(msg);
        return sig === response.signature && pkd === '0x' + '22'.repeat(32);
      },
    });
    expect(ok.requiredRoles.find((r) => r.role === 'owner')?.signed).toBe(true);
    expect(signedMessage).toBe(new TextDecoder().decode(canonicalSigningResponseMessage(session, response)));

    expect(() =>
      acceptResponse(session, response, {
        roleKeys: { owner: '0x' + '22'.repeat(32) },
        signatureVerifier: () => false,
      }),
    ).toThrow(/invalid/);
  });
});
