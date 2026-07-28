/**
 * Runtime-compatibility guard.
 *
 * Verifies that the @totemsdk/omnia-vtxo package does not import any
 * Node-specific or DOM-specific APIs that would break Bare/Pear-style
 * Totem Edge deployments.
 *
 * Banned: node:crypto, fs, path, net, http, https, child_process,
 *         window, document, localStorage, DOM globals.
 */

import * as fs from 'fs';
import * as path from 'path';

const BANNED_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'node:crypto',      re: /from\s+['"]node:crypto['"]/g },
  { label: 'require(crypto)',  re: /require\(\s*['"]crypto['"]\s*\)/g },
  { label: 'fs module',        re: /from\s+['"](?:node:)?fs['"]/g },
  { label: 'path module',      re: /from\s+['"](?:node:)?path['"]/g },
  { label: 'net module',       re: /from\s+['"](?:node:)?net['"]/g },
  { label: 'http module',      re: /from\s+['"](?:node:)?https?['"]/g },
  { label: 'child_process',    re: /from\s+['"](?:node:)?child_process['"]/g },
  { label: 'window global',    re: /\bwindow\s*\./g },
  { label: 'document global',  re: /\bdocument\s*\./g },
  { label: 'localStorage',     re: /\blocalStorage\s*[.[]/g },
];

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'node_modules') {
      results.push(...collectSourceFiles(full));
    } else if (entry.isFile() && /\.ts$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

describe('Runtime compatibility guard', () => {
  const srcDir = path.resolve(__dirname, '..');
  const sourceFiles = collectSourceFiles(srcDir);

  it('finds at least one source file to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  for (const { label, re } of BANNED_PATTERNS) {
    it(`does not import banned API: ${label}`, () => {
      const violations: string[] = [];
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const relPath = path.relative(srcDir, file);
        const matches = content.match(new RegExp(re.source, 'g'));
        if (matches && matches.length > 0) {
          violations.push(`${relPath}: found ${matches.length} match(es) for "${label}"`);
        }
      }
      if (violations.length > 0) {
        fail(`Banned import "${label}" found:\n  ${violations.join('\n  ')}`);
      }
    });
  }
});
