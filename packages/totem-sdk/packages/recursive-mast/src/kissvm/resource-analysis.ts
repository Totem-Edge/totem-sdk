/**
 * Resource analysis — checks recursive MAST paths against KISSVM limits.
 *
 * VM limits: 64 stack depth, 1,024 instructions shared across all frames.
 * This module estimates resource usage before execution to catch
 * limit violations at policy compilation time rather than at runtime.
 */

import { validatePolicyScripts } from './compile-validation.js';

export interface ResourceLimits {
  maxInstructions: number;
  maxStackDepth: number;
  maxStringBytes: number;
  maxShiftBits: number;
}

export interface ResourceAnalysis {
  withinLimits: boolean;
  estimatedInstructions: number;
  estimatedStackDepth: number;
  limits: ResourceLimits;
  warnings: string[];
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxInstructions: 1024,
  maxStackDepth: 64,
  maxStringBytes: 65536,
  maxShiftBits: 256,
};

export function analyzeResourceUsage(
  scripts: string[],
  limits: ResourceLimits = DEFAULT_LIMITS,
): ResourceAnalysis {
  const warnings: string[] = [];

  const validation = validatePolicyScripts(scripts);
  const totalNodes = validation.totalNodes;

  const estimatedInstructions = totalNodes * 8;
  const estimatedStackDepth = scripts.length * 2;

  if (estimatedInstructions > limits.maxInstructions) {
    warnings.push(
      `Estimated instructions (${estimatedInstructions}) may exceed limit (${limits.maxInstructions})`,
    );
  }

  if (estimatedStackDepth > limits.maxStackDepth) {
    warnings.push(
      `Estimated stack depth (${estimatedStackDepth}) may exceed limit (${limits.maxStackDepth})`,
    );
  }

  for (const script of scripts) {
    const bytes = new TextEncoder().encode(script).length;
    if (bytes > limits.maxStringBytes) {
      warnings.push(
        `Script size (${bytes} bytes) exceeds string limit (${limits.maxStringBytes})`,
      );
    }
  }

  return {
    withinLimits: warnings.length === 0,
    estimatedInstructions,
    estimatedStackDepth,
    limits,
    warnings,
  };
}

export function checkResourceLimits(
  scripts: string[],
  limits?: ResourceLimits,
): ResourceAnalysis {
  return analyzeResourceUsage(scripts, limits);
}
