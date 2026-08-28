import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// Parse workspace-gates.config.json to get maturity levels
const gatesConfig = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'scripts/workspace-gates.config.json'), 'utf-8')
);

// Build a map of package path -> maturity
const maturityMap = new Map();
for (const [pkgPath, config] of Object.entries(gatesConfig.packages)) {
  if (config.status === 'publishable' && config.maturity) {
    maturityMap.set(pkgPath, config.maturity);
  }
}

const changes = [];

for (const [pkgPath, maturity] of maturityMap) {
  const pkgJsonPath = path.join(REPO_ROOT, pkgPath, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) continue;

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  const currentVersion = pkgJson.version;
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  let targetVersion = null;
  let action = 'no change';

  if (maturity === 'v1') {
    // V1 packages must be at 1.0.0 or higher (major version >= 1)
    if (major === 0) {
      targetVersion = '1.0.0';
      action = `bump 0.x to V1: ${currentVersion} → 1.0.0`;
    } else if (major === 1) {
      // Already V1, but check if it has meaningful releases to preserve
      // For packages that are already at 1.x, keep their version
      action = `already V1: ${currentVersion}`;
    } else {
      action = `unexpected: ${currentVersion} (major=${major})`;
    }
  } else if (maturity === 'rc') {
    // RC packages should be at 0.2.0 or higher (minor >= 2)
    if (major === 0 && minor < 2) {
      targetVersion = `0.2.0`;
      action = `bump to RC: ${currentVersion} → 0.2.0`;
    } else if (major === 0 && minor === 2 && patch === 0) {
      action = `already RC baseline: ${currentVersion}`;
    } else {
      // Already at >= 0.2.0, keep current version
      action = `already >= RC baseline: ${currentVersion}`;
    }
  }

  if (targetVersion) {
    pkgJson.version = targetVersion;
    // Preserve indentation from original file
    const originalContent = fs.readFileSync(pkgJsonPath, 'utf-8');
    const indent = originalContent.match(/^\s{2}/m) ? '  ' : '    ';
    const newVersionLine = `${indent}"version": "${targetVersion}",`;
    const oldVersionRegex = new RegExp(`("${pkgJson.version}"|"version":\\s*")[^"]+(")`);
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, pkgJson.version === targetVersion ? 2 : 2) + '\n');
    changes.push({ pkgPath, currentVersion, targetVersion, action });
  } else {
    changes.push({ pkgPath, currentVersion, targetVersion: 'unchanged', action });
  }
}

// Summary
console.log('=== Version Bump Summary ===\n');
const changed = changes.filter(c => c.targetVersion !== 'unchanged');
const notChanged = changes.filter(c => c.targetVersion === 'unchanged');

console.log(`Packages changed: ${changed.length}`);
console.log(`Packages unchanged: ${notChanged.length}\n`);

console.log('--- Changed packages ---');
for (const c of changed) {
  console.log(`  ${c.pkgPath}: ${c.action}`);
}

console.log('\n--- Unchanged packages ---');
for (const c of notChanged) {
  console.log(`  ${c.pkgPath}: ${c.action}`);
}
