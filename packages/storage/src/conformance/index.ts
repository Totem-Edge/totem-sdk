/**
 * @module @totemsdk/storage/conformance
 *
 * Conformance test harnesses for `@totemsdk/storage`.
 *
 * Both the core KV harness (`runCoreConformance`) and the artifact backend
 * harness (`runBackendConformance`) are exported from this subpath.
 */

export { runCoreConformance } from './harness.js';
export { runBackendConformance } from './backend-harness.js';