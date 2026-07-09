const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '..', 'packages');
const versionMap = {};

for (const pkg of fs.readdirSync(packagesDir)) {
  const pkgJsonPath = path.join(packagesDir, pkg, 'package.json');
  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    versionMap[pkgJson.name] = pkgJson.version;
  } catch {}
}

for (const pkg of fs.readdirSync(packagesDir)) {
  const pkgJsonPath = path.join(packagesDir, pkg, 'package.json');
  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    let changed = false;
    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (pkgJson[depType]) {
        for (const dep of Object.keys(pkgJson[depType])) {
          if (dep.startsWith('@totemsdk/') && versionMap[dep]) {
            const currentVer = pkgJson[depType][dep];
            if (currentVer === 'workspace:*' || currentVer.startsWith('workspace:^')) {
              pkgJson[depType][dep] = '^' + versionMap[dep];
              changed = true;
            }
          }
        }
      }
    }
    if (changed) {
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf-8');
      console.log('Updated ' + pkg);
    }
  } catch (e) {
    console.error('Error processing ' + pkg + ': ' + e.message);
  }
}
console.log('Done');
