#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(".");
const API_DIRS = [
  "packages/axia-api",
  "apps/axia-api",
  "services/axia-api",
  "axia-api"
].map(p=>join(ROOT,p));

const apiDir = API_DIRS.find(d=>existsSync(join(d,"package.json")));
if(!apiDir){
  console.log("Could not locate axia-api package folder. Checked:\n - "+API_DIRS.join("\n - "));
  process.exit(2);
}

// NOTE: This script previously added @axia/minima-primitives (now removed)
// If you need dev route functionality, update imports to use Totem extension primitives
console.log("• Skipping obsolete @axia/minima-primitives dependency");

// Create a safe dev route if we can't confidently patch existing routes
const srcDir = join(apiDir,"src");
const devDir = join(srcDir,"dev");
if(!existsSync(devDir)) mkdirSync(devDir, { recursive: true });

const devRoutePath = join(devDir,"totem.ts");
if(!existsSync(devRoutePath)){
  writeFileSync(devRoutePath, `import { Router } from "express";
// NOTE: Update imports to use Totem extension primitives if needed
// import { wots, minima-base32 } from "packages/totem-extension/src/core/..."

export const totemDev = Router();

/**
 * POST /v1/dev/totem/simulate
 * Placeholder dev route - update with actual Totem primitives if needed
 */
totemDev.post("/simulate", (req, res) => {
  res.status(501).json({ 
    ok: false, 
    error: "Dev route requires update to use Totem extension primitives"
  });
});
`);
  console.log("✔ Created dev route stub:", devRoutePath);
} else {
  console.log("• Dev route already exists:", devRoutePath);
}

// Try to mount the dev route into server/app/index.ts if found
const candidates = ["server.ts","app.ts","index.ts"].map(f=>join(srcDir,f)).filter(p=>existsSync(p));
if(candidates.length){
  const entry = candidates[0];
  let code = readFileSync(entry,"utf8");
  if(!code.includes('totemDev')){
    if(!code.includes('express')) {
      // try a minimal express bootstrap if this is a very small app
      code = `import express from "express";\n` + code;
    }
    code = `import { totemDev } from "./dev/totem";\n` + code;
    // naive mount – append at end if not found
    if(!code.includes('app.use("/v1/dev/totem"')){
      code = code + `\n// Auto-mounted Totem dev route\ntry {\n  // @ts-ignore\n  app?.use?.("/v1/dev/totem", totemDev);\n} catch {}\n`;
    }
    writeFileSync(entry, code);
    console.log("✔ Mounted dev route in:", entry);
  } else {
    console.log("• Dev route already referenced in:", entry);
  }
} else {
  console.log("• Could not find a server entry (server.ts/app.ts/index.ts). Mount manually:\n  app.use(\"/v1/dev/totem\", totemDev);\n  (import from \"./dev/totem\")");
}

console.log("\nDone. Dev route stub created.\nTo use, update imports to reference Totem extension primitives.");