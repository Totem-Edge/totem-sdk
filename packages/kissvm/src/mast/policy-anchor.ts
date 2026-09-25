/**
 * Policy Anchor Coin — a stable on-chain UTXO whose locking script commits to
 * a set of policy roots that can rotate through state updates.
 *
 * The anchor is **fail-closed**: `STATE(actionRoot)` must be one of the
 * enabled action codes, and every MAST root executed by the anchor is bound
 * to a committed `PREVSTATE` root. A spender cannot supply an arbitrary root.
 *
 * Enabled branches:
 *   0. Normal action — MAST a committed policy root selected via state
 *   1. Root rotation — MAST the committed owner root; exactly one root changes
 *   2. Epoch advancement — MAST the committed owner root; epoch advances by 1
 *   3. Recovery — MAST the committed recovery root (only if configured)
 *   4. Emergency — MAST the committed emergency root (only if configured)
 *
 * Invariants enforced for every successful branch:
 *   - Same subject identity (`STATE(0)`)
 *   - Manifest commitment unchanged
 *   - Root ports preserved except the single port a rotation declares
 *   - Epoch unchanged, except the epoch-advancement branch (exact +1)
 *   - Successor anchor preserved at the input index (`VERIFYOUT(@INPUT …)`)
 *
 * Residual limitation: KISSVM exposes no output-count primitive, so the
 * anchor cannot itself count duplicate anchor outputs. "Exactly one successor
 * output" is enforced for the input-indexed output only; duplicate-output
 * prevention must be enforced by the revealed action branch or the
 * transaction planner.
 *
 * State port assignments (defaults):
 *   State 0  = subject ID
 *   State 10 = current regulator policy root
 *   State 11 = current owner policy root
 *   State 12 = current service-provider root
 *   State 13 = current firmware-approval root
 *   State 14 = policy epoch
 *   State 15 = policy-manifest commitment
 *   State 16 = recovery root
 *   State 17 = emergency root
 *   State 18 = action selector (0–4)
 *   State 19 = action argument (selected root, or rotation target port)
 */

export interface PolicyAnchorConfig {
  subjectId: string;
  subjectType: 'vehicle' | 'machine' | 'device' | 'site' | 'fleet' | 'building';
  institutionalRoot: string;
  initialEpoch: number;
  ports: {
    regulatorRoot: number;
    ownerRoot: number;
    serviceProviderRoot: number;
    firmwareApprovalRoot: number;
    epoch: number;
    manifestHash: number;
    recoveryRoot: number;
    emergencyRoot: number;
    actionRoot: number;
  };
  recoveryRoot?: string;
  emergencyRoot?: string;
}

/**
 * Validate a {@link PolicyAnchorConfig}'s port assignments.
 *
 * Throws when two ports collide, when a port is not a non-negative integer,
 * when the reserved subject port (0) is reused, or when the action-argument
 * port (`actionRoot + 1`) collides with a committed port. Collisions would
 * let one state slot be interpreted two ways and are a fail-open risk, so
 * they are rejected at build time rather than at spend time.
 */
export function validatePolicyAnchorConfig(config: PolicyAnchorConfig): void {
  const ports = config.ports;
  const entries = Object.entries(ports) as Array<[keyof PolicyAnchorConfig['ports'], number]>;
  const seen = new Map<number, string>();

  for (const [name, port] of entries) {
    if (!Number.isInteger(port) || port < 0) {
      throw new Error(`policy-anchor: port '${name}' must be a non-negative integer (got ${port})`);
    }
    if (seen.has(port)) {
      throw new Error(`policy-anchor: port collision — '${name}' and '${seen.get(port)}' both use ${port}`);
    }
    seen.set(port, name);
  }

  if (seen.has(0)) {
    throw new Error(`policy-anchor: port 0 is reserved for the subject id (used by '${seen.get(0)}')`);
  }

  const actionArgPort = ports.actionRoot + 1;
  if (seen.has(actionArgPort)) {
    throw new Error(
      `policy-anchor: action-argument port ${actionArgPort} (actionRoot + 1) collides with '${seen.get(actionArgPort)}'`,
    );
  }
}

export function buildPolicyAnchorScript(config: PolicyAnchorConfig): string {
  validatePolicyAnchorConfig(config);
  const p = config.ports;

  const enabledActions = [0, 1, 2];
  if (config.recoveryRoot) enabledActions.push(3);
  if (config.emergencyRoot) enabledActions.push(4);

  const rootPorts: Array<{ name: string; port: number }> = [
    { name: 'regulatorRoot', port: p.regulatorRoot },
    { name: 'ownerRoot', port: p.ownerRoot },
    { name: 'serviceProviderRoot', port: p.serviceProviderRoot },
    { name: 'firmwareRoot', port: p.firmwareApprovalRoot },
  ];

  const preserve = (port: number, indent = '  '): string =>
    `${indent}ASSERT STATE(${port}) EQ PREVSTATE(${port})`;

  // A bare `MAST <root>` statement terminates the script with the branch
  // result (ReturnSignal), so every continuity check MUST run before it.
  const continuity = `  ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`;

  const lines: string[] = [
    `// Policy Anchor: ${config.subjectId}`,
    `// Subject: ${config.subjectType}`,
    `// Fail-closed: actionType must be one of [${enabledActions.join(', ')}]`,
    `// and all MAST roots are bound to committed PREVSTATE roots.`,
    ``,
    `// ── Identity ──`,
    `LET subjectId = [${config.subjectId}]`,
    `ASSERT STATE(0) EQ subjectId`,
    ``,
    `// ── Committed roots (from PREVSTATE — never spender-supplied) ──`,
    `LET regulatorRoot = PREVSTATE(${p.regulatorRoot})`,
    `LET ownerRoot = PREVSTATE(${p.ownerRoot})`,
    `LET serviceProviderRoot = PREVSTATE(${p.serviceProviderRoot})`,
    `LET firmwareRoot = PREVSTATE(${p.firmwareApprovalRoot})`,
    `LET recoveryRoot = PREVSTATE(${p.recoveryRoot})`,
    `LET emergencyRoot = PREVSTATE(${p.emergencyRoot})`,
    ``,
    `// ── Manifest commitment must be preserved ──`,
    `ASSERT STATE(${p.manifestHash}) EQ PREVSTATE(${p.manifestHash})`,
    ``,
    `// ── Epoch ──`,
    `LET epoch = STATE(${p.epoch})`,
    `LET prevEpoch = PREVSTATE(${p.epoch})`,
    ``,
    `// ── Action selection (fail-closed whitelist) ──`,
    `// 0 = normal action, 1 = root rotation, 2 = epoch advancement,`,
    `// 3 = recovery, 4 = emergency. Any other value fails here.`,
    `LET actionType = STATE(${p.actionRoot})`,
    `ASSERT ${enabledActions.map((a) => `actionType EQ ${a}`).join(' OR ')}`,
    ``,
    `// ── Branch 0: Normal action ──`,
    `IF actionType EQ 0 THEN`,
    `  LET selectedRoot = STATE(${p.actionRoot + 1})`,
    `  ASSERT selectedRoot NEQ 0x00`,
    `  ASSERT selectedRoot EQ regulatorRoot OR selectedRoot EQ ownerRoot OR selectedRoot EQ serviceProviderRoot OR selectedRoot EQ firmwareRoot`,
    `  ASSERT epoch EQ prevEpoch`,
    ...rootPorts.map((r) => preserve(r.port)),
    continuity,
    `  MAST selectedRoot`,
    `ENDIF`,
    ``,
    `// ── Branch 1: Root rotation ──`,
    `// The argument port declares which committed root port rotates;`,
    `// every other root port must be preserved. The owner-root branch`,
    `// authorizes the specific new value.`,
    `IF actionType EQ 1 THEN`,
    `  LET targetPort = STATE(${p.actionRoot + 1})`,
    `  ASSERT targetPort EQ ${p.regulatorRoot} OR targetPort EQ ${p.ownerRoot} OR targetPort EQ ${p.serviceProviderRoot} OR targetPort EQ ${p.firmwareApprovalRoot}`,
    `  IF targetPort NEQ ${p.regulatorRoot} THEN`,
    `    ${preserve(p.regulatorRoot, '').trim()}`,
    `  ENDIF`,
    `  IF targetPort NEQ ${p.ownerRoot} THEN`,
    `    ${preserve(p.ownerRoot, '').trim()}`,
    `  ENDIF`,
    `  IF targetPort NEQ ${p.serviceProviderRoot} THEN`,
    `    ${preserve(p.serviceProviderRoot, '').trim()}`,
    `  ENDIF`,
    `  IF targetPort NEQ ${p.firmwareApprovalRoot} THEN`,
    `    ${preserve(p.firmwareApprovalRoot, '').trim()}`,
    `  ENDIF`,
    `  ASSERT epoch EQ prevEpoch`,
    continuity,
    `  MAST ownerRoot`,
    `ENDIF`,
    ``,
    `// ── Branch 2: Epoch advancement (exact +1) ──`,
    `IF actionType EQ 2 THEN`,
    `  ASSERT epoch EQ INC(prevEpoch)`,
    ...rootPorts.map((r) => preserve(r.port)),
    continuity,
    `  MAST ownerRoot`,
    `ENDIF`,
  ];

  if (config.recoveryRoot) {
    lines.push(
      ``,
      `// ── Branch 3: Recovery ──`,
      `// Root changes are delegated to the committed recovery branch.`,
      `IF actionType EQ 3 THEN`,
      `  ASSERT recoveryRoot NEQ 0x00`,
      `  ASSERT epoch EQ prevEpoch`,
      continuity,
      `  MAST recoveryRoot`,
      `ENDIF`,
    );
  }

  if (config.emergencyRoot) {
    lines.push(
      ``,
      `// ── Branch 4: Emergency ──`,
      `// Root changes are delegated to the committed emergency branch.`,
      `IF actionType EQ 4 THEN`,
      `  ASSERT emergencyRoot NEQ 0x00`,
      `  ASSERT epoch EQ prevEpoch`,
      continuity,
      `  MAST emergencyRoot`,
      `ENDIF`,
    );
  }

  lines.push(
    ``,
    `// ── Fail-closed default ──`,
    `// Every enabled action terminates via its MAST branch above. Reaching`,
    `// this point means the selector was not matched — reject the spend.`,
    `RETURN FALSE`,
  );

  return lines.join('\n');
}

export function buildPolicyAnchorState(config: PolicyAnchorConfig, initialRoots: {
  regulatorRoot?: string;
  ownerRoot?: string;
  serviceProviderRoot?: string;
  firmwareApprovalRoot?: string;
  manifestHash?: string;
  recoveryRoot?: string;
  emergencyRoot?: string;
}): Record<number, string> {
  const state: Record<number, string> = {
    0: config.subjectId,
    [config.ports.epoch]: String(config.initialEpoch),
    [config.ports.regulatorRoot]: initialRoots.regulatorRoot ?? '0x00',
    [config.ports.ownerRoot]: initialRoots.ownerRoot ?? '0x00',
    [config.ports.serviceProviderRoot]: initialRoots.serviceProviderRoot ?? '0x00',
    [config.ports.firmwareApprovalRoot]: initialRoots.firmwareApprovalRoot ?? '0x00',
    [config.ports.manifestHash]: initialRoots.manifestHash ?? '0x00',
    [config.ports.recoveryRoot]: initialRoots.recoveryRoot ?? config.recoveryRoot ?? '0x00',
    [config.ports.emergencyRoot]: initialRoots.emergencyRoot ?? config.emergencyRoot ?? '0x00',
    [config.ports.actionRoot]: '0',
  };
  return state;
}

export function buildRootRotationScript(
  port: number,
  newRoot: string,
  authorizerPkd: string,
  reason: string,
): string {
  return [
    `// Root rotation: port ${port} → ${newRoot.slice(0, 16)}…`,
    `// Reason: ${reason}`,
    `LET oldRoot = PREVSTATE(${port})`,
    `LET newRoot = 0x${newRoot}`,
    `ASSERT SIGNEDBY(0x${authorizerPkd})`,
    `ASSERT STATE(${port}) EQ newRoot`,
    `ASSERT newRoot NEQ oldRoot`,
    `RETURN TRUE`,
  ].join('\n');
}

export function buildEpochAdvancementScript(
  config: PolicyAnchorConfig,
  newEpoch: number,
  authorizerPkd: string,
): string {
  return [
    `// Epoch advancement: → ${newEpoch}`,
    `LET prevEpoch = PREVSTATE(${config.ports.epoch})`,
    `LET newEpoch = ${newEpoch}`,
    `ASSERT SIGNEDBY(0x${authorizerPkd})`,
    `ASSERT STATE(${config.ports.epoch}) EQ newEpoch`,
    `ASSERT newEpoch GT prevEpoch`,
    `RETURN TRUE`,
  ].join('\n');
}
