/**
 * Compile-time script validation through the KISSVM parser.
 *
 * Every generated policy script should be parsed before publication
 * to catch malformed KISSVM syntax early. This module validates
 * individual scripts and complete recursive paths.
 */

import { parseScript } from '@totemsdk/kissvm';

export interface ScriptValidationResult {
  valid: boolean;
  script: string;
  error?: string;
  nodeCount: number;
}

export interface PathValidationResult {
  valid: boolean;
  scripts: ScriptValidationResult[];
  totalNodes: number;
  errors: string[];
}

export function validatePolicyScript(script: string): ScriptValidationResult {
  try {
    const ast = parseScript(script);
    return {
      valid: true,
      script,
      nodeCount: ast.length,
    };
  } catch (err) {
    return {
      valid: false,
      script,
      error: err instanceof Error ? err.message : String(err),
      nodeCount: 0,
    };
  }
}

export function validatePolicyScripts(scripts: string[]): PathValidationResult {
  const results = scripts.map(validatePolicyScript);
  const errors = results.filter(r => !r.valid).map(r => r.error!);
  return {
    valid: errors.length === 0,
    scripts: results,
    totalNodes: results.reduce((sum, r) => sum + r.nodeCount, 0),
    errors,
  };
}

export function validateRecursivePath(scripts: string[]): PathValidationResult {
  return validatePolicyScripts(scripts);
}
