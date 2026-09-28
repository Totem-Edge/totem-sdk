/**
 * edge/governed-commerce.ts — Governed purchase actions (RFC-019).
 *
 * Agent commerce is reachable ONLY through the governed action registry
 * (`createAgentEdgeRuntime().executeAction`). These definitions wrap the
 * trusted `EdgeBuyer` so that:
 *
 *   prepare  → discovery / negotiation / agreement preparation (no payment)
 *   deriveEffects → canonical spend facts from the PREPARED agreement
 *   authorizeAndReserve → (the governed runtime)
 *   execute  → exactly the prepared agreement (authority approval skipped)
 *
 * `createEdge()` remains a trusted-host primitive; agents never receive the
 * buyer, the payment port, or the authority port.
 */

import type { BuiltinActionRegistration } from './actions.js';
import type { EdgeBuyer, BuyOptions, PreparedPurchase } from './purchasing/buyer.js';
import type {
  NegotiationLimits,
  NegotiationStrategy,
  PurchaseIntent,
  TradeTerms,
} from './purchasing/types.js';
import type { SignedManifest } from '@totemsdk/manifest';
import type { StepEffects } from '@totemsdk/agent-policy';

export interface GovernedCommerceConfig {
  /** The trusted-host buyer. Held privately by the governed action definitions. */
  buyer: EdgeBuyer;
  /** Default negotiation strategy for the negotiated purchase path. */
  strategy?: NegotiationStrategy;
  /** Default negotiation limits. */
  negotiation?: Partial<NegotiationLimits>;
}

function noEffects(): StepEffects {
  return { spends: [], fees: [], channels: [] };
}

function agreementEffects(terms: TradeTerms, seller: string): StepEffects {
  const payable = terms.price !== '0' && terms.paymentMethod !== 'free';
  return {
    spends: payable
      ? [{ tokenId: terms.tokenId ?? '0x00', amount: terms.price, recipient: seller }]
      : [],
    fees: [],
    channels: [],
  };
}

/**
 * Build the governed commerce action definitions.
 *
 * Register these into the same `EdgeActionRegistry` used by
 * `createAgentEdgeRuntime()`; the agent can then reach commerce only via
 * `executeAction('purchase:buy' | 'purchase:negotiate')`.
 */
export function createGovernedPurchaseActions(config: GovernedCommerceConfig): BuiltinActionRegistration[] {
  const { buyer, strategy: defaultStrategy, negotiation: defaultNegotiation } = config;

  return [
    {
      action: 'purchase:buy',
      def: {
        capability: 'purchase:buy',
        effect: 'spend',
        prepare: async (input) => {
          const payload = (input.payload ?? {}) as {
            intent?: PurchaseIntent;
            acquireBy?: number;
            negotiation?: Partial<NegotiationLimits>;
            strategy?: NegotiationStrategy;
            context?: Record<string, unknown>;
          };
          if (!payload.intent) throw new Error('purchase:buy requires payload.intent');
          const options: BuyOptions = {
            intent: payload.intent,
            acquireBy: payload.acquireBy,
            negotiation: { ...defaultNegotiation, ...payload.negotiation },
            strategy: payload.strategy ?? defaultStrategy,
            context: payload.context,
          };
          // Discovery + negotiation + agreement preparation only — no payment.
          return buyer.prepareBuy(options);
        },
        deriveEffects: (prepared) => {
          const p = prepared as PreparedPurchase;
          return agreementEffects(p.agreement.terms, p.agreement.seller);
        },
        execute: async (prepared) => {
          // Execute exactly the authorized prepared agreement. Authority was
          // already granted + reserved by the governed runtime.
          const result = await buyer.executePrepared(prepared as PreparedPurchase, { skipAuthority: true });
          return { ok: true, data: result };
        },
      },
    },
    {
      action: 'purchase:negotiate',
      def: {
        capability: 'purchase:negotiate',
        effect: 'spend',
        prepare: async (input) => {
          const payload = (input.payload ?? {}) as {
            manifest?: SignedManifest;
            desiredTerms?: TradeTerms;
            limits?: Partial<NegotiationLimits>;
            strategy?: NegotiationStrategy;
          };
          if (!payload.manifest || !payload.desiredTerms) {
            throw new Error('purchase:negotiate requires payload.manifest and payload.desiredTerms');
          }
          const strategy = payload.strategy ?? defaultStrategy;
          if (!strategy) throw new Error('purchase:negotiate requires a negotiation strategy');
          return buyer.negotiate({
            manifest: payload.manifest,
            desiredTerms: payload.desiredTerms,
            limits: { ...defaultNegotiation, ...payload.limits },
            strategy,
          });
        },
        deriveEffects: (prepared) => {
          const result = prepared as { agreement?: { terms: TradeTerms; seller: string } };
          if (!result.agreement) return noEffects();
          return agreementEffects(result.agreement.terms, result.agreement.seller);
        },
        execute: async (prepared) => ({ ok: true, data: prepared }),
      },
    },
  ];
}
