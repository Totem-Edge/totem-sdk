/**
 * @module @totemsdk/edge/purchasing/accounted-authority
 *
 * Accounted purchase authority (RFC-007 Phase 5). Purchase authorization and
 * entitlement checks stay **above the storage backend** and reuse the existing
 * agent-policy accounting authority — `GrantBoundPolicy` over `GrantUsageStore`
 * mandate/budget reservations — rather than introducing a second accounting
 * layer (RFC-007 §5).
 *
 * The buyer's `AuthorityPort.approve` boundary is a read-only policy decision.
 * This wrapper splices the mandate/usage reservation lifecycle onto it:
 *
 *   approve()   → evaluate mandate scope/constraints/budget AND atomically
 *                 reserve usage for the economic commitment
 *   commit()    → consume the reservation once the purchase succeeds
 *   abort()     → release it after a failed/cancelled purchase
 *   recover()   → surface expired-unsettled reservations; their budget is HELD
 *   reconcile() → the ONLY budget release is an explicit
 *                 'definitely-not-executed'; 'completed' commits
 *
 * No counter lives here: every number is read from the injected
 * `GrantUsageStore` — the same instance the policy reserves against. Losing a
 * reservation never restores spending capacity, and two concurrent purchases
 * can never independently observe the same remaining mandate budget.
 */

import type {
  AgentStep,
  AuthorizeStepResult,
  AutonomousRun,
  GrantBoundPolicy,
  GrantUsageStore,
  OutOfBandReservation,
  ReservationSettlementOutcome,
  StepReceipt,
} from '@totemsdk/agent-policy';
import type { EdgeOperationResult } from '../types.js';
import type { PurchaseIntent, TradeAgreement } from './types.js';

export interface AccountedPurchaseAuthorityOptions {
  /** Reused agent-policy authority+accounting owner: mandate scope/usage check + atomic reserve. */
  grantBound: GrantBoundPolicy;
  /**
   * The SAME `GrantUsageStore` the policy reserves against. Used for counters
   * and conservative crash recovery only — never as a second accounting layer.
   */
  usageStore: GrantUsageStore;
  /** Run context this purchase stream draws from (`runId`, `principal`, `grantProofIds`). */
  run: AutonomousRun;
  /**
   * Derive the step to authorize for an agreement. Default: one
   * `purchase.pay` step per agreement, targeted at the seller.
   */
  stepFor?: (params: { agreement: TradeAgreement; intent: PurchaseIntent }) => AgentStep;
  /** Injectable clock (defaults to `Date.now`). */
  now?: () => number;
}

export interface AccountedPurchaseApproval {
  readonly allowed: boolean;
  readonly reason?: string;
  /** Reservation held above the backend; drive `commit`/`abort` from the lifecycle. */
  readonly reservationId?: string;
  /** Mandate the reservation drew from. */
  readonly mandateId?: string;
}

export interface AccountedPurchaseAuthority {
  /** Evaluate mandate scope/budget and atomically reserve usage on approval. */
  approve(params: {
    agreement: TradeAgreement;
    intent: PurchaseIntent;
  }): Promise<EdgeOperationResult<AccountedPurchaseApproval>>;
  /** Commit the reservation after the purchase succeeds (consumes budget). */
  commit(reservationId: string, executionProof?: unknown): Promise<void>;
  /** Abort the reservation after a failed/cancelled purchase (releases budget). */
  abort(reservationId: string, reason: string): Promise<void>;
  /** Surface expired-unsettled reservations; their budget stays HELD until reconciliation. */
  recover(runId?: string): Promise<OutOfBandReservation[]>;
  /** Explicitly settle a recovered reservation. `'definitely-not-executed'` is the only release. */
  reconcile(
    reservationId: string,
    outcome: ReservationSettlementOutcome,
    opts?: { receipt?: StepReceipt; reason?: string },
  ): Promise<void>;
  /** Live counters read from the same authority (no second accounting layer). */
  counts(): Promise<{ committed: number; reserved: number; aborted: number; unknown: number }>;
}

/**
 * Wrap the agent-policy accounting authority as a purchase authority port.
 * The returned `approve` is a drop-in for the buyer's `AuthorityPort`; callers
 * that need the reservation to settle MUST drive `commit`/`abort` from the
 * purchase lifecycle (`recover`/`reconcile` cover the crash window).
 */
export function createAccountedPurchaseAuthority(
  options: AccountedPurchaseAuthorityOptions,
): AccountedPurchaseAuthority {
  const { grantBound, usageStore, run } = options;
  const now = options.now ?? (() => Date.now());

  const stepFor =
    options.stepFor ??
    (({ agreement, intent }): AgentStep => ({
      runId: run.runId,
      stepId: agreement.agreementId,
      sequence: 1,
      action: {
        action: 'purchase.pay',
        principal: run.principal,
        agent: run.agentId,
        target: agreement.seller,
        constraints: {
          agreementId: agreement.agreementId,
          negotiationId: agreement.negotiationId,
          resource: intent.resource,
          amount: agreement.terms.price,
          tokenId: agreement.terms.tokenId ?? '0x00',
        },
        nonce: agreement.agreementId,
      },
    }));

  return {
    async approve(params) {
      try {
        const step = stepFor(params);
        const result: AuthorizeStepResult = await grantBound.authorizeStep(run, step, now());
        if (!result.allowed) {
          return {
            ok: true,
            data: { allowed: false, reason: result.reason ?? 'authority denied purchase' },
          };
        }
        return {
          ok: true,
          data: {
            allowed: true,
            reservationId: result.reservation?.reservationId,
            mandateId: result.matchedMandateId,
          },
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async commit(reservationId, executionProof) {
      await grantBound.commitStep(reservationId, executionProof);
    },

    async abort(reservationId, reason) {
      await grantBound.abortStep(reservationId, reason);
    },

    recover: (runId) => usageStore.recoverReservations(runId),

    reconcile: (reservationId, outcome, opts) => usageStore.reconcileReservation(reservationId, outcome, opts),

    async counts() {
      return {
        committed: await usageStore.countCommitted(run.runId),
        reserved: await usageStore.countReserved(run.runId),
        aborted: await usageStore.countAborted(run.runId),
        unknown: await usageStore.countUnknown(run.runId),
      };
    },
  };
}
