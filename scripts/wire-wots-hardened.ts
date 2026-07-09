#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(".");

// Candidate server entrypoints
const candidates = [
  "packages/axia-api/src/index.ts",
  "server/app/index.ts",
];

console.log("=== WOTS HARDENED ROUTER WIRING (IDEMPOTENT) ===");

for (const rel of candidates) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) continue;

  let src = readFileSync(file, 'utf8');
  let modified = false;

  // 1) Ensure imports exist
  const needImportRouter = !src.includes("wotsHardenedRouter");
  const needImportMigrate = !src.includes("migrateWots");

  if (needImportRouter && !src.includes(`from './wots/hardenedRoutes'`) && !src.includes(`from "./wots/hardenedRoutes"`)) {
    src = `import { wotsHardenedRouter } from './wots/hardenedRoutes';\n` + src;
    modified = true;
    console.log(`✅ Added wotsHardenedRouter import`);
  }
  if (needImportMigrate && !src.includes(`from './wots/leaseStore'`) && !src.includes(`from "./wots/leaseStore"`)) {
    src = `import { migrateWots } from './wots/leaseStore';\n` + src;
    modified = true;
    console.log(`✅ Added migrateWots import`);
  }

  // 2) Ensure migrateWots() is called exactly once
  if (!src.match(/\bmigrateWots\s*\(\s*\)\s*;/)) {
    // Put it near the other boot-time init. After imports is OK.
    const firstNonImport = src.search(/\n(?!import )/);
    if (firstNonImport > -1) {
      src = src.slice(0, firstNonImport) + `\n// Ensure WOTS tables (or in-memory maps) are ready\nmigrateWots();\n` + src.slice(firstNonImport);
    } else {
      src += `\n// Ensure WOTS tables (or in-memory maps) are ready\nmigrateWots();\n`;
    }
    modified = true;
    console.log(`✅ Added migrateWots() initialization`);
  }

  // 3) Ensure router is mounted on /v1/wots-hardened
  if (!src.includes("/v1/wots-hardened")) {
    // Find a good anchor to insert after (any app.use line) or before server listen
    const appUseMatches = [...src.matchAll(/app\.use\([^\)]*\);\s*/g)];
    const listenMatch = src.match(/(app\.listen|server\.listen)\s*\(/);

    let inserted = false;

    // Try to insert after last app.use(...)
    if (appUseMatches.length > 0) {
      const last = appUseMatches[appUseMatches.length-1];
      const idx = last.index! + last[0].length;
      src = src.slice(0, idx) + `\n// Hardened WOTS lease/finalize endpoints\napp.use('/v1/wots-hardened', wotsHardenedRouter());\n` + src.slice(idx);
      inserted = true;
    }

    // Otherwise, insert just before listen()
    if (!inserted && listenMatch && listenMatch.index != null) {
      const idx = listenMatch.index;
      src = src.slice(0, idx) + `\n// Hardened WOTS lease/finalize endpoints\napp.use('/v1/wots-hardened', wotsHardenedRouter());\n` + src.slice(idx);
      inserted = true;
    }

    // Fallback: append at end
    if (!inserted) {
      src += `\n// Hardened WOTS lease/finalize endpoints\napp.use('/v1/wots-hardened', wotsHardenedRouter());\n`;
    }

    if (inserted) {
      modified = true;
      console.log(`✅ Added /v1/wots-hardened router mount`);
    }
  }

  if (modified) {
    writeFileSync(file, src);
    console.log(`✅ Patched: ${rel}`);
  } else {
    console.log(`ℹ️  Already configured: ${rel}`);
  }
  
  // Found and processed a file, exit successfully
  process.exit(0);
}

// If we got here, none found
console.error("❌ No known server entrypoint found to patch (checked packages/axia-api/src/index.ts and server/app/index.ts).");
process.exit(2);