/**
 * compile-wasm.js
 *
 * Compiles src/wasm/miner.wat → src/wasm/miner.wasm using the `wabt` npm
 * package (WebAssembly Binary Toolkit, pure JS — no native tools required).
 *
 * Usage:
 *   node scripts/compile-wasm.js
 *   npm run compile:wasm
 *
 * The compiled binary is committed to the repository so consumers do not
 * need to run this script themselves. Re-run after editing miner.wat.
 */

const fs = require('fs');
const path = require('path');

const SRC_WAT = path.join(__dirname, '..', 'src', 'wasm', 'miner.wat');
const OUT_WASM = path.join(__dirname, '..', 'src', 'wasm', 'miner.wasm');

async function main() {
  // Try to load wabt from the project or a temporary install
  let wabtMod;
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'wabt'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'wabt'),
    path.join('/tmp/wabt-install/node_modules/wabt'),
  ];

  for (const candidate of candidates) {
    try {
      wabtMod = require(candidate);
      console.log(`Using wabt from: ${candidate}`);
      break;
    } catch {
      // continue
    }
  }

  if (!wabtMod) {
    throw new Error(
      'wabt npm package not found. Install it:\n' +
      '  npm install --save-dev wabt\n' +
      '  # or: npm install --prefix /tmp/wabt-install wabt\n'
    );
  }

  const wabt = await wabtMod();

  const watSource = fs.readFileSync(SRC_WAT, 'utf8');
  console.log(`Compiling ${SRC_WAT} ...`);

  const module = wabt.parseWat('miner.wat', watSource, {
    mutable_globals: true,
    sat_float_to_int: true,
    sign_extension: true,
    bulk_memory: false,
  });

  module.validate();

  const { buffer } = module.toBinary({ log: false, write_debug_names: false });
  const wasmBytes = Buffer.from(buffer);

  fs.writeFileSync(OUT_WASM, wasmBytes);
  console.log(
    `✓ Written ${wasmBytes.length} bytes to ${OUT_WASM}`
  );

  module.destroy();
}

main().catch(err => {
  console.error('compile-wasm failed:', err.message);
  process.exit(1);
});
