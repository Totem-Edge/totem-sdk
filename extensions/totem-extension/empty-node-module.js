// Build-time shim for `node:*` builtins requested by workspace packages.
//
// @totemsdk/minima-rpc's raw-HTTP fallback does `await import('node:net')` /
// `import('node:tls')` inside try/catch and treats a rejection as "the Node
// transport is unavailable", falling back to fetch. Webpack cannot resolve the
// `node:` URI scheme for a browser target (UnhandledSchemeError), so those
// requests are rewritten here. Throwing on load makes the guarded dynamic
// import reject, so the extension cleanly reports the Node path as unavailable
// instead of receiving a half-populated module.
throw new Error('node: builtin is not available in the browser extension bundle');
