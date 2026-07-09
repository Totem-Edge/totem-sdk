const { readFileSync, writeFileSync, readdirSync } = require('fs');
const { join } = require('path');

const packagesDir = join(__dirname, 'packages');
const versionMap = {};

for (const pkg of readdirSync(packagesDir)) {
  const pkgJsonPath = join(packagesDir, pkg, 'package.json');
  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    versionMap[pkgJson.name] = pkgJson.version;
  } catch {}
}

for (const pkg of readdirSync(packagesDir)) {
  const pkgJsonPath = join(packagesDir, pkg, 'package.json');
  try {
    let content = readFileSync(pkgJsonPath, 'utf-8');
    const original = content;
    // Revert ^version back to workspace:* for internal deps
    content = content.replace(/"@totemsdk\/([^"]+)":\s*"\^([^"]+)"/g, (match, depName, ver) => {
      const expected = versionMap['@totemsdk/' + depName];
      if (expected && expected === ver) {
        return '"@totemsdk/' + depName + '": "workspace:*"';
      }
      return match;
    });
    if (content !== original) {
      writeFileSync(pkgJsonPath, content, 'utf-8');
      console.log('Reverted ' + pkg);
    }
  } catch (e) {
    console.error('Error processing ' + pkg + ': ' + e.message);
  }
}
console.log('Done reverting');
