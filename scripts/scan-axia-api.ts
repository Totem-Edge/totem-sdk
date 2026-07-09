#!/usr/bin/env tsx
import { readdirSync, statSync, readFileSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(".");
const hits:string[] = [];

function walk(dir:string){
  for(const f of readdirSync(dir)){
    const p = join(dir,f);
    const s = statSync(p);
    if(s.isDirectory()){
      if(f === "node_modules" || f === "dist" || f === ".git") continue;
      walk(p);
    } else {
      if (/axia[-]?api/.test(p) || /\/wots\//.test(p) || /leaseStore\.ts$/.test(p) || /hardenedRoutes\.ts$/.test(p) || /server\.ts$/.test(p) || /app\.ts$/.test(p) || /index\.ts$/.test(p)) {
        hits.push(p);
      }
    }
  }
}
walk(ROOT);

function peek(p:string, max=40){
  try {
    const txt = readFileSync(p,"utf8");
    const lines = txt.split(/\r?\n/);
    return lines.slice(0,max).map((l,i)=>String(i+1).padStart(3," ")+": "+l).join("\n");
  } catch { return ""; }
}

const candidates = {
  axiaApiDir: hits.find(p=>/packages\/axia-api\/package\.json$/.test(p))?.replace(/\/package\.json$/,"") ||
              hits.find(p=>/axia-api\/src\//.test(p))?.split("/src/")[0] || "",
  leaseStore: hits.find(p=>/leaseStore\.ts$/.test(p)) || "",
  hardenedRoutes: hits.find(p=>/hardenedRoutes\.ts$/.test(p)) || "",
  serverFile: hits.find(p=>/(^|\/)packages\/axia-api\/src\/(server|app|index)\.ts$/.test(p)) || ""
};

console.log("=== AXIA API DISCOVERY ===");
console.log(JSON.stringify(candidates, null, 2));
if (candidates.leaseStore) {
  console.log("\n--- leaseStore.ts (head) ---\n"+peek(candidates.leaseStore));
}
if (candidates.hardenedRoutes) {
  console.log("\n--- hardenedRoutes.ts (head) ---\n"+peek(candidates.hardenedRoutes));
}
if (candidates.serverFile) {
  console.log("\n--- server/app/index.ts (head) ---\n"+peek(candidates.serverFile));
}
console.log("\nTip: copy these results here and I'll generate exact patches if needed.");