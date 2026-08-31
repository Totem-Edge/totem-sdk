/**
 * admission/index.ts — Machine Work Admission public surface.
 *
 * Machine Work Admission allows applications to require computational proof
 * before allocating scarce resources. The work is performed against a Minima
 * block candidate so that application anti-spam work simultaneously searches
 * for valid Minima L1 blocks.
 */

export {
  createWorkChallenge,
  validateWorkChallenge,
  challengeFingerprint,
  canonicalChallenge,
  DEFAULT_CHALLENGE_TTL_MS,
  MAX_CHALLENGE_TTL_MS,
} from './challenge.js';

export {
  computeActionCommitment,
  canonicalAction,
} from './commitment.js';

export {
  mineWorkAdmission,
  type MineWorkAdmissionOptions,
} from './mine.js';

export {
  verifyWorkAdmission,
  type VerifyWorkAdmissionOptions,
} from './verify.js';

export {
  buildBlockHeaderTail,
  serializeSuperParents,
  isBlockWinner,
  templateFreshness,
  computeBlockCandidateId,
} from './template.js';

export {
  MACHINE_WORK_ADMISSION_VERSION,
  MACHINE_WORK_DOMAIN,
  type WorkChallenge,
  type MachineWorkAction,
  type MinimaWorkTemplate,
  type MinimaWorkTemplateProvider,
  type MachineWorkAdmissionProof,
  type WorkAdmissionVerification,
} from './types.js';
