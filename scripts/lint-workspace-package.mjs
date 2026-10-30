#!/usr/bin/env node
/** Mandatory shared JS/TS lint. Generated/native outputs are not source evidence. */
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED_DIRECTORIES = new Set([
  'node_modules', 'dist', 'build', 'coverage', 'target', 'pkg', 'pkg-node', 'pkg-web',
]);

export function collectLintFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    // Do not follow links into dependencies or other packages.
    if (entry.isDirectory() && !GENERATED_DIRECTORIES.has(entry.name)) {
      files.push(...collectLintFiles(path));
    } else if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/.test(entry.name) && !/\.d\.[cm]?ts$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

export async function lintPackage(directory, { cwd = ROOT, configFile = join(ROOT, 'eslint.config.mjs') } = {}) {
  const packageDir = resolve(directory);
  if (!existsSync(join(packageDir, 'package.json'))) throw new Error(`No package manifest in ${packageDir}`);
  const files = collectLintFiles(packageDir);
  if (files.length === 0) throw new Error(`No JS/TS source files selected for ${packageDir}`);
  const eslint = new ESLint({ cwd, overrideConfigFile: configFile, allowInlineConfig: false });
  for (const file of files) {
    if (await eslint.isPathIgnored(file)) throw new Error(`Selected source is ignored by shared lint config: ${file}`);
  }
  const results = await eslint.lintFiles(files);
  if (results.length !== files.length) throw new Error('Shared lint did not return a result for every selected file');
  return {
    fileCount: files.length,
    errorCount: results.reduce((sum, result) => sum + result.errorCount, 0),
    warningCount: results.reduce((sum, result) => sum + result.warningCount, 0),
    results,
    eslint,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/lint-workspace-package.mjs <package-directory>');
    const report = await lintPackage(process.argv[2]);
    if (report.errorCount) {
      const formatter = await report.eslint.loadFormatter('stylish');
      process.stderr.write(formatter.format(report.results.filter((result) => result.errorCount > 0)));
    }
    console.log(`Shared lint: ${report.fileCount} files, ${report.errorCount} errors, ${report.warningCount} advisory warnings`);
    process.exitCode = report.errorCount ? 1 : 0;
  } catch (error) {
    console.error(`Shared lint failed: ${error.message}`);
    process.exitCode = 1;
  }
}
