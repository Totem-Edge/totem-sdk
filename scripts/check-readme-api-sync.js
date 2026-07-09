#!/usr/bin/env node

/**
 * Check that README.md code block method references stay in sync with the
 * canonical allowed-methods list in TOTEM_CONNECT.md (section 3 "Allowed Methods").
 *
 * Usage: node scripts/check-readme-api-sync.js
 * Exits 0 if all methods found in README code blocks are listed in TOTEM_CONNECT.md.
 * Exits 1 if any unrecognised method names are found, printing a clear diff.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const README_PATH = path.join(ROOT, 'README.md');
const TOTEM_CONNECT_PATH = path.join(ROOT, 'packages/totem-extension/docs/TOTEM_CONNECT.md');

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Extract all TOTEM_* method names referenced inside fenced code blocks in a
 * Markdown file.  Only looks inside ``` ... ``` blocks to avoid matching
 * prose references.
 */
function extractReadmeMethods(markdown) {
  const methods = new Set();

  // Collect every fenced code block (``` or ~~~, with optional language tag)
  const fenceRe = /^[ \t]*(?:```|~~~)[^\n]*\n([\s\S]*?)^[ \t]*(?:```|~~~)/gm;
  let block;
  while ((block = fenceRe.exec(markdown)) !== null) {
    const code = block[1];
    // Match  method: 'TOTEM_SOMETHING'  or  method: "TOTEM_SOMETHING"
    const methodRe = /method\s*:\s*['"`](TOTEM_[A-Z_]+)['"`]/g;
    let m;
    while ((m = methodRe.exec(code)) !== null) {
      methods.add(m[1]);
    }
  }

  return methods;
}

/**
 * Extract the canonical allowed method names from TOTEM_CONNECT.md.
 * Looks for the "Allowed Methods" table (section 3) and pulls out every
 * `TOTEM_*` name that appears in a table row.
 */
function extractCanonicalMethods(markdown) {
  const methods = new Set();

  // Find the "Allowed Methods" section
  const sectionStart = markdown.indexOf('### Allowed Methods');
  if (sectionStart === -1) {
    console.error('ERROR: Could not find "### Allowed Methods" section in TOTEM_CONNECT.md');
    process.exit(1);
  }

  // Take text from that heading until the next heading (## or ###) or end of file
  const afterSection = markdown.slice(sectionStart);
  const nextHeadingMatch = afterSection.search(/\n#{1,3} /);
  const sectionText = nextHeadingMatch === -1
    ? afterSection
    : afterSection.slice(0, nextHeadingMatch);

  // Extract TOTEM_* names from table cells (backtick-wrapped inside | ... | rows)
  const cellRe = /\|\s*`(TOTEM_[A-Z_]+)`/g;
  let m;
  while ((m = cellRe.exec(sectionText)) !== null) {
    methods.add(m[1]);
  }

  if (methods.size === 0) {
    console.error('ERROR: No TOTEM_* methods found in the "Allowed Methods" table. ' +
      'Check that TOTEM_CONNECT.md still uses the expected table format.');
    process.exit(1);
  }

  return methods;
}

function main() {
  const readmeMarkdown = readFile(README_PATH);
  const connectMarkdown = readFile(TOTEM_CONNECT_PATH);

  const readmeMethods = extractReadmeMethods(readmeMarkdown);
  const canonicalMethods = extractCanonicalMethods(connectMarkdown);

  console.log('Canonical allowed methods (TOTEM_CONNECT.md):');
  [...canonicalMethods].sort().forEach(m => console.log(`  - ${m}`));

  console.log('\nMethods referenced in README.md code blocks:');
  if (readmeMethods.size === 0) {
    console.log('  (none found)');
  } else {
    [...readmeMethods].sort().forEach(m => console.log(`  - ${m}`));
  }

  const unknown = [...readmeMethods].filter(m => !canonicalMethods.has(m));

  if (unknown.length === 0) {
    console.log('\nOK: All README method references are present in TOTEM_CONNECT.md.');
    process.exit(0);
  } else {
    console.error('\nFAIL: The following method(s) appear in README.md code blocks but are NOT listed');
    console.error('      in the "Allowed Methods" table of TOTEM_CONNECT.md:');
    unknown.forEach(m => console.error(`  - ${m}`));
    console.error('\nFix: Either update README.md to use the current method names, or add the new');
    console.error('method to the "Allowed Methods" table in packages/totem-extension/docs/TOTEM_CONNECT.md.');
    process.exit(1);
  }
}

main();
