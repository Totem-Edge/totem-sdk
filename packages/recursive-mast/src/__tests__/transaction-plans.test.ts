import { computeCanonicalScriptAddress, buildPolicyAnchorScript } from '@totemsdk/kissvm';
import { createAnchorTransactionPlan } from '../transaction/anchor-transaction.js';
import { createRootRotationTransactionPlan } from '../transaction/rotation-transaction.js';
import { createActionTransactionPlan } from '../transaction/action-transaction.js';
import { buildAccessControlScript } from '../templates/access-control.js';
import { buildIdentityVerificationScript } from '../templates/identity-verification.js';
import type { PolicyAnchorConfig } from '../policy-anchor.js';

const pkA = 'aa'.repeat(32);

const anchorConfig: PolicyAnchorConfig = {
  subjectId: 'veh-1',
  subjectType: 'vehicle',
  institutionalRoot: pkA,
  initialEpoch: 0,
  ports: {
    regulatorRoot: 10,
    ownerRoot: 11,
    serviceProviderRoot: 12,
    firmwareApprovalRoot: 13,
    epoch: 14,
    manifestHash: 15,
    recoveryRoot: 16,
    emergencyRoot: 17,
    actionRoot: 18,
  },
};

const descriptor = { script: 'RETURN TRUE' } as never;

describe('RFC-016 P3: recursive transaction plans', () => {
  it('locks the anchor output to the Policy Anchor script, not the funding address', () => {
    const plan = createAnchorTransactionPlan({
      anchorConfig,
      initialRoots: {},
      fundingCoinId: '0xfund',
      fundingAddress: 'MxFUNDING',
      fundingAmount: '100',
      anchorAmount: '1',
      fundingScriptDescriptor: descriptor,
    });

    const anchorAddress = computeCanonicalScriptAddress(buildPolicyAnchorScript(anchorConfig));
    expect(plan.outputs[0].address).toBe(anchorAddress);
    expect(plan.outputs[0].address).not.toBe('MxFUNDING');
    // input still spends the funding coin
    expect(plan.inputs[0].address).toBe('MxFUNDING');
  });

  it('root rotation selects the anchor rotation branch and requires an authorizer', () => {
    const plan = createRootRotationTransactionPlan({
      anchorCoinId: '0xanchor',
      anchorAddress: 'MxANCHOR',
      anchorAmount: '1',
      anchorScriptDescriptor: descriptor,
      anchorConfig,
      rotationType: 'root',
      port: anchorConfig.ports.ownerRoot,
      newRoot: 'ff'.repeat(32),
      authorizerPkd: pkA,
      reason: 'owner change',
    });
    const out = plan.outputs[0].state as Record<number, string>;
    expect(out[anchorConfig.ports.actionRoot]).toBe('1');
    expect(out[anchorConfig.ports.actionRoot + 1]).toBe(String(anchorConfig.ports.ownerRoot));

    expect(() =>
      createRootRotationTransactionPlan({
        anchorCoinId: '0xanchor',
        anchorAddress: 'MxANCHOR',
        anchorAmount: '1',
        anchorScriptDescriptor: descriptor,
        anchorConfig,
        rotationType: 'epoch',
        newEpoch: 1,
        authorizerPkd: '',
        reason: '',
      }),
    ).toThrow(/authorizer/i);
  });

  it('access-control checks before a terminal MAST of the policy root', () => {
    const script = buildAccessControlScript({
      operatorPkd: pkA,
      action: 'read',
      target: 'valve-1',
      policyRoot: 'ff'.repeat(32),
      operatorProof: 'aa',
      scopes: ['read'],
    });
    const lines = script.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines[lines.length - 1]).toBe(`MAST 0x${'ff'.repeat(32)}`);
    expect(script).not.toContain(`MAST 0x${pkA}`);
    expect(script.indexOf('SIGNEDBY')).toBeLessThan(script.lastIndexOf('MAST'));
  });

  it('identity-verification checks before a terminal MAST of the issuer policy root', () => {
    const script = buildIdentityVerificationScript({
      documentId: 'doc-1',
      issuerPkd: pkA,
      subjectPkd: 'bb'.repeat(32),
      issuerPolicyRoot: 'ff'.repeat(32),
      issuerProof: 'aa',
      revocationPort: 2,
      claims: { 3: 'x' },
    });
    const lines = script.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines[lines.length - 1]).toBe(`MAST 0x${'ff'.repeat(32)}`);
    expect(script.indexOf('SIGNEDBY')).toBeLessThan(script.lastIndexOf('MAST'));
  });

  it('action plan binds the normal-action selector', () => {
    const plan = createActionTransactionPlan({
      anchorCoinId: '0xanchor',
      anchorAddress: 'MxANCHOR',
      anchorAmount: '1',
      anchorScriptDescriptor: descriptor,
      action: 'firmware:install',
      subjectId: 'veh-1',
      actionSelectorPort: anchorConfig.ports.actionRoot,
      disclosedScripts: [],
      witnessPlan: { mastBranches: new Map(), signatures: new Map(), scriptProofs: [] },
      outputs: [],
    });
    const out = plan.outputs[0].state as Record<number, string>;
    expect(out[anchorConfig.ports.actionRoot]).toBe('0');
  });
});
