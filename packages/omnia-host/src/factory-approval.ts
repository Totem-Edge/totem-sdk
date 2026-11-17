/**
 * Authorization gate for peer-initiated factory signing.
 *
 * Cryptographic validity is not authorization: a peer can present a correctly
 * formed opening or close that this host never agreed to fund. Every signature
 * request from a peer therefore passes through this gate before a WOTS leaf is
 * reserved. The default is deny; unattended hosts opt into a bounded automated
 * policy explicitly (max total value and/or an allowlist of peer keys).
 */

export type FactoryApprovalKind = 'open' | 'close';

export interface FactoryAuthorizationRequest {
  kind: FactoryApprovalKind;
  factoryId: string;
  peerPublicKeyDigest: string;
  /** Number of participants in the factory. */
  participants: number;
  /** Total value in base units (string to avoid precision loss). */
  totalValue: string;
  tokenId: string;
  tokenScale: number;
  /** Digest about to be signed, 0x-prefixed hex. */
  digest: string;
  /** Human-readable operation summary for an approval UI or audit log. */
  summary: string;
}

export type FactoryAuthorizer = (request: FactoryAuthorizationRequest) => Promise<void> | void;

export interface FactoryApprovalEvent {
  decision: 'allow' | 'deny';
  source: 'operator' | 'auto' | 'default';
  request: FactoryAuthorizationRequest;
  reason?: string;
  occurredAt: number;
}

export interface FactoryApprovalPolicy {
  /**
   * Operator/approval-service hook. Receiving an authorizer means the deployment
   * takes responsibility for the decision; it may throw to deny.
   */
  authorize?: FactoryAuthorizer;
  /** Explicit opt-in for unattended signing. Deny remains the default. */
  autoApprove?: boolean;
  /** Upper bound for an automatically approved factory, in base units. */
  maxTotalValue?: bigint;
  /** When set, only these peer public-key digests may be auto-approved. */
  allowedPeers?: string[];
  /** Audit sink for every decision. */
  audit?: (event: FactoryApprovalEvent) => void | Promise<void>;
}

const normalizeHex = (value: string): string => value.replace(/^0x/i, '').toLowerCase();

export function createFactoryAuthorizer(policy: FactoryApprovalPolicy = {}): FactoryAuthorizer {
  return async (request: FactoryAuthorizationRequest): Promise<void> => {
    const base = { request, occurredAt: Date.now() } as const;

    if (policy.authorize) {
      try {
        await policy.authorize(request);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        await policy.audit?.({ ...base, decision: 'deny', source: 'operator', reason });
        throw err;
      }
      await policy.audit?.({ ...base, decision: 'allow', source: 'operator' });
      return;
    }

    if (!policy.autoApprove) {
      const reason = `factory ${request.kind} requires operator authorization for ${request.factoryId}`;
      await policy.audit?.({ ...base, decision: 'deny', source: 'default', reason });
      throw new Error(
        `${reason} (configure an authorizer, or opt into the bounded automated policy with ` +
        'OMNIA_FACTORY_AUTO_APPROVE=true)',
      );
    }

    if (policy.allowedPeers?.length) {
      const peer = normalizeHex(request.peerPublicKeyDigest);
      if (!policy.allowedPeers.some((allowed) => normalizeHex(allowed) === peer)) {
        const reason = `peer ${request.peerPublicKeyDigest} is not in the factory auto-approve allowlist`;
        await policy.audit?.({ ...base, decision: 'deny', source: 'auto', reason });
        throw new Error(reason);
      }
    }

    if (policy.maxTotalValue !== undefined) {
      const total = BigInt(request.totalValue);
      if (total > policy.maxTotalValue) {
        const reason = `factory ${request.factoryId} value ${total} exceeds the auto-approve limit ${policy.maxTotalValue}`;
        await policy.audit?.({ ...base, decision: 'deny', source: 'auto', reason });
        throw new Error(reason);
      }
    }

    await policy.audit?.({ ...base, decision: 'allow', source: 'auto' });
  };
}
