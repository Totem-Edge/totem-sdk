/**
 * RFC-031 P3 — digest of the Rust source that produces the WASM artifacts.
 *
 * Byte-for-byte rebuild equality is not portable (rustc embeds crate and
 * registry paths, and toolchain binaries differ slightly across hosts). The
 * provenance gate therefore pins the *source* digest in artifacts.json: a
 * rebuild need not match byte-for-byte, but the source that was built must
 * still be the source in the tree.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_FILES = ['Cargo.toml', 'Cargo.lock'];

function walk(directory, prefix) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full, prefix));
    } else if (entry.name.endsWith('.rs')) {
      files.push(full);
    }
  }
  return files;
}

/** SHA-256 over every Cargo manifest and Rust source file, in path order. */
export function sourceDigest(root) {
  const files = [
    ...SOURCE_FILES.map((file) => join(root, file)),
    ...walk(join(root, 'src'), 'src'),
  ]
    .filter((file) => {
      try {
        readFileSync(file);
        return true;
      } catch {
        return false;
      }
    })
    .sort();

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(relative(root, file));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}
