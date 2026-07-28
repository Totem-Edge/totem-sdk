import { evaluateScript, parseScript, buildWitness, sigdig } from '../index.js'

function hex(s: string): string {
  return s.startsWith('0x') ? s : '0x' + s
}

type TestCase = {
  name: string
  script: string
  expect: boolean
  ctx?: Record<string, unknown>
  state?: string[]
  prevState?: string[]
  witness?: Record<string, string>
}

const TESTS: TestCase[] = [
  {
    name: '01_single_signature',
    script: 'RETURN SIGNEDBY(0xAA)',
    expect: true,
    witness: { AA: 'sig' },
  },
  {
    name: '02_multisig_2_of_3',
    script: 'RETURN MULTISIG(2 0xAA 0xBB 0xCC)',
    expect: true,
    witness: { AA: 'sig1', BB: 'sig2' },
  },
  {
    name: '03_absolute_block_timelock',
    script: 'ASSERT @BLOCK GTE 1000000\nRETURN SIGNEDBY(0xAA)',
    expect: true,
    ctx: { block: 1000000 },
    witness: { AA: 'sig' },
  },
  {
    name: '04_relative_coinage_timelock',
    script: 'ASSERT @COINAGE GTE 144\nRETURN SIGNEDBY(0xAA)',
    expect: true,
    ctx: { coinage: 144 },
    witness: { AA: 'sig' },
  },
  {
    name: '05_htlc_dual_path_refund',
    script: `LET preimage = STATE(0)
LET commitment = SHA3(0x01)
IF SHA3(preimage) EQ commitment THEN
    RETURN SIGNEDBY(0xBB)
ELSEIF @COINAGE GTE 144 THEN
    RETURN SIGNEDBY(0xAA)
ENDIF
RETURN FALSE`,
    expect: true,
    state: ['0x00'],
    ctx: { coinage: 200 },
    witness: { AA: 'sig' },
  },
  {
    name: '05_htlc_dual_path_claim',
    script: `LET preimage = STATE(0)
LET commitment = SHA3(0x01)
IF SHA3(preimage) EQ commitment THEN
    RETURN SIGNEDBY(0xBB)
ELSEIF @COINAGE GTE 144 THEN
    RETURN SIGNEDBY(0xAA)
ENDIF
RETURN FALSE`,
    expect: true,
    state: ['0x01'],
    ctx: { coinage: 50 },
    witness: { BB: 'sig' },
  },
  {
    name: '06_three_party_escrow',
    script: 'RETURN MULTISIG(2 0xAA 0xBB 0xCC)',
    expect: true,
    witness: { AA: 'sig1', CC: 'sig2' },
  },
  {
    name: '07_counter_state_machine',
    script: `ASSERT STATE(0) EQ INC(PREVSTATE(0))
ASSERT SAMESTATE(1 15)
ASSERT @TOTIN EQ 1
ASSERT @TOTOUT EQ 1
RETURN VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)`,
    expect: true,
    state: ['0x01', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00'],
    prevState: ['0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00'],
    ctx: { totin: 1, totout: 1 },
  },
  {
    name: '08_immutable_state_schema',
    script: 'ASSERT SAMESTATE(0 31)\nRETURN SIGNEDBY(0xAA)',
    expect: true,
    state: ['0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00'],
    prevState: ['0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00'],
    witness: { AA: 'sig' },
  },
  {
    name: '09_token_gate',
    script: 'ASSERT @TOKENID EQ 0x01\nRETURN SIGNEDBY(0xAA)',
    expect: true,
    ctx: { tokenId: '0x01' },
    witness: { AA: 'sig' },
  },
  {
    name: '10_exact_indexed_payout',
    script: 'ASSERT @TOTOUT EQ 1\nRETURN VERIFYOUT(0 0x11 10 0x00 FALSE)',
    expect: true,
    ctx: { totout: 1 },
  },
  {
    name: '11_two_output_split',
    script: 'ASSERT @TOTOUT EQ 2\nASSERT VERIFYOUT(0 0x11 7 0x00 FALSE)\nRETURN VERIFYOUT(1 0x22 3 0x00 FALSE)',
    expect: true,
    ctx: { totout: 2 },
  },
  {
    name: '12_self_recreating_covenant',
    script: 'ASSERT @TOTIN EQ 1\nASSERT @TOTOUT EQ 1\nRETURN VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)',
    expect: true,
    ctx: { totin: 1, totout: 1 },
  },
  {
    name: '13_bounded_withdrawal_vault',
    script: `LET withdrawal = STATE(0)
LET limit = PREVSTATE(1)
ASSERT withdrawal GT 0
ASSERT withdrawal LTE limit
ASSERT STATE(1) EQ limit
ASSERT @INPUT EQ 0
ASSERT @TOTOUT EQ 2
ASSERT VERIFYOUT(0 @ADDRESS @AMOUNT-withdrawal @TOKENID TRUE)
RETURN VERIFYOUT(1 PREVSTATE(2) withdrawal @TOKENID FALSE)`,
    expect: true,
    state: ['0x05', '0x0A'],
    prevState: ['0x00', '0x0A', '0xFF'],
    ctx: { totout: 2, input: 0 },
  },
  {
    name: '14_nonce_authorized_transition',
    script: `LET nonce = STATE(0)
ASSERT nonce EQ INC(PREVSTATE(0))
ASSERT SIGNEDBY(PREVSTATE(1))
ASSERT SAMESTATE(1 10)
RETURN TRUE`,
    expect: true,
    state: ['0x01', '0xAA'],
    prevState: ['0x00', '0xAA'],
    witness: { AA: 'sig' },
  },
  {
    name: '15_bitfield_permissions',
    script: `LET permissions = PREVSTATE(0)
ASSERT BITGET(permissions 0)
ASSERT SIGNEDBY(PREVSTATE(1))
RETURN TRUE`,
    expect: true,
    prevState: ['0x01', '0xAA'],
    witness: { AA: 'sig' },
  },
  {
    name: '18_mast_leaf_dispatch',
    script: 'MAST 0xAA\nRETURN FALSE',
    expect: false,
  },
  {
    name: '19_explicit_checksig_oracle',
    script: `LET oraclekey = PREVSTATE(0)
LET message = STATE(0)
LET signature = STATE(1)
ASSERT CHECKSIG(oraclekey message signature)
RETURN SIGNEDBY(PREVSTATE(1))`,
    expect: true,
    state: ['0x01', '0x02'],
    prevState: ['0xAA', '0xBB'],
    ctx: { simulationMode: true },
    witness: { BB: 'sig' },
  },
  {
    name: '22_preserve_selected_state',
    script: 'ASSERT SAMESTATE(0 9)\nASSERT STATE(10) EQ INC(PREVSTATE(10))\nRETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)',
    expect: true,
    state: ['0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x01'],
    prevState: ['0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00'],
  },
  {
    name: '23_emergency_escape_plus_covenant',
    script: `LET rescuekey = PREVSTATE(100)
IF SIGNEDBY(rescuekey) THEN RETURN TRUE ENDIF
ASSERT SAMESTATE(0 99)
RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    expect: true,
    prevState: ['0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00'],
    witness: { AA: 'sig' },
  },
  {
    name: '24_commit_reveal_round_1',
    script: `LET round = STATE(0)
ASSERT round EQ INC(PREVSTATE(0))
IF round EQ 1 THEN
    ASSERT SAMESTATE(1 7)
    RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)
ELSEIF round EQ 2 THEN
    LET preimage = STATE(9)
    ASSERT SHA3(preimage) EQ PREVSTATE(2)
    RETURN SIGNEDBY(PREVSTATE(1))
ENDIF
RETURN FALSE`,
    expect: true,
    state: ['0x01', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00'],
    prevState: ['0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00'],
  },
  {
    name: '24_commit_reveal_round_2',
    script: `LET round = STATE(0)
ASSERT round EQ INC(PREVSTATE(0))
IF round EQ 1 THEN
    ASSERT SAMESTATE(1 7)
    RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)
ELSEIF round EQ 2 THEN
    LET preimage = STATE(9)
    ASSERT SHA3(preimage) EQ PREVSTATE(2)
    RETURN SIGNEDBY(PREVSTATE(1))
ENDIF
RETURN FALSE`,
    expect: true,
    state: ['0x02', '0xBB', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x01'],
    prevState: ['0x01', '0xBB', '0x6fe87c4d60d8d8b38c6e01bf5c5f8db51169719897d28c3ba283f5e46740cd78', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00'],
    witness: { BB: 'sig' },
  },
]

describe('Canonical KISSVM example scripts', () => {
  for (const t of TESTS) {
    it(t.name, () => {
      const result = evaluateScript(t.script, {
        block: Number(t.ctx?.block ?? 0),
        tx: {
          coinage: Number(t.ctx?.coinage ?? 0),
          totin: Number(t.ctx?.totin ?? 0),
          totout: Number(t.ctx?.totout ?? 0),
          input: Number(t.ctx?.input ?? 0),
          tokenId: String(t.ctx?.tokenId ?? '0x00'),
          address: String(t.ctx?.address ?? '0xAA'),
          amount: String(t.ctx?.amount ?? '100'),
        },
        state: (t.state ?? []).map(s => BigInt(s)),
        prevState: (t.prevState ?? []).map(s => BigInt(s)),
        witness: buildWitness({
          signatures: t.witness ?? {},
        }),
      })
      expect(result.success).toBe(t.expect)
    })
  }
})
