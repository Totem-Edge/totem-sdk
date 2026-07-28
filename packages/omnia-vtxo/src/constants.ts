export const EMPTY_LEAF = '0000000000000000000000000000000000000000000000000000000000000000';

export const EMPTY_TREE_ROOT = '0000000000000000000000000000000000000000000000000000000000000000';

export const EPOCH_ZERO = 0;

export const DEFAULT_POLICY = {
  minAmount: BigInt(1),
  maxAmount: BigInt(1_000_000_000_000_000),
  maxMergeInputs: 8,
  maxSplitOutputs: 8,
  exitTimelockSeconds: 86400,
} as const;

export const MOCK_OPERATOR_SIGNATURE = 'mock-operator-sig-v0';

export const MOCK_BATCH_ID = 'batch-local-mvp';
