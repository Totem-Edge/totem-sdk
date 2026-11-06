/**
 * @totemsdk/act-training — RFC-077 G1 governed training action.
 */

export {
  TRAINING_ACTION,
  TRAINING_CAPABILITY,
} from './types.js';
export type { TrainingPlan, TrainingActionOptions } from './types.js';

export {
  createTrainingActionDefinitions,
  computeTrainingPlanDigest,
  sealTrainingPlan,
} from './adapter.js';
