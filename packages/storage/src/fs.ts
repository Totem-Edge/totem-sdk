/**
 * `@totemsdk/storage/fs` — durable filesystem adapter entry point.
 *
 * Mirrors the `./fs` package export (which points at the built
 * `dist/adapters/file-store.js`) so source-based resolution (jest/ts paths)
 * can import the adapter directly.
 */

export { FileStore } from './adapters/file-store.js';
export type { FileStoreOptions } from './adapters/file-store.js';