#!/usr/bin/env node

import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

for (const output of ['rust/pkg', 'rust/pkg-node']) {
  const ignoreFile = join(process.cwd(), output, '.gitignore');
  if (existsSync(ignoreFile)) rmSync(ignoreFile, { force: true });
}
