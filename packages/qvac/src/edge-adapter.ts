/**
 * @totemsdk/qvac/edge — Edge intelligence port binding.
 *
 * Composes the QVAC provider with @totemsdk/intelligence's provider-neutral
 * `createEdgeIntelligencePort`, so the resulting port is a first-class
 * `EdgeIntelligencePort` that @totemsdk/edge hosts. The port contract lives in
 * @totemsdk/intelligence — qvac never depends on @totemsdk/edge, and edge never
 * depends on qvac.
 */

import { createEdgeIntelligencePort } from '@totemsdk/intelligence';
import type { EdgeIntelligencePort } from '@totemsdk/intelligence';

import { createQvacIntelligenceProvider } from './provider.js';
import type { QvacProviderOptions } from './qvac-sdk.js';

/**
 * Deprecated alias of @totemsdk/intelligence's EdgeIntelligencePort, kept for
 * API compatibility. New consumers should type against EdgeIntelligencePort.
 */
export type QvacEdgeIntelligencePort = EdgeIntelligencePort;

/**
 * Create an EdgeIntelligencePort-compatible QVAC intelligence port.
 *
 * Equivalent to `createEdgeIntelligencePort(createQvacIntelligenceProvider(opts))`.
 */
export function createQvacEdgeIntelligencePort(
  options: QvacProviderOptions,
): QvacEdgeIntelligencePort {
  return createEdgeIntelligencePort(createQvacIntelligenceProvider(options));
}