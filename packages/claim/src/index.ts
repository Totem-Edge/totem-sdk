/**
 * `@totemsdk/claim` — payload-agnostic claim envelope and policy semantics.
 *
 * This package owns *what a claim means*: the envelope shape, the policy union,
 * the pure authorization evaluator, vesting arithmetic, and the canonical hash.
 * It owns no persistence, transport, tenancy or settlement.
 */

export * from './policy.js';
export * from './vesting.js';
export * from './envelope.js';
