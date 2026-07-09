import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(__dirname, '..', 'packages');

// Build version map from all package.json files
const versionMap = {};
for (const pkg of readdirSync(packagesDir)) {
  const pkgJsonPath = join(packagesDir, pkg, 'package.json');
  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    versionMap[pkgJson.name] = pkgJson.version;
  } catch {}
}

// Replace workspace:* and workspace:^X.Y.Z with ^version
for (const pkg of readdirSync(packagesDir)) {
  const pkgJsonPath = join(packagesDir, pkg, 'package.json');
  try {
    let content = readFileSync(pkgJsonPath, 'utf-8');
    const original = content;
    
    // Replace workspace:* and workspace:^X.Y.Z with ^version
    content = content.replace(/"@totemsdk\/([^"]+)":\s*"workspace:\*"/g, (match, depName) => {
      const ver = versionMap[`@totemsdk/${depName}`];
      if (!ver) {
        console.error(`WARNING: No version found for @totemsdk/${depName} in ${pkg}`);
        return match;
      }
      return `"@totemsdk/${depName}": "^${ver}"`;
    });
    
    content = content.replace(/"@totemsdk\/([^"]+)":\s*"workspace:\^([^"]+)"/g, (match, depName, range) => {
      const ver = versionMap[`@totemsdk/${depName}`];
      if (!ver) {
        console.error(`WARNING: No version found for @totemsdk/${depName} in ${pkg}`);
        return match;
      }
      return `"@totemsdk/${depName}": "^${ver}"`;
    });
    
    if (content !== original) {
      writeFileSync(pkgJsonPath, content, 'utf-8');
      console.log(`Updated ${pkg}`);
    }
  } catch (e) {
    console.error(`Error processing ${pkg}: ${e.message}`);
  }
}

console.log('Done replacing workspace deps');
