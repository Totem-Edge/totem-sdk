/**
 * Peer-initiated factory signing must be authorized, not merely well-formed.
 * Deny is the default; unattended deployments opt into a bounded policy.
 */

import { createFactoryAuthorizer } from '../factory-approval.js';
import type { FactoryAuthorizationRequest } from '../factory-approval.js';

const PEER = '0x' + 'ab'.repeat(32);

function request(overrides: Partial<FactoryAuthorizationRequest> = {}): FactoryAuthorizationRequest {
  return {
    kind: 'open',
    factoryId: 'f1',
    peerPublicKeyDigest: PEER,
    participants: 2,
    totalValue: '1000',
    tokenId: '0x00',
    tokenScale: 0,
    digest: '0x' + '11'.repeat(32),
    summary: 'Open factory f1',
    ...overrides,
  };
}

describe('factory authorization gate', () => {
  it('denies peer-initiated signing by default', async () => {
    const authorize = createFactoryAuthorizer();
    await expect(authorize(request())).rejects.toThrow(/requires operator authorization/);
  });

  it('delegates to an operator authorizer and records the decision', async () => {
    const events: string[] = [];
    const authorize = createFactoryAuthorizer({
      authorize: async (req) => {
        if (req.kind === 'close') throw new Error('close not approved');
      },
      audit: (event) => events.push(`${event.decision}:${event.source}`),
    });

    await expect(authorize(request())).resolves.toBeUndefined();
    await expect(authorize(request({ kind: 'close' }))).rejects.toThrow(/close not approved/);
    expect(events).toEqual(['allow:operator', 'deny:operator']);
  });

  it('enforces the auto-approve value bound', async () => {
    const authorize = createFactoryAuthorizer({ autoApprove: true, maxTotalValue: 1000n });
    await expect(authorize(request({ totalValue: '1000' }))).resolves.toBeUndefined();
    await expect(authorize(request({ totalValue: '1001' }))).rejects.toThrow(/exceeds the auto-approve limit/);
  });

  it('enforces the peer allowlist with hex normalization', async () => {
    const authorize = createFactoryAuthorizer({
      autoApprove: true,
      allowedPeers: [PEER.replace(/^0x/, '').toUpperCase()],
    });
    await expect(authorize(request())).resolves.toBeUndefined();
    await expect(authorize(request({ peerPublicKeyDigest: '0x' + 'cd'.repeat(32) })))
      .rejects.toThrow(/not in the factory auto-approve allowlist/);
  });

  it('records auto decisions', async () => {
    const events: string[] = [];
    const authorize = createFactoryAuthorizer({
      autoApprove: true,
      audit: (event) => events.push(event.decision),
    });
    await authorize(request({ kind: 'close' }));
    expect(events).toEqual(['allow']);
  });
});
