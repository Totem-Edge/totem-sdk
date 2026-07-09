// Fetch is available natively in Node.js 18+
const API = process.env.API_URL || `http://localhost:${process.env.PORT||5000}`;
const KEY = process.env.AXIA_API_KEY || 'dev-internal-key';
const SIGNED_HEX = process.env.SIGNED_HEX; // provide a real signature when ready
const USE_SIG_ONLY = process.env.USE_SIG_ONLY === '1'; // dev path to /finalize-sig

function flatIndexFromLanes(l1, l2, l3) {
  if ((l1|l2|l3) & ~63) throw new Error('lane out of range');
  return (l1 * 64 * 64) + (l2 * 64) + l3;
}

async function main() {
  // 1) PREPARE
  const prepBody = {
    txId: `tx_demo_${Date.now()}`,
    rootPublicKey: "0x" + "ab".repeat(32),
    to: "MxDEMOADDRESS0000000000000000000000000000000000000000000000000",
    amount: "0.01",
    tokenId: "0x00",
    digestL2: null, digestL3: null,
    ttlMs: 20000
  };

  const prepRes = await fetch(`${API}/v1/wots-hardened/prepare`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY },
    body: JSON.stringify(prepBody)
  });
  const prepTxt = await prepRes.text();
  if (!prepRes.ok) {
    console.error("Prepare failed", prepRes.status, prepTxt);
    process.exit(1);
  }
  const prep = JSON.parse(prepTxt);
  const leaseToken = prep.leaseToken;
  const lanes = prep.lease ?? { l1: prep.l1, l2: prep.l2, l3: prep.l3 };
  const digestTx = prep.digestTx ?? null;
  console.log("PREPARE OK");
  console.log("leaseToken:", leaseToken);
  console.log("lanes    :", lanes);
  if (digestTx) console.log("digestTx :", digestTx);
  try {
    console.log("flatIndex:", flatIndexFromLanes(lanes.l1, lanes.l2, lanes.l3));
  } catch (e) { /* ignore */ }

  if (!SIGNED_HEX) {
    console.log("\nNo SIGNED_HEX provided. Next steps:");
    console.log("  1) Use MiniMask to sign the exact digest your server expects");
    console.log("  2) Run (quote your hex!):");
    console.log("     SIGNED_HEX='0xdeadbeef...' npm run smoke:wots:e2e\n");
    return;
  }

  // 2) FINALIZE (switchable)
  const endpoint = USE_SIG_ONLY ? 'finalize-sig' : 'finalize';
  const body = USE_SIG_ONLY
    ? { leaseToken, signatureHex: SIGNED_HEX } 
    : { leaseToken, signedHex: SIGNED_HEX };
  const finRes = await fetch(`${API}/v1/wots-hardened/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY },
    body: JSON.stringify(body)
  });
  const finTxt = await finRes.text();
  console.log("FINALIZE status:", finRes.status);
  console.log("FINALIZE body  :", finTxt);
}

main().catch(e => { console.error(e); process.exit(1); });