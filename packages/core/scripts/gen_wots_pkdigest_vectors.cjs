// scripts/gen_wots_pkdigest_vectors.cjs
const fs = require('fs');
const path = require('path');
const { sha3_256 } = require('js-sha3');

// Since this is a CommonJS script, we need to implement the minimal functions we need
const h = (data) => {
  const bytes = typeof data === "string" ? Buffer.from(data, 'utf8') : data;
  return new Uint8Array(sha3_256.arrayBuffer(bytes));
};

const concat = (parts) => {
  const len = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

const u32be = (n) => {
  const buf = new Uint8Array(4);
  buf[0] = (n >>> 24) & 0xff;
  buf[1] = (n >>> 16) & 0xff;
  buf[2] = (n >>> 8) & 0xff;
  buf[3] = n & 0xff;
  return buf;
};

const u16be = (n) => {
  const buf = new Uint8Array(2);
  buf[0] = (n >>> 8) & 0xff;
  buf[1] = n & 0xff;
  return buf;
};

const chainStep = (x, step) => {
  const tag = Buffer.from("CH" + String.fromCharCode(0) + step, 'utf8');
  return h(concat([tag, x]));
};

const chainIter = (x0, k, start = 0) => {
  let x = x0;
  for (let i = 0; i < k; i++) x = chainStep(x, start + i);
  return x;
};

function prfChainSeed(seed, i, j, paramSet) {
  if (seed.length !== 32) {
    throw new Error('Seed must be exactly 32 bytes');
  }
  const ctxBytes = Buffer.from(paramSet.ctx, 'utf8');
  const msg = concat([ctxBytes, seed, u32be(i), u16be(j)]);
  return new Uint8Array(sha3_256.arrayBuffer(msg));
}

const WOTS_V1_DEV = { 
  name: 'v1-dev', 
  n: 256, 
  w: 8, 
  L: 89, 
  ctx: 'MM|wots|sk|v1' 
};

const WOTS_V2_SPEC = { 
  name: 'v2-spec', 
  n: 256, 
  w: 256, 
  L: 34, 
  ctx: 'MM|wots|sk|v2' 
};

function derivePKdigest(seed, i, paramSet) {
  if (!(seed instanceof Uint8Array) || seed.length !== 32) throw new Error('seed must be 32 bytes');
  
  const tops = [];
  for (let j = 0; j < paramSet.L; j++) {
    const sk_j = prfChainSeed(seed, i, j, paramSet);
    const top = chainIter(sk_j, paramSet.w - 1);
    tops.push(top);
  }
  
  return h(concat(tops));
}

const hex = (u) => Buffer.from(u).toString('hex');
const seed = new Uint8Array(Array(32).fill(0x11)); // fixed 0x11*32

const out = {
  seed_hex: hex(seed),
  indices: [0,1,2,3],
  v1_dev: [],
  v2_spec: [],
};

for (const i of out.indices) {
  out.v1_dev.push(hex(derivePKdigest(seed, i, WOTS_V1_DEV)));
  out.v2_spec.push(hex(derivePKdigest(seed, i, WOTS_V2_SPEC)));
}

const file = path.join(__dirname, '..', 'test-vectors', 'wots-pkdigest.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('Wrote', file);