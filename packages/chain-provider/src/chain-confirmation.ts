/**
 * chain-provider/chain-confirmation.ts — the shared confirmation definition.
 *
 * OMN-124: Omnia computed depth as `tip - created` while the deposit verifier
 * computed `tip - created + 1` and could also treat an MMR leaf index
 * (`mmrentry`) as confirmation. Two packages could therefore disagree about the
 * same coin at a threshold boundary. The implementation now lives in
 * `@totemsdk/core` and is re-exported here so chain-provider's public surface
 * advertises the single definition.
 */
export { confirmationDepth } from '@totemsdk/core';
