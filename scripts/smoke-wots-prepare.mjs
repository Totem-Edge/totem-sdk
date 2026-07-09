// import 'node-fetch-polyfill'; // Replit often bundles fetch; this keeps node portability
const API = process.env.API_URL || `http://localhost:${process.env.PORT||5000}`;
const KEY = process.env.AXIA_API_KEY || 'dev-internal-key';

async function main() {
  const body = {
    txId: "tx_demo_001",
    rootPublicKey: "0x" + "ab".repeat(32), // 32-byte hex (WOTS root pubkey digest)
    to: "MxDEMOADDRESS0000000000000000000000000000000000000000000000000", // placeholder
    amount: "0.01",
    tokenId: "0x00",
    digestL2: null,
    digestL3: null,
    ttlMs: 20000
  };

  const res = await fetch(`${API}/v1/wots-hardened/prepare`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY
    },
    body: JSON.stringify(body)
  });

  const txt = await res.text();
  console.log("Status:", res.status);
  console.log("Body  :", txt);
  try {
    const obj = JSON.parse(txt);
    const lanes = obj.lease ?? { l1: obj.l1, l2: obj.l2, l3: obj.l3 };
    console.log("Lanes :", lanes);
    if (obj.digestTx) console.log("digestTx:", obj.digestTx);
  } catch {}
}

main().catch(e => { console.error(e); process.exit(1); });