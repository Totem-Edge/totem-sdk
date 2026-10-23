#!/usr/bin/env node
/** Non-custodial VTXO + pool host APIs: coordinator host, separate wallet service. */
const HOST = process.env.HOST ?? 'http://127.0.0.1:50055/rpc';
const WALLET = process.env.WALLET ?? 'http://127.0.0.1:51060';
const TOKEN = process.env.RPC_TOKEN ?? 'test';
const POOL_COIN_ID = process.env.POOL_COIN_ID ?? '0x43BA353FC1F52F0FCFC850B648464DA325B9F01E337CB1AA69C0BC18E1A5FE39';
let seq = 0;
async function rpc(method, params = {}) {
  const res = await fetch(HOST, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
    signal: AbortSignal.timeout(120000),
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}
async function wallet(path, body) {
  const res = await fetch(`${WALLET}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`wallet ${path}: ${json.error ?? res.status}`);
  return json;
}
const hex = (b) => '0x' + Buffer.from(b).toString('hex');
const digestBytes = (v) => v instanceof Uint8Array ? v : Uint8Array.from(Object.values(v ?? {}));
const INDICES = { addressIndex: 0, l1: 0, l2: 0 };

async function signReceipt(receiptId, root, extra = {}) {
  const prepared = await rpc('omnia/prepareVtxoReceipt', { receiptId, root, epoch: 0, ...extra });
  const signed = await wallet('/sign', { digest: hex(digestBytes(prepared.requests.receipt.digest)), indices: INDICES });
  const submitted = await rpc('omnia/submitVtxoReceipt', { receiptId, signature: signed.signature });
  if (!submitted.success) throw new Error('VTXO receipt submit failed');
  return submitted.receipt;
}

(async () => {
  const pool = await rpc('omnia/createVtxoPool', {
    poolId: `noncust-vtxo-${Date.now()}`, tokenId: '0x00', totalCapacity: '1000000', nonce: `nc-${Date.now()}`,
  });
  const minted = await rpc('omnia/mintVtxo', {
    poolId: pool.pool.poolId, owner: 'alice', amount: '100000', nonce: 'mint-1',
  });
  await signReceipt(minted.receipt.receiptId, minted.vtxo.proof.root);
  const transferred = await rpc('omnia/transferVtxo', {
    vtxoId: minted.vtxo.vtxoId, recipient: 'bob', amount: '40000', nonce: 'xfer-1',
  });
  await signReceipt(transferred.receipt.receiptId, transferred.output.proof.root, { inputsAmount: '100000' });
  const refreshed = await rpc('omnia/refreshVtxo', {
    vtxoId: transferred.output.vtxoId, newEpoch: 1, nonce: 'refresh-1',
  });
  const refreshPrepared = await rpc('omnia/prepareVtxoReceipt', {
    receiptId: refreshed.receipt.receiptId,
    root: refreshed.refreshed.proof.root,
    epoch: 1,
    previousEpoch: 0,
    inputsAmount: '40000',
  });
  const refreshSig = await wallet('/sign', { digest: hex(digestBytes(refreshPrepared.requests.receipt.digest)), indices: INDICES });
  await rpc('omnia/submitVtxoReceipt', { receiptId: refreshed.receipt.receiptId, signature: refreshSig.signature });
  const exit = await rpc('omnia/initiateVtxoExit', { vtxoId: refreshed.refreshed.vtxoId });
  const exited = await rpc('omnia/completeVtxoExit', {
    vtxoId: refreshed.refreshed.vtxoId, txpowId: '0x' + '11'.repeat(32),
  });

  const poolId = `noncust-pool-${Date.now()}`;
  await rpc('omnia/createLiquidityPool', {
    poolId, operatorAddress: 'MxOPERATOR', tokenId: '0x00', purpose: 'omnia-channel-capital',
    poolType: 'community-pool', capacity: '1000000',
    feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
  });
  const deposited = await rpc('omnia/depositToPool', {
    poolId, lpAddress: 'MxLP', amount: '100000', purpose: 'omnia-channel-capital',
    underlyingUtxoRef: POOL_COIN_ID,
  });
  const allocated = await rpc('omnia/allocatePoolCapital', {
    positionId: deposited.position.positionId, amount: '50000', allocationType: 'manual-reserve',
    purpose: 'community-liquidity',
    target: { type: 'reserve', purpose: 'contingency' },
  });
  const released = await rpc('omnia/releasePoolAllocation', {
    positionId: deposited.position.positionId, amount: '50000',
  });
  const withdrawn = await rpc('omnia/withdrawPool', {
    positionId: deposited.position.positionId, amount: '1000', recipientAddress: 'MxLP',
  });
  const result = {
    stage: 'S6_S10_NONCUSTODIAL', at: new Date().toISOString(),
    vtxo: { minted: minted.vtxo.vtxoId, transferred: transferred.output.vtxoId, refreshed: refreshed.refreshed.vtxoId, exit: exit.draft?.draftType, exited: exited.vtxo.status },
    pool: { id: poolId, deposited: deposited.position.amount, allocated: allocated.allocation.amount, released: released.position?.amount, withdrawn: withdrawn.intent?.amount ?? withdrawn.position.amount },
    pass: exited.vtxo.status === 'exited' && (withdrawn.intent?.amount ?? withdrawn.position.amount) === '1000',
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
  console.log(result.pass ? 'S6_S10_NONCUSTODIAL_PASS' : 'S6_S10_NONCUSTODIAL_FAIL');
  if (!result.pass) process.exitCode = 1;
})().catch((err) => { console.error(err?.stack ?? err); console.error('S6_S10_NONCUSTODIAL_FAIL'); process.exit(1); });
