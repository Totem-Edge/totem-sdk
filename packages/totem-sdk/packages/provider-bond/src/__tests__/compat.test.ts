import * as fs from 'fs';
import * as path from 'path';

const FORBIDDEN_IMPORTS = [
  'node:crypto',
  'node:fs',
  'node:path',
  'node:net',
  'node:http',
  'node:https',
  'node:child_process',
  'window',
  'document',
  'localStorage',
];

describe('compat', () => {
  it('has no forbidden runtime imports in src/', () => {
    const srcDir = path.join(__dirname, '..');
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      for (const forbidden of FORBIDDEN_IMPORTS) {
        const regex = new RegExp(`(require\\(|from\\s+)['"\`].*${forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        if (regex.test(content)) {
          // Allow in comments
          const lines = content.split('\n');
          for (const line of lines) {
            if (regex.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
              throw new Error(`Forbidden import '${forbidden}' found in ${file}: ${line.trim()}`);
            }
          }
        }
      }
    }
  });

  it('has no Buffer-only APIs without Uint8Array fallback', () => {
    const srcDir = path.join(__dirname, '..');
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      if (/\bBuffer\.from\b/.test(content) || /\bBuffer\.alloc\b/.test(content)) {
        throw new Error(`Buffer usage found in ${file} — use Uint8Array instead`);
      }
    }
  });
});
