import { wotsKeypairFromSeed, wotsSign, wotsPkFromSig } from "../src/wots";
import { WOTS_V1_DEV, WOTS_V2_SPEC } from "../src/params";
import * as fs from "fs";
import * as path from "path";

// Allow v1-dev for benchmarking
process.env.WOTS_ALLOW_V1_DEV = 'true';

interface BenchResult {
  paramSet: string;
  w: number;
  L: number;
  derivePKdigest: { ms: number };
  sign: { ms: number; runs: number };
  verify: { ms: number; runs: number };
}

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function benchmarkParamSet(name: string, paramSet: any, runs: number = 20): BenchResult {
  console.log(`\nBenchmarking ${name} (w=${paramSet.w}, L=${paramSet.L})...`);
  
  const seed = randomBytes(32);
  
  // Benchmark PKdigest derivation
  console.log("  Measuring PKdigest derivation...");
  const pkStart = performance.now();
  const keypair = wotsKeypairFromSeed(seed, 0, paramSet);
  const pkEnd = performance.now();
  const pkTime = pkEnd - pkStart;
  console.log(`    PKdigest: ${pkTime.toFixed(2)}ms`);
  
  // Benchmark signing (average over runs)
  console.log(`  Measuring signing (${runs} runs)...`);
  const signTimes: number[] = [];
  for (let i = 0; i < runs; i++) {
    const message = randomBytes(32);
    const signStart = performance.now();
    const signature = wotsSign(message, seed, i, paramSet);
    const signEnd = performance.now();
    signTimes.push(signEnd - signStart);
  }
  const avgSignTime = signTimes.reduce((a, b) => a + b, 0) / runs;
  console.log(`    Sign avg: ${avgSignTime.toFixed(2)}ms`);
  
  // Benchmark verification (average over runs)
  console.log(`  Measuring verification (${runs} runs)...`);
  const verifyTimes: number[] = [];
  for (let i = 0; i < runs; i++) {
    const message = randomBytes(32);
    const signature = wotsSign(message, seed, i, paramSet);
    const verifyStart = performance.now();
    const recoveredPk = wotsPkFromSig(message, signature, paramSet);
    const verifyEnd = performance.now();
    verifyTimes.push(verifyEnd - verifyStart);
  }
  const avgVerifyTime = verifyTimes.reduce((a, b) => a + b, 0) / runs;
  console.log(`    Verify avg: ${avgVerifyTime.toFixed(2)}ms`);
  
  return {
    paramSet: name,
    w: paramSet.w,
    L: paramSet.L,
    derivePKdigest: { ms: pkTime },
    sign: { ms: avgSignTime, runs },
    verify: { ms: avgVerifyTime, runs }
  };
}

function main() {
  console.log("=== WOTS Benchmark Suite ===");
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Date: ${new Date().toISOString()}`);
  
  const results: BenchResult[] = [];
  
  // Benchmark v1-dev (w=8, L=89)
  results.push(benchmarkParamSet("v1-dev", WOTS_V1_DEV, 20));
  
  // Benchmark v2-spec (w=256, L=34)
  results.push(benchmarkParamSet("v2-spec", WOTS_V2_SPEC, 20));
  
  // Compare results
  console.log("\n=== Results Summary ===");
  for (const result of results) {
    console.log(`\n${result.paramSet} (w=${result.w}, L=${result.L}):`);
    console.log(`  PKdigest derivation: ${result.derivePKdigest.ms.toFixed(2)}ms`);
    console.log(`  Sign (avg ${result.sign.runs} runs): ${result.sign.ms.toFixed(2)}ms`);
    console.log(`  Verify (avg ${result.verify.runs} runs): ${result.verify.ms.toFixed(2)}ms`);
  }
  
  // Calculate speedup/slowdown
  const v1 = results.find(r => r.paramSet === "v1-dev")!;
  const v2 = results.find(r => r.paramSet === "v2-spec")!;
  
  console.log("\n=== v2 vs v1 Comparison ===");
  const pkRatio = v2.derivePKdigest.ms / v1.derivePKdigest.ms;
  const signRatio = v2.sign.ms / v1.sign.ms;
  const verifyRatio = v2.verify.ms / v1.verify.ms;
  
  console.log(`  PKdigest: ${pkRatio.toFixed(2)}x ${pkRatio < 1 ? 'faster' : 'slower'}`);
  console.log(`  Sign: ${signRatio.toFixed(2)}x ${signRatio < 1 ? 'faster' : 'slower'}`);
  console.log(`  Verify: ${verifyRatio.toFixed(2)}x ${verifyRatio < 1 ? 'faster' : 'slower'}`);
  
  // Check CI thresholds for v2
  console.log("\n=== CI Threshold Check (v2-spec) ===");
  const KEYGEN_THRESHOLD = 120; // ms
  const SIGN_THRESHOLD = 60; // ms
  
  let warnings = false;
  if (v2.derivePKdigest.ms > KEYGEN_THRESHOLD) {
    console.warn(`⚠️ WARNING: v2 keygen (${v2.derivePKdigest.ms.toFixed(2)}ms) exceeds ${KEYGEN_THRESHOLD}ms threshold`);
    warnings = true;
  } else {
    console.log(`✓ v2 keygen (${v2.derivePKdigest.ms.toFixed(2)}ms) within ${KEYGEN_THRESHOLD}ms threshold`);
  }
  
  if (v2.sign.ms > SIGN_THRESHOLD) {
    console.warn(`⚠️ WARNING: v2 sign (${v2.sign.ms.toFixed(2)}ms) exceeds ${SIGN_THRESHOLD}ms threshold`);
    warnings = true;
  } else {
    console.log(`✓ v2 sign (${v2.sign.ms.toFixed(2)}ms) within ${SIGN_THRESHOLD}ms threshold`);
  }
  
  if (warnings) {
    console.log("\n💡 Performance Optimization Guidance:");
    console.log("   • Consider enabling WASM SHA3 for faster hashing");
    console.log("   • Use Web Workers to offload computation from main thread");
    console.log("   • Cache derived keys when possible");
    console.log("   • Use batch operations for multiple signatures");
  }
  
  // Write results to JSON
  const outputPath = path.join(__dirname, "results.json");
  const output = {
    timestamp: new Date().toISOString(),
    platform: {
      os: process.platform,
      arch: process.arch,
      node: process.version
    },
    results,
    thresholds: {
      keygen_ms: KEYGEN_THRESHOLD,
      sign_ms: SIGN_THRESHOLD
    },
    warnings: {
      keygen_exceeded: v2.derivePKdigest.ms > KEYGEN_THRESHOLD,
      sign_exceeded: v2.sign.ms > SIGN_THRESHOLD
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✓ Results written to ${outputPath}`);
  
  // Exit with warning status if thresholds exceeded
  if (warnings) {
    process.exit(0); // Warning only, don't fail CI
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { benchmarkParamSet, BenchResult };