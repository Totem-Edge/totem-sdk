/**
 * RFC-005 #8: every template declares an explicit stability level.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATE_STABILITY, getTemplateStability } from '../index.js';

describe('template stability registry', () => {
  it('has an entry for every template file', () => {
    const dir = join(__dirname, '..', 'templates');
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.ts'))
      .map(f => f.replace(/\.ts$/, ''));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(TEMPLATE_STABILITY[file]).toBeDefined();
    }
  });

  it('marks current templates experimental and unaudited', () => {
    for (const entry of Object.values(TEMPLATE_STABILITY)) {
      expect(entry.stability).toBe('experimental');
      expect(entry.audited).toBe(false);
    }
  });

  it('resolves known templates and rejects unknown ones', () => {
    expect(getTemplateStability('treasury')?.template).toBe('treasury');
    expect(getTemplateStability('does-not-exist')).toBeUndefined();
  });
});
