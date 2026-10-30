const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

// CJS is emitted one directory deeper than ESM. Keep its native WASM bridge
// bound to the same packaged artifact, rather than a nonexistent dist/rust copy.
const cjs = join(__dirname, '..', 'dist', 'cjs');
const bridge = join(cjs, 'wasm-sync.js');
const source = readFileSync(bridge, 'utf8');
const original = 'require("../rust/pkg-node/edge_mqtt_wasm.js")';
if (source.split(original).length !== 2) {
  throw new Error('Expected exactly one compiled MQTT WASM import to relocate');
}
writeFileSync(bridge, source.replace(original, 'require("../../rust/pkg-node/edge_mqtt_wasm.js")'));
writeFileSync(join(cjs, 'package.json'), JSON.stringify({ type: 'commonjs' }) + '\n');
