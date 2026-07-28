import { sha3_256, bytesToHex } from '@totemsdk/core'

export interface IdentityVerificationConfig {
  identityPk: string
  claimHash: string
  policyRoot?: string
}

export interface DelegationProofConfig {
  delegatorPk: string
  delegatePk: string
  expiryBlock?: bigint
  delegationRoot?: string
}

export interface RotationConfig {
  oldPk: string
  newPk: string
  rotationDelayBlocks: bigint
}

export interface RevocationConfig {
  authorityPk: string
  revocationEpoch: number
}

export function buildIdentityVerificationScript(config: IdentityVerificationConfig): string {
  const lines: string[] = [
    `LET identityPk = 0x${config.identityPk}`,
    `LET claimHash = 0x${config.claimHash}`,
    ``,
    `ASSERT SIGNEDBY(identityPk)`,
    ``,
    `LET claimData = STATE(2)`,
    `LET computedHash = SHA3(claimData)`,
    `ASSERT computedHash == claimHash`,
  ]

  if (config.policyRoot) {
    lines.push(
      ``,
      `ASSERT PROOF(identityPk 0 0x${config.policyRoot} 0 STATE(3))`,
      `MAST 0x${config.policyRoot}`,
    )
  }

  lines.push(``, `RETURN TRUE`)
  return lines.join('\n')
}

export function buildDelegationProofScript(config: DelegationProofConfig): string {
  const lines: string[] = [
    `LET delegatorPk = STATE(0)`,
    `LET delegatePk = STATE(1)`,
    ``,
    `ASSERT SAMESTATE(0 2)`,
  ]

  if (config.delegationRoot) {
    lines.push(
      ``,
      `ASSERT PROOF(delegatePk 0 0x${config.delegationRoot} 0 STATE(3))`,
    )
  } else {
    lines.push(
      ``,
      `ASSERT delegatePk == 0x${config.delegatePk}`,
    )
  }

  if (config.expiryBlock !== undefined) {
    lines.push(
      ``,
      `LET expiryBlock = STATE(2)`,
      `ASSERT @BLOCK < expiryBlock`,
    )
  }

  lines.push(``, `RETURN TRUE`)
  return lines.join('\n')
}

export function buildRotationScript(config: RotationConfig): string {
  return [
    `LET oldPk = 0x${config.oldPk}`,
    `LET newPk = 0x${config.newPk}`,
    `LET delay = ${config.rotationDelayBlocks.toString()}`,
    ``,
    `ASSERT PREVSTATE(0) == oldPk`,
    ``,
    `IF SIGNEDBY(oldPk) AND SIGNEDBY(newPk) THEN`,
    `ELSE`,
    `  RETURN FALSE`,
    `ENDIF`,
    ``,
    `ASSERT SAMESTATE(1 3)`,
    ``,
    `LET initBlock = PREVSTATE(1)`,
    `ASSERT @BLOCK - initBlock >= delay`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

export function buildRevocationScript(config: RevocationConfig): string {
  return [
    `LET authority = 0x${config.authorityPk}`,
    `LET revocationEpoch = ${config.revocationEpoch}`,
    ``,
    `ASSERT SIGNEDBY(authority)`,
    ``,
    `LET currentEpoch = STATE(0)`,
    `ASSERT currentEpoch EQ revocationEpoch`,
    ``,
    `ASSERT SAMESTATE(1 3)`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}
