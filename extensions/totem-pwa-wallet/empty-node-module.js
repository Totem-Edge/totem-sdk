// Build-time shim for Node-only modules requested by the Omnia dependency
// closure but never taken by the browser relay path (RFC-034 A4).
//
//   - @totemsdk/omnia's `swarm.js` dynamically `import('hyperswarm')` (native,
//     pulls sodium-native); the relay transport does not use it.
//   - @totemsdk/stream-transport's Node path imports `ws`.
//   - Workspace packages reach Node builtins only via guarded `import('node:*')`
//     for their Node-only fallbacks.
//
// Throwing on load makes the guarded dynamic import reject cleanly (and the
// fallback run) instead of failing the browser build.
throw new Error('Node-only module is not available in the browser PWA bundle');
