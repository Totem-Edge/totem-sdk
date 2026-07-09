import { wotsKeypairFromSeed } from "../src/wots";
import { WOTS_V1_DEV, WOTS_V2_SPEC } from "../src/params";
import * as fs from "fs";
import * as path from "path";

// Generate test vectors for PKdigest under v1 and v2
function generateTestVectors() {
  // Fixed seed: 0x11 repeated 32 times
  const seed = new Uint8Array(32).fill(0x11);
  const index = 0;
  
  // Generate v1 PKdigest
  const v1Keypair = wotsKeypairFromSeed(seed, index, WOTS_V1_DEV);
  const v1PkHex = Array.from(v1Keypair.pk)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Generate v2 PKdigest
  const v2Keypair = wotsKeypairFromSeed(seed, index, WOTS_V2_SPEC);
  const v2PkHex = Array.from(v2Keypair.pk)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const vectors = {
    seed: "0x" + Array.from(seed).map(b => b.toString(16).padStart(2, '0')).join(''),
    index: index,
    v1: {
      paramSet: "v1-dev",
      w: 8,
      L: 89,
      ctx: "MM|wots|sk|v1",
      pkDigest: "0x" + v1PkHex
    },
    v2: {
      paramSet: "v2-spec", 
      w: 256,
      L: 34,
      ctx: "MM|wots|sk|v2",
      pkDigest: "0x" + v2PkHex
    },
    note: "PKdigests should be different due to domain separation"
  };
  
  // Verify they're different
  if (v1PkHex === v2PkHex) {
    throw new Error("ERROR: v1 and v2 PKdigests are identical! Domain separation failed.");
  }
  
  console.log("✓ Confirmed v1 PKdigest ≠ v2 PKdigest");
  console.log("  v1:", vectors.v1.pkDigest.substring(0, 20) + "...");
  console.log("  v2:", vectors.v2.pkDigest.substring(0, 20) + "...");
  
  // Write to file
  const outputPath = path.join(__dirname, "..", "test-vectors", "wots-digests.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(vectors, null, 2));
  console.log("✓ Written to test-vectors/wots-digests.json");
  
  return vectors;
}

// Run if executed directly
if (require.main === module) {
  generateTestVectors();
}

export { generateTestVectors };