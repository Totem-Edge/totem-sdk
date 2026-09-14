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

export type { QvacSdkLike, QvacOpHandler, QvacCallResult, QvacUsageExtractor } from './qvac-sdk.js';
export { createQvacIntelligenceProvider } from './provider.js';
export type { QvacProviderOptions } from './qvac-sdk.js';
import type { QvacSdkLike } from './qvac-sdk.js';

/**
 * Obtain the genuine raw QVAC SDK surface.
 *
 * `options.sdk` is typically the real `@qvac/sdk` module (or a compatible
 * injected copy in tests). The object is returned as-is — identity
 * passthrough, no filtering and no re-listing of operations.
 *
 * @example
 *   import { createQvacRawClient } from '@totemsdk/qvac/raw';
 *   const raw = createQvacRawClient({ sdk: qvac });
 *   await raw.completion({ model: 'llama3', prompt: '...' });
 */
export function createQvacRawClient(options: { sdk: QvacSdkLike }): QvacSdkLike {
  return options.sdk;
}

/**
 * Retrieve the SDK surface currently bound to a QVAC intelligence provider.
 *
 * Returns `undefined` when the provider was created lazily and has not yet
 * resolved its SDK. Call `provider.invoke` first (which forces resolution) if
 * you need the handle.
 */
export function getQvacRawSdk(provider: { readonly sdk?: QvacSdkLike }): QvacSdkLike | undefined {
  return provider.sdk;
}