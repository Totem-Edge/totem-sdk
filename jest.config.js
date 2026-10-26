const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

// Root Jest is an aggregator only: each package owns its transform, module
// mapping and test roots. Running one giant config from the root cannot resolve
// workspace siblings correctly (their `exports` point at gitignored `dist/`).
// Package-scoped runs stay the supported verification path:
//   pnpm --filter "@totemsdk/<pkg>..." run build
//   pnpm --filter @totemsdk/<pkg> test
const packagesDir = join(__dirname, 'packages');

const projects = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const dir = join(packagesDir, entry.name);
    return ['jest.config.js', 'jest.config.cjs']
      .map((name) => join(dir, name))
      .find((path) => existsSync(path));
  })
  .filter(Boolean);

module.exports = { projects };
