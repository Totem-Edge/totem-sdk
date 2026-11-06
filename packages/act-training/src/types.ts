/**
 * Governed training action contracts (RFC-077 G1).
 */

import type { ComputeEffect } from '@totemsdk/agent-policy';
import type { EdgeCapability } from '@totemsdk/edge';
import type {
  TrainingRunDescriptorV1,
  TrainingPort,
} from '@totemsdk/intelligence/training';

export const TRAINING_ACTION = 'intelligence:train';
export const TRAINING_CAPABILITY: EdgeCapability = 'intelligence:llm:finetune';

/**
 * Host-owned, reviewed plan for one training run. The agent selects a plan by
 * id; it never supplies or mutates the descriptor, collection or envelope.
 */
export interface TrainingPlan {
  readonly planId: string;
  readonly descriptor: TrainingRunDescriptorV1;
  readonly trainingExampleIds: readonly string[];
  readonly resourceEnvelope: ComputeEffect;
}

export interface TrainingActionOptions {
  /** Provider-neutral training port (QVAC is one implementation). */
  readonly port: TrainingPort;
  /** Host-owned plans, keyed by plan id. */
  readonly plans: Readonly<Record<string, TrainingPlan>>;
  /** Approved host/resource pool used for compute effects. */
  readonly resourceId: string;
  /** Defaults to `intelligence:train`. */
  readonly actionKind?: string;
  /** Defaults to `intelligence:llm:finetune`. */
  readonly capability?: EdgeCapability;
}
