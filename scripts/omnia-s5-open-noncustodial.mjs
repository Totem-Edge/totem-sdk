#!/usr/bin/env node
/** Open a factory + virtual channel between two hosts and leave it active. */
const A = process.env.HOST_A;
const B = process.env.HOST_B;
const TOKEN = process.env.RPC_TOKEN ?? 'test';
const CONTRIBUTION = process.env.OMNIA_S5_CONTRIBUTION ?? '100000000';
const VC_AMOUNT = process.env.OMNIA_S5_VC_AMOUNT ?? '50000000';
let seq = 0;
async function rpc(base, method, params = {}) {
  const res = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }), signal: AbortSignal.timeout(120000) });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}
function transport(manifest) { let found; const walk=(v)=>{ if(!v||typeof v!=='object'||found)return; if(typeof v.transportPubkey==='string'){found=v.transportPubkey;return;} for(const c of Object.values(v))walk(c); }; walk(manifest); return found; }
async function identity(base, fallback){ const w=await rpc(base,'totem_omniaWhoami'); const m=await rpc(base,'totem_omniaGetManifest'); return {partyId:w.identityId, publicKeyDigest:w.publicKeyDigest, transportPubkey:transport(m?.manifest) ?? fallback, settlementAddress:w.settlementAddress}; }
const op=(n)=>`${n}-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
(async()=>{
  const a=await identity(A, process.env.A_TRANSPORT), b=await identity(B, process.env.B_TRANSPORT);
  const factory=await rpc(A,'totem_omniaCreateFactory',{operationId:op('factory'),tokenId:'0x00',participants:[
    {partyId:a.partyId,publicKeyDigest:a.publicKeyDigest,addressIndex:0,contributionAmount:CONTRIBUTION,...(a.transportPubkey?{transportPubkey:a.transportPubkey}:{})},
    {partyId:b.partyId,publicKeyDigest:b.publicKeyDigest,addressIndex:0,contributionAmount:CONTRIBUTION,...(b.transportPubkey?{transportPubkey:b.transportPubkey}:{})},
  ]});
  const vc=await rpc(A,'totem_omniaOpenVirtualChannel',{operationId:op('vc-open'),factoryId:factory.factoryId,partyIds:[a.partyId,b.partyId],amounts:{[a.partyId]:VC_AMOUNT,[b.partyId]:VC_AMOUNT}});
  console.log(JSON.stringify({stage:'S5_OPEN',factoryId:factory.factoryId,channelId:vc.channelId,parties:{A:a,B:b},pass:true}));
})().catch(e=>{console.error(e?.stack??e);process.exit(1);});
