import type { WitnessBundle, MMRProof, WotsSigProof } from "../../src/core/wots/witness";

type Hex = `0x${string}`;
const H = (s:string)=> ("0x"+s) as Hex;

function z(n:number): Hex { return H("".padStart(n*2,"0")); } // n bytes of 0x00

function mkProof(chunks:number): MMRProof {
  const proof = Array.from({length:chunks}).map((_,i)=>({
    left: (i%2)===0,
    data: { data: H((i+1).toString().padStart(64,"0")), value: String(i) }
  }));
  return { blocktime: "0", prooflength: proof.length, proof };
}

function mkSig(len:number): Hex[] {
  // 90 for w=8 in real life; keep parametric for tests
  return Array.from({length:len}).map((_,i)=> H((i+1).toString().padStart(64,"a")));
}

function mkSigProof(pub:Hex, root:Hex, sigLen=90, chunks=6): WotsSigProof {
  return {
    publickey: pub,
    rootkey: root,
    proof: mkProof(chunks),
    signature: mkSig(sigLen)
  };
}

export function mkBundleDeterministic(): WitnessBundle {
  const root = H("f".repeat(64));        // fake L1 root
  const l2root = H("e".repeat(64));
  const l3root = H("d".repeat(64));
  const pub1 = H("1".repeat(64));
  const pub2 = H("2".repeat(64));
  const pub3 = H("3".repeat(64));

  return {
    txId: "preview",
    rootPublicKey: root,
    indices: { l1: 0, l2: 0, l3: 0 },
    proofs: {
      l1_to_l2: mkSigProof(pub1, l2root),
      l2_to_l3: mkSigProof(pub2, l3root),
      tx:       mkSigProof(pub3, l3root)
    }
  };
}