const { existsSync, readFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');

for (const output of ['pkg', 'pkg-node']) {
  const directory = join(__dirname, '..', 'rust', output);
  const required = ['edge_mqtt_wasm.js', 'edge_mqtt_wasm.d.ts', 'edge_mqtt_wasm_bg.wasm', 'package.json'];
  if (output === 'pkg') required.push('edge_mqtt_wasm_bg.js');
  for (const file of required) {
    if (!existsSync(join(directory, file))) {
      throw new Error(`Missing MQTT WASM asset rust/${output}/${file}; run build:wasm before packing`);
    }
  }
  const bytes = readFileSync(join(directory, 'edge_mqtt_wasm_bg.wasm'));
  if (!bytes.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))) {
    throw new Error(`Invalid MQTT WASM header in rust/${output}`);
  }
  // wasm-pack's generated '*' ignore otherwise excludes these declared files
  // from the SDK tarball. Remove only this known generated output ignore.
  rmSync(join(directory, '.gitignore'), { force: true });
}
