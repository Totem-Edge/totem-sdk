/**
 * @totemsdk/qvac/raw — escape hatch passthrough to the genuine QVAC SDK.
 *
 * This is NOT a manually maintained mirror of @qvac/sdk's functions. The real
 * @qvac/sdk is heavy (worker binaries, native/plugin scaffold) and is kept out
 * of this workspace by design, so the runtime SDK is injected or lazily loaded
 * (see {@link createQvacRawClient}). What `/raw` does is hand back that exact
 * SDK object — with all of its real operations, plugin clients, constants and
 * error classes — so consumers who need the full upstream surface can reach it
 * directly without going through the provider abstraction.
 *
 * The 54-operation snapshot in `api-snapshot.ts` exists purely as a drift check
 * against the upstream surface; it is not the runtime surface itself.
 */

export type { QvacSdkLike, QvacOpHandler, QvacCallResult, QvacOpShape, QvacUsageExtractor } from './qvac-sdk.js';
export { QVAC_OP_SHAPES, qvacOpShape } from './qvac-sdk.js';
export { createQvacIntelligenceProvider } from './provider.js';
export type { QvacProviderOptions } from './qvac-sdk.js';
import type { QvacSdkLike } from './qvac-sdk.js';

/**
 * The genuine raw QVAC SDK surface, preserved with its real upstream types.
 *
 * `S` defaults to the retained `QvacSdkLike` structural seam; consumers who
 * have the real `@qvac/sdk` installed can pass its type directly:
 *
 * @example
 *   import * as qvac from '@qvac/sdk';
 *   const raw = createQvacRawClient({ sdk: qvac });
 *   raw.completion({ modelId, history }) // typed as CompletionRun
 */
export type QvacRawClient<S = QvacSdkLike> = S;

/**
 * Obtain the genuine raw QVAC SDK surface.
 *
 * Identity passthrough returning the injected SDK unchanged — no filtering, no
 * re-listing, no provider normalisation. Type `S` with the real `@qvac/sdk`
 * module type to retain the full upstream surface while editing.
 */
export function createQvacRawClient<S>(options: { sdk: S }): S {
  return options.sdk;
}

/**
 * Retrieve the SDK surface currently bound to a QVAC intelligence provider.
 *
 * Returns `undefined` when the provider was created lazily and has not yet
 * resolved its SDK. Call `provider.invoke` first (which forces resolution) if
 * you need the handle.
 */
export function getQvacRawSdk<S = QvacSdkLike>(provider: { readonly sdk?: S }): S | undefined {
  return provider.sdk;
}