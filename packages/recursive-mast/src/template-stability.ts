/**
 * Template stability registry (RFC-005 #8).
 *
 * Every `@totemsdk/recursive-mast` template declares an explicit stability
 * level so consumers can gate on it instead of relying on an in-file comment.
 * All current templates are unaudited experiments.
 */

export type TemplateStability = 'experimental' | 'stable' | 'deprecated';

export interface TemplateStabilityEntry {
  /** Template slug (matches the source file under `src/templates/`). */
  readonly template: string;
  readonly stability: TemplateStability;
  /** Whether the template has had an independent security review. */
  readonly audited: boolean;
  readonly note?: string;
}

function experimental(template: string, note?: string): TemplateStabilityEntry {
  return {
    template,
    stability: 'experimental',
    audited: false,
    ...(note ? { note } : {}),
  };
}

/** Stability metadata for every template shipped by this package. */
export const TEMPLATE_STABILITY: Readonly<Record<string, TemplateStabilityEntry>> = Object.freeze({
  'access-control': experimental('access-control', 'Policy-gated operation authorization.'),
  commercial: experimental('commercial', 'Commercial agreements and payment terms.'),
  compliance: experimental('compliance', 'Standard-compliance pipeline.'),
  'data-privacy': experimental('data-privacy', 'Consent, retention and access logging.'),
  'device-lifecycle': experimental('device-lifecycle', 'Device onboarding/rotation/retirement.'),
  energy: experimental('energy', 'Energy dispatch and market participation.'),
  'firmware-update': experimental('firmware-update', 'Authorized firmware updates.'),
  healthcare: experimental('healthcare', 'Clinical/health data workflows.'),
  'identity-verification': experimental('identity-verification', 'Credential verification pipeline.'),
  layers: experimental('layers', 'Composable policy layers.'),
  legal: experimental('legal', 'Legal/agreement templates.'),
  'payment-channel': experimental('payment-channel', 'Channel state transition policy.'),
  recovery: experimental('recovery', 'Recovery and social-recovery flows.'),
  'rwa-lifecycle': experimental('rwa-lifecycle', 'Real-world-asset lifecycle.'),
  'sensor-proof': experimental('sensor-proof', 'Authorized sensor reading proofs.'),
  'state-machine': experimental('state-machine', 'Generic state-machine policy.'),
  'supply-chain': experimental('supply-chain', 'Supply-chain custody and provenance.'),
  treasury: experimental('treasury', 'Treasury spend and period accounting.'),
  voting: experimental('voting', 'Governance voting.'),
});

/** Stability metadata for a template slug, or `undefined` if unknown. */
export function getTemplateStability(template: string): TemplateStabilityEntry | undefined {
  return TEMPLATE_STABILITY[template];
}
