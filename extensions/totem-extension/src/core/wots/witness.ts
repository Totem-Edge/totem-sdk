/**
 * Assemble the Minima-style witness bundle for a tx:
 * - 3 WOTS Signature Proofs (L1->L2, L2->L3, Tx)
 * - Each proof includes: winternitz public key (leaf), root key, mmr path, signature (90 x 32-byte nodes as 0x..)
 *
 * NOTE: This file DOES NOT serialize to the on-wire HEX for Minima. That serializer
 * should live server-side. We still return a {bundle} and optional {hex} placeholder.
 */

export type Hex = `0x${string}`;
export type Signature34Hex = Hex[]; // array of 34 x 0x..32-byte elements (L=34 chains, w=8 WOTS)

export type MMRProofChunk = {
  left: boolean;
  data: { data: Hex; value: string }; // matches examples you've seen from /txnlist proofs
};

export type MMRProof = {
  blocktime: string;         // often "0"
  prooflength: number;       // count of chunks
  proof: MMRProofChunk[];
};

export type WotsSigProof = {
  publickey: Hex;            // WOTS leaf public key (hash)
  rootkey: Hex;              // the tree root this proof climbs to (L1, L2, or L3)
  proof: MMRProof;           // MMR proof path leaf->root
  signature: Signature34Hex; // 34 elements (L=34 chains, w=8 WOTS)
};

export type WitnessBundle = {
  txId: string;              // your working txn id on server (e.g. "preview")
  rootPublicKey: Hex;        // the L1 root that appears in the script/address
  indices: { l1: number; l2: number; l3: number };
  // Three proofs in hierarchical order
  proofs: {
    l1_to_l2: WotsSigProof;  // L1 leaf signs L2 root
    l2_to_l3: WotsSigProof;  // L2 leaf signs L3 root
    tx:       WotsSigProof;  // L3 leaf signs tx digest
  };
};

export type BuildInput = {
  txId: string;
  rootPublicKey: Hex;
  indices: { l1: number; l2: number; l3: number };
  // Signatures produced locally (from your signWithPlan):
  sigs: {
    sigL1: Signature34Hex;   // L1 signs digestL2
    sigL2: Signature34Hex;   // L2 signs digestL3
    sigTx: Signature34Hex;   // L3 signs digestTx
    // Also include the corresponding WOTS leaf public keys if you compute them;
    // if not, set to the leaf pk hash you derived alongside signing.
    pubL1: Hex;
    pubL2: Hex;
    pubL3: Hex;
    // And the 3 tree roots you signed (digests). These are the "rootkey" for each proof.
    rootL1: Hex;             // == rootPublicKey (sanity check)
    rootL2: Hex;             // the L2 root anchored by (L1, l1)
    rootL3: Hex;             // the L3 root anchored by (L2, l2)
  };
  // Proof paths (fetched via your API during prepare, or precomputed client-side):
  proofs: {
    proofL1toL2: MMRProof;
    proofL2toL3: MMRProof;
    proofTx:     MMRProof;   // proof for the L3 leaf used to sign tx
  };
};

/**
 * Build the canonical witness JSON bundle (server can serialize to hex).
 * We also return `hex: null` as a placeholder to keep the API stable.
 */
export async function buildSignedHexWithWitness(inp: BuildInput): Promise<{ hex: string | null; bundle: WitnessBundle }> {
  // Light sanity checks
  if (inp.sigs.rootL1.toLowerCase() !== inp.rootPublicKey.toLowerCase()) {
    console.warn("rootL1 != rootPublicKey — check your derivations/inputs.");
  }

  const bundle: WitnessBundle = {
    txId: inp.txId,
    rootPublicKey: inp.rootPublicKey,
    indices: { ...inp.indices },
    proofs: {
      l1_to_l2: {
        publickey: inp.sigs.pubL1,
        rootkey:   inp.sigs.rootL1,
        proof:     normalizeProof(inp.proofs.proofL1toL2),
        signature: inp.sigs.sigL1
      },
      l2_to_l3: {
        publickey: inp.sigs.pubL2,
        rootkey:   inp.sigs.rootL2,
        proof:     normalizeProof(inp.proofs.proofL2toL3),
        signature: inp.sigs.sigL2
      },
      tx: {
        publickey: inp.sigs.pubL3,
        rootkey:   inp.sigs.rootL3,
        proof:     normalizeProof(inp.proofs.proofTx),
        signature: inp.sigs.sigTx
      }
    }
  };

  // Placeholder: we intentionally do NOT implement Minima wire serialization here.
  // Keep on client as JSON; the server should convert to on-wire HEX.
  const hex: string | null = null;

  return { hex, bundle };
}

function normalizeProof(p: MMRProof): MMRProof {
  // Ensure structure is consistent (prooflength == proof.length)
  return {
    blocktime: p.blocktime ?? "0",
    prooflength: Array.isArray(p.proof) ? p.proof.length : Number(p.prooflength || 0),
    proof: Array.isArray(p.proof) ? p.proof.map(ch => ({
      left: !!ch.left,
      data: { data: ch.data.data as Hex, value: String(ch.data.value ?? "0") }
    })) : []
  };
}

// Simplified buildWitnessForTx for the script
export async function buildWitnessForTx({ msgHash, keypair, paramSet }: any) {
  // Stub implementation - real signing would happen here
  const signature = Array(34).fill('0x' + '00'.repeat(32)) as Signature34Hex;
  
  return {
    version: 2,
    index: keypair.index,
    pkdigest: keypair.pkdigest,
    signature,
    paramSet
  };
}