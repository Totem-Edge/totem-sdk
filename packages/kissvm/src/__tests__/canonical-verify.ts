import { evaluateScript } from '../index.js'
import type { ScriptWitness, TxContext, CoinData, OutputData } from '../index.js'

function mockSig(label: string): Uint8Array {
  const s = new Uint8Array(1088)
  for (let i = 0; i < 1088; i++) s[i] = label.charCodeAt(i % label.length) & 0xff
  return s
}
function w(sigs: Record<string, string> = {}): ScriptWitness {
  return { signatures: new Map(Object.entries(sigs).map(([k, v]) => [k, mockSig(v)])) }
}
function recN(n: number, v: string): Record<number, string> {
  const r: Record<number, string> = {}
  for (let i = 0; i < n; i++) r[i] = v
  return r
}
function recRange(from: number, to: number, v: string): Record<number, string> {
  const r: Record<number, string> = {}
  for (let i = from; i <= to; i++) r[i] = v
  return r
}

const COIN: CoinData = { amount: 100, tokenId: '0x00', coinId: '0xabc', address: '0xAA' }
const OUT: OutputData = { address: '0xAA', amount: 100, tokenId: '0x00', keepState: false }

interface Case { name: string; script: string; expect: boolean; sigs?: Record<string, string>; block?: number; state?: Record<number, string>; prevState?: Record<number, string>; inputs?: CoinData[]; outputs?: OutputData[]; tokenId?: string }

function mkCoin(overrides: Partial<CoinData> = {}): CoinData { return { ...COIN, ...overrides } }

function ctx(c: Case): TxContext {
  const ins = c.inputs ?? (c.tokenId ? [{ ...COIN, tokenId: c.tokenId }] : [COIN])
  return { block: c.block ?? 1000, inputIndex: 0, inputs: ins, outputs: c.outputs ?? [OUT], state: c.state ?? {}, prevState: c.prevState ?? {}, simulationMode: true }
}

const CASES: Case[] = [
  { name: '01_single_sig_pos', script: 'RETURN SIGNEDBY(0xAA)', expect: true, sigs: { aa: 'sig' } },
  { name: '01_single_sig_neg', script: 'RETURN SIGNEDBY(0xAA)', expect: false },
  { name: '02_multisig_2_3_pos', script: 'RETURN MULTISIG(2 0xAA 0xBB 0xCC)', expect: true, sigs: { aa: 's1', cc: 's2' } },
  { name: '02_multisig_2_3_neg', script: 'RETURN MULTISIG(2 0xAA 0xBB 0xCC)', expect: false, sigs: { aa: 's1' } },
  { name: '03_abs_timelock_pos', script: 'ASSERT @BLOCK GTE 1000000\nRETURN SIGNEDBY(0xAA)', expect: true, block: 1000000, sigs: { aa: 'sig' } },
  { name: '03_abs_timelock_neg', script: 'ASSERT @BLOCK GTE 1000000\nRETURN SIGNEDBY(0xAA)', expect: false, block: 999999, sigs: { aa: 'sig' } },
  // @COINAGE = block - coinCreatedBlock; positive: >= 144, negative: < 144
  { name: '04_coinage_pos', script: 'ASSERT @COINAGE GTE 144\nRETURN SIGNEDBY(0xAA)', expect: true, block: 144, inputs: [mkCoin({ coinCreatedBlock: 0 })], sigs: { aa: 'sig' } },
  { name: '04_coinage_neg', script: 'ASSERT @COINAGE GTE 144\nRETURN SIGNEDBY(0xAA)', expect: false, block: 143, inputs: [mkCoin({ coinCreatedBlock: 0 })], sigs: { aa: 'sig' } },
  { name: '05_htlc_claim',
    script: 'LET p = STATE(0) LET c = SHA3(0x01) IF SHA3(p) EQ c THEN RETURN SIGNEDBY(0xBB) ELSEIF @COINAGE GTE 144 THEN RETURN SIGNEDBY(0xAA) ENDIF RETURN FALSE',
    expect: true, state: { 0: '0x01' }, sigs: { bb: 'sig' } },
  { name: '05_htlc_refund',
    script: 'LET p = STATE(0) LET c = SHA3(0x01) IF SHA3(p) EQ c THEN RETURN SIGNEDBY(0xBB) ELSEIF @COINAGE GTE 144 THEN RETURN SIGNEDBY(0xAA) ENDIF RETURN FALSE',
    expect: true, state: { 0: '0x00' }, block: 1000, inputs: [mkCoin({ coinCreatedBlock: 800 })], sigs: { aa: 'sig' } },
  { name: '05_htlc_wrong_neg',
    script: 'LET p = STATE(0) LET c = SHA3(0x01) IF SHA3(p) EQ c THEN RETURN SIGNEDBY(0xBB) ELSEIF @COINAGE GTE 144 THEN RETURN SIGNEDBY(0xAA) ENDIF RETURN FALSE',
    expect: false, state: { 0: '0x02' }, sigs: { bb: 'sig' } },
  { name: '06_escrow_pos', script: 'RETURN MULTISIG(2 0xAA 0xBB 0xCC)', expect: true, sigs: { aa: 's1', cc: 's2' } },
  { name: '07_counter',
    script: 'ASSERT STATE(0) EQ INC(PREVSTATE(0))\nASSERT SAMESTATE(1 15)\nASSERT @TOTIN EQ 1\nASSERT @TOTOUT EQ 1\nRETURN VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)',
    expect: true,
    state: Object.assign({ 0: '0x01' }, recRange(1, 15, '0x00')),
    prevState: Object.assign({ 0: '0x00' }, recRange(1, 15, '0x00')),
    inputs: [COIN], outputs: [{ address: '0xAA', amount: 100, tokenId: '0x00', keepState: true }] },
  { name: '08_immutable', script: 'ASSERT SAMESTATE(0 31)\nRETURN SIGNEDBY(0xAA)', expect: true,
    state: recN(32, '0x00'), prevState: recN(32, '0x00'), sigs: { aa: 'sig' } },
  { name: '09_token_gate', script: 'ASSERT @TOKENID EQ 0x01\nRETURN SIGNEDBY(0xAA)', expect: true,
    tokenId: '0x01', sigs: { aa: 'sig' } },
  { name: '10_payout', script: 'ASSERT @TOTOUT EQ 1\nRETURN VERIFYOUT(0 0x11 10 0x00 FALSE)', expect: true,
    outputs: [{ address: '0x11', amount: 10, tokenId: '0x00', keepState: false }] },
  { name: '11_split', script: 'ASSERT @TOTOUT EQ 2\nASSERT VERIFYOUT(0 0x11 7 0x00 FALSE)\nRETURN VERIFYOUT(1 0x22 3 0x00 FALSE)', expect: true,
    outputs: [{ address: '0x11', amount: 7, tokenId: '0x00', keepState: false }, { address: '0x22', amount: 3, tokenId: '0x00', keepState: false }] },
  { name: '12_self_recreate', script: 'ASSERT @TOTIN EQ 1\nASSERT @TOTOUT EQ 1\nRETURN VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)', expect: true,
    inputs: [COIN], outputs: [{ address: '0xAA', amount: 100, tokenId: '0x00', keepState: true }] },
  { name: '13_withdrawal',
    script: 'LET w = STATE(0) LET l = PREVSTATE(1) ASSERT w GT 0 ASSERT w LTE l ASSERT STATE(1) EQ l ASSERT @INPUT EQ 0 ASSERT @TOTOUT EQ 2 ASSERT VERIFYOUT(0 @ADDRESS @AMOUNT-w @TOKENID TRUE) RETURN VERIFYOUT(1 PREVSTATE(2) w @TOKENID FALSE)',
    expect: true,
    // w=STATE(0)=5, l=PREVSTATE(1)=10, PREVSTATE(2)=0xFF (recipient)
    state: { 0: '0x05', 1: '0x0A' },
    prevState: { 0: '0x00', 1: '0x0A', 2: '0xFF' },
    inputs: [COIN],
    // output[0]: covenant change with state (keepState=TRUE), output[1]: withdrawal to recipient
    outputs: [{ address: '0xAA', amount: 95, tokenId: '0x00', keepState: true }, { address: '0xFF', amount: 5, tokenId: '0x00', keepState: false }] },
  { name: '14_nonce',
    script: 'LET n = STATE(0) ASSERT n EQ INC(PREVSTATE(0)) ASSERT SIGNEDBY(PREVSTATE(1)) ASSERT SAMESTATE(1 10) RETURN TRUE',
    expect: true,
    // state[0]=inc nonce, state[1..10]=preserved (including auth key at [1])
    state: Object.assign({ 0: '0x01', 1: '0xAA' }, recRange(2, 10, '0x00')),
    prevState: Object.assign({ 0: '0x00', 1: '0xAA' }, recRange(2, 10, '0x00')),
    sigs: { aa: 'sig' } },
  { name: '15_bitfield', script: 'LET p = PREVSTATE(0) ASSERT BITGET(p 0) ASSERT SIGNEDBY(PREVSTATE(1)) RETURN TRUE', expect: true,
    // PREVSTATE(0)=0x01 → bit 0 is set; PREVSTATE(1)=0xAA is the authorizer
    prevState: { 0: '0x01', 1: '0xAA' }, sigs: { aa: 'sig' } },
  { name: '16_dynamic_func_pos',
    script: 'LET b = [LET r = $1 GTE $2] LET a = FUNCTION(b @AMOUNT 10) RETURN a AND SIGNEDBY(0xAA)',
    expect: true, sigs: { aa: 'sig' } },
  { name: '16_dynamic_func_neg',
    script: 'LET b = [LET r = $1 GTE $2] LET a = FUNCTION(b @AMOUNT 10) RETURN a AND SIGNEDBY(0xAA)',
    expect: false, inputs: [mkCoin({ amount: 9 })], sigs: { aa: 'sig' } },
  { name: '17_exec_hash',
    script: 'LET c = STATE(0) ASSERT SHA3(c) EQ PREVSTATE(0) EXEC c RETURN FALSE',
    expect: true,
    // STATE(0) = hex-encoded script "RETURN SIGNEDBY(0xAA)"
    // PREVSTATE(0) = SHA3 of the script bytes
    state: { 0: '0x52455455524E205349474E45444259283078414129' },
    prevState: { 0: '0x6E97B9C8682B2A55DC9FB09626C95A920C1CDF33A3516AD49520E614B2AAEC59' },
    sigs: { aa: 'sig' } },
  { name: '18_mast_leaf', script: 'MAST 0xAA\nRETURN FALSE', expect: false },
  { name: '19_checksig', script: 'LET k = PREVSTATE(0) LET m = STATE(0) LET s = STATE(1) ASSERT CHECKSIG(k m s) RETURN SIGNEDBY(PREVSTATE(1))',
    expect: true, state: { 0: '0x01', 1: '0x02' }, prevState: { 0: '0xAA', 1: '0xBB' }, sigs: { bb: 'sig' } },
  { name: '20_mmr',
    script: 'LET a = STATE(0) LET b = STATE(1) LET c = PREVSTATE(0) LET d = PREVSTATE(1) LET e = STATE(2) RETURN PROOF(a b c d e)',
    expect: true,
    // data=0x01, leafSum=0, rootHash=0xAA, rootSum=0, proof=0x02 (empty: single-leaf tree)
    state: { 0: '0x01', 1: '0x00', 2: '0x' },
    // Leaf for data='0x01' as string, sum=0 → createMMRDataLeafNode(utf8('0x01'), 0)
    prevState: { 0: '0xB81AAC9B83C36B21446A2257A4703FE2D8C54E3EF1B11AFF59B58F9BB66E6771', 1: '0x00' } },
  { name: '21_allowlist',
    script: 'LET (0) = 0xAA LET (1) = 0xBB LET c = STATE(0) LET i = 0 LET f = FALSE WHILE i LT 2 DO IF GET(i) EQ c THEN LET f = TRUE ENDIF LET i = INC(i) ENDWHILE RETURN f AND SIGNEDBY(c)',
    expect: true, state: { 0: '0xBB' }, sigs: { bb: 'sig' } },
  { name: '22_preserve',
    script: 'ASSERT SAMESTATE(0 9)\nASSERT STATE(10) EQ INC(PREVSTATE(10))\nRETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)',
    expect: true,
    state: Object.assign(recN(10, '0x00'), { 10: '0x01' }),
    prevState: Object.assign(recN(10, '0x00'), { 10: '0x00' }),
    inputs: [COIN], outputs: [{ address: '0xAA', amount: 100, tokenId: '0x00', keepState: true }] },
  { name: '23_escape_escape',
    script: 'LET r = PREVSTATE(100) IF SIGNEDBY(r) THEN RETURN TRUE ENDIF ASSERT SAMESTATE(0 99) RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)',
    expect: true,
    prevState: Object.assign(recN(100, '0x00'), { 100: '0xAA' }), sigs: { aa: 'sig' } },
  { name: '23_escape_normal',
    script: 'LET r = PREVSTATE(100) IF SIGNEDBY(r) THEN RETURN TRUE ENDIF ASSERT SAMESTATE(0 99) RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)',
    expect: true, state: recN(100, '0x00'), prevState: recN(101, '0x00'),
    inputs: [COIN], outputs: [{ address: '0xAA', amount: 100, tokenId: '0x00', keepState: true }] },
  { name: '24_round1',
    script: 'LET r = STATE(0) ASSERT r EQ INC(PREVSTATE(0)) IF r EQ 1 THEN ASSERT SAMESTATE(1 7) RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE) ELSEIF r EQ 2 THEN LET p = STATE(9) ASSERT SHA3(p) EQ PREVSTATE(2) RETURN SIGNEDBY(PREVSTATE(1)) ENDIF RETURN FALSE',
    expect: true,
    state: Object.assign({ 0: '0x01' }, recRange(1, 7, '0x00')),
    prevState: Object.assign({ 0: '0x00' }, recRange(1, 10, '0x00')),
    inputs: [COIN], outputs: [{ address: '0xAA', amount: 100, tokenId: '0x00', keepState: true }] },
  { name: '24_round2',
    script: 'LET r = STATE(0) ASSERT r EQ INC(PREVSTATE(0)) IF r EQ 1 THEN ASSERT SAMESTATE(1 7) RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE) ELSEIF r EQ 2 THEN LET p = STATE(9) ASSERT SHA3(p) EQ PREVSTATE(2) RETURN SIGNEDBY(PREVSTATE(1)) ENDIF RETURN FALSE',
    expect: true,
    // r=2 (round 2), auth key preserved at [1], preimage 0x01 at [9]
    state: Object.assign({ 0: '0x02', 1: '0xBB' }, recRange(2, 7, '0x00'), { 9: '0x01' }),
    prevState: Object.assign({ 0: '0x01', 1: '0xBB', 2: '0x2767F15C8AF2F2C7225D5273FDD683EDC714110A987D1054697C348AED4E6CC7' }, recRange(3, 10, '0x00')),
    sigs: { bb: 'sig' } },
]

let passed = 0
let failed = 0
const failures: string[] = []

for (const c of CASES) {
  try {
    const r = evaluateScript(c.script, w(c.sigs ?? {}), ctx(c))
    if (r.passed === c.expect) passed++
    else { failed++; failures.push(`${c.name}: expected ${c.expect}, got ${r.passed}${r.error ? ` (${r.error})` : ''}`) }
  } catch (e: any) { failed++; failures.push(`${c.name}: exception — ${e.message}`) }
}

console.log(`\n=== Canonical KISSVM Examples: ${passed}/${passed + failed} passed ===\n`)
if (failures.length > 0) { console.log('FAILURES:'); for (const f of failures) console.log(`  ${f}`) }
