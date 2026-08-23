import { bytesToHex, sha3_256 } from '@totemsdk/core';
import type { ChannelParticipant, ChannelProgram, ChannelProgramBuildStateInput, OmniaChannel, OmniaTxDraft, StateValue, HTLCRecord, ProgramTransition } from './types.js';
import { buildEltooScript } from './script.js';
import { buildUpdateTx, computeOmniaTxDigest } from './transactions.js';
import { canonicalizeProgramTransition } from './transition.js';
import { getStateBigInt, getStateBool, getStateHex, getStateString, programNumberState, programBoolState, programHexState, programStringState } from './state-vars.js';

export const ELTOO_PAYMENT_PROGRAM_ID = 'eltoo-payment';
export const COUNTER_PROGRAM_ID = 'counter';
export const COUNTER_STATE_PORT = 120;
export const COUNTER_ACTION_PORT = 121;
export const COUNTER_OPERAND_PORT = 122;
export const COUNTER_ACTION_NONE = 0n;
export const COUNTER_ACTION_INCREMENT = 1n;
export const COUNTER_ACTION_DECREMENT = 2n;
export const COUNTER_ACTION_SET = 3n;
export const METER_PROGRAM_ID = 'meter';
export const METER_READING_PORT = 130;
export const METER_USAGE_DELTA_PORT = 131;
export const METER_UNIT_PRICE_PORT = 132;
export const METER_PAYMENT_PORT = 133;

export const HTLC_PROGRAM_ID = 'htlc-payment';
export const HTLC_HASHLOCK_PORT = 140;
export const HTLC_LOCKED_AMOUNT_PORT = 141;
export const HTLC_TIMEOUT_BLOCK_PORT = 142;
export const HTLC_CLAIMED_PORT = 143;
export const HTLC_PREIMAGE_PORT = 144;

export const VAULT_PROGRAM_ID = 'vault';
export const VAULT_LOCKED_VALUE_PORT = 150;
export const VAULT_RELEASE_SEQUENCE_PORT = 151;
export const VAULT_SWEPT_PORT = 152;

export const TREASURY_PROGRAM_ID = 'treasury';
export const TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT = 160;
export const TREASURY_VOTE_TALLY_HASH_PORT = 161;
export const TREASURY_SPEND_CAP_PORT = 162;
export const TREASURY_SPENT_PORT = 163;
export const TREASURY_OUTCOME_PROOF_ID_PORT = 164;

export const MEMBERSHIP_PROGRAM_ID = 'membership';
export const MEMBERSHIP_MEMBER_ROOT_PORT = 170;
export const MEMBERSHIP_DIVIDEND_POOL_PORT = 171;
export const MEMBERSHIP_PAYOUT_SEQUENCE_PORT = 172;

export const ASSET_PROGRAM_ID = 'asset';
export const ASSET_TOKEN_ID_PORT = 180;
export const ASSET_HOLDER_A_BALANCE_PORT = 181;
export const ASSET_HOLDER_B_BALANCE_PORT = 182;
export const ASSET_TOTAL_PORT = 183;

const programs = new Map<string, ChannelProgram>();

const ELTOO_INJECTION_ANCHOR = 'ASSERT BOTHSIGNED\nASSERT SEQUENCE GT PREVSEQUENCE';

function preimageDigest(preimage: string): string {
  const digest = sha3_256(new TextEncoder().encode(preimage));
  return bytesToHex(digest).replace(/^0x/i, '').toLowerCase();
}

function normalizeHex(value: string): string {
  return value.replace(/^0x/i, '').toLowerCase();
}

function injectEltooScript(parties: ChannelParticipant[], additions: string[]): string {
  return buildEltooScript(parties).replace(ELTOO_INJECTION_ANCHOR, [ELTOO_INJECTION_ANCHOR, ...additions].join('\n'));
}

export const DefaultEltooPaymentProgram: ChannelProgram = {
  id: ELTOO_PAYMENT_PROGRAM_ID,
  version: 1,
  buildScript(parties: ChannelParticipant[]): string {
    return buildEltooScript(parties);
  },
  buildStateVariables(_input: ChannelProgramBuildStateInput): StateValue[] {
    return [];
  },
};

export const CounterProgram: ChannelProgram = {
  id: COUNTER_PROGRAM_ID,
  version: 1,
  buildScript(parties: ChannelParticipant[]): string {
    const base = buildEltooScript(parties).replace('ASSERT BOTHSIGNED\nASSERT SEQUENCE GT PREVSEQUENCE', [
      'ASSERT BOTHSIGNED',
      'ASSERT SEQUENCE GT PREVSEQUENCE',
      `LET COUNTER=STATE(${COUNTER_STATE_PORT})`,
      `LET PREVCOUNTER=PREVSTATE(${COUNTER_STATE_PORT})`,
      `LET ACTION=STATE(${COUNTER_ACTION_PORT})`,
      `LET OPERAND=STATE(${COUNTER_OPERAND_PORT})`,
      `IF ACTION EQ ${COUNTER_ACTION_INCREMENT} THEN`,
      '    ASSERT COUNTER EQ PREVCOUNTER ADD OPERAND',
      `ELSEIF ACTION EQ ${COUNTER_ACTION_DECREMENT} THEN`,
      '    ASSERT COUNTER EQ PREVCOUNTER SUB OPERAND',
      `ELSEIF ACTION EQ ${COUNTER_ACTION_SET} THEN`,
      '    ASSERT COUNTER EQ OPERAND',
      'ELSE',
      `    ASSERT ACTION EQ ${COUNTER_ACTION_NONE}`,
      '    ASSERT COUNTER EQ PREVCOUNTER',
      'ENDIF',
    ].join('\n'));
    return base;
  },
  buildStateVariables({ previousState, transition }: ChannelProgramBuildStateInput): StateValue[] {
    const current = getStateBigInt(previousState, COUNTER_STATE_PORT, 0n);
    if (!transition) return [
      programNumberState(COUNTER_STATE_PORT, current),
      programNumberState(COUNTER_ACTION_PORT, COUNTER_ACTION_NONE),
      programNumberState(COUNTER_OPERAND_PORT, 0n),
    ];
    const by = BigInt(String(transition.inputs?.by ?? 1n));
    switch (transition.action) {
      case 'increment':
        return [
          programNumberState(COUNTER_STATE_PORT, current + by),
          programNumberState(COUNTER_ACTION_PORT, COUNTER_ACTION_INCREMENT),
          programNumberState(COUNTER_OPERAND_PORT, by),
        ];
      case 'decrement':
        return [
          programNumberState(COUNTER_STATE_PORT, current - by),
          programNumberState(COUNTER_ACTION_PORT, COUNTER_ACTION_DECREMENT),
          programNumberState(COUNTER_OPERAND_PORT, by),
        ];
      case 'set': {
        const value = BigInt(String(transition.inputs?.value ?? current));
        return [
          programNumberState(COUNTER_STATE_PORT, value),
          programNumberState(COUNTER_ACTION_PORT, COUNTER_ACTION_SET),
          programNumberState(COUNTER_OPERAND_PORT, value),
        ];
      }
      default:
        return [
          programNumberState(COUNTER_STATE_PORT, current),
          programNumberState(COUNTER_ACTION_PORT, COUNTER_ACTION_NONE),
          programNumberState(COUNTER_OPERAND_PORT, 0n),
        ];
    }
  },
  validateTransition({ previousState, nextState, transition }) {
    if (!transition) return { valid: true };
    const current = getStateBigInt(previousState, COUNTER_STATE_PORT, 0n);
    const next = getStateBigInt(nextState, COUNTER_STATE_PORT, 0n);
    const by = BigInt(String(transition.inputs?.by ?? 1n));
    switch (transition.action) {
      case 'increment':
        return next === current + by ? { valid: true } : { valid: false, error: 'counter increment mismatch' };
      case 'decrement':
        return next === current - by ? { valid: true } : { valid: false, error: 'counter decrement mismatch' };
      case 'set': {
        const expected = BigInt(String(transition.inputs?.value ?? current));
        return next === expected ? { valid: true } : { valid: false, error: 'counter set mismatch' };
      }
      default:
        return { valid: false, error: `unsupported counter action: ${transition.action}` };
    }
  },
};

export const MeterProgram: ChannelProgram = {
  id: METER_PROGRAM_ID,
  version: 1,
  buildScript(parties: ChannelParticipant[]): string {
    const base = buildEltooScript(parties).replace('ASSERT BOTHSIGNED\nASSERT SEQUENCE GT PREVSEQUENCE', [
      'ASSERT BOTHSIGNED',
      'ASSERT SEQUENCE GT PREVSEQUENCE',
      `LET READING=STATE(${METER_READING_PORT})`,
      `LET PREVREADING=PREVSTATE(${METER_READING_PORT})`,
      `LET USAGE=STATE(${METER_USAGE_DELTA_PORT})`,
      `LET UNITPRICE=STATE(${METER_UNIT_PRICE_PORT})`,
      `LET PAYMENT=STATE(${METER_PAYMENT_PORT})`,
      'ASSERT READING GTE PREVREADING',
      'ASSERT USAGE EQ READING SUB PREVREADING',
      'ASSERT PAYMENT EQ USAGE MUL UNITPRICE',
    ].join('\n'));
    return base;
  },
  buildStateVariables({ previousState, transition }: ChannelProgramBuildStateInput): StateValue[] {
    const previousReading = getStateBigInt(previousState, METER_READING_PORT, 0n);
    const previousUnitPrice = getStateBigInt(previousState, METER_UNIT_PRICE_PORT, 0n);
    const reading = BigInt(String(transition?.inputs?.reading ?? previousReading));
    const unitPrice = BigInt(String(transition?.inputs?.unitPrice ?? previousUnitPrice));
    const usage = reading - previousReading;
    const payment = usage * unitPrice;
    return [
      programNumberState(METER_READING_PORT, reading),
      programNumberState(METER_USAGE_DELTA_PORT, usage),
      programNumberState(METER_UNIT_PRICE_PORT, unitPrice),
      programNumberState(METER_PAYMENT_PORT, payment),
    ];
  },
  validateTransition({ channel, previousState, nextState, transition }) {
    if (!transition) return { valid: true };
    if (transition.action !== 'record_reading') {
      return { valid: false, error: `unsupported meter action: ${transition.action}` };
    }
    if (channel.parties.length < 2) return { valid: false, error: 'meter program requires payer and payee parties' };
    const payer = channel.parties[0].partyId;
    const payee = channel.parties[1].partyId;
    const previousReading = getStateBigInt(previousState, METER_READING_PORT, 0n);
    const reading = getStateBigInt(nextState, METER_READING_PORT, 0n);
    if (reading < previousReading) return { valid: false, error: 'meter reading decreased' };

    const usage = getStateBigInt(nextState, METER_USAGE_DELTA_PORT, 0n);
    const unitPrice = getStateBigInt(nextState, METER_UNIT_PRICE_PORT, 0n);
    const payment = getStateBigInt(nextState, METER_PAYMENT_PORT, 0n);
    if (usage !== reading - previousReading) return { valid: false, error: 'meter usage mismatch' };
    if (payment !== usage * unitPrice) return { valid: false, error: 'meter payment mismatch' };

    const previousBalances = previousState?.balances ?? channel.balances;
    const expectedPayer = (previousBalances[payer] ?? 0n) - payment;
    const expectedPayee = (previousBalances[payee] ?? 0n) + payment;
    if (nextState.balances[payer] !== expectedPayer || nextState.balances[payee] !== expectedPayee) {
      return { valid: false, error: 'meter balance transfer mismatch' };
    }
    return { valid: true };
  },
};

programs.set(`${DefaultEltooPaymentProgram.id}@${DefaultEltooPaymentProgram.version}`, DefaultEltooPaymentProgram);
programs.set(`${CounterProgram.id}@${CounterProgram.version}`, CounterProgram);
programs.set(`${MeterProgram.id}@${MeterProgram.version}`, MeterProgram);

export const HTLCPaymentProgram: ChannelProgram = {
  id: HTLC_PROGRAM_ID,
  version: 1,
  buildScript(parties: ChannelParticipant[]): string {
    return injectEltooScript(parties, [
      `LET PREIMAGEHASH=SHA3(STATE(${HTLC_PREIMAGE_PORT}))`,
      `LET LOCKED=STATE(${HTLC_LOCKED_AMOUNT_PORT})`,
      `LET TIMEOUTBLOCK=STATE(${HTLC_TIMEOUT_BLOCK_PORT})`,
      `LET CLAIMED=STATE(${HTLC_CLAIMED_PORT})`,
      `IF CLAIMED THEN`,
      '    ASSERT LOCKED EQ 0',
      `    ASSERT PREIMAGEHASH EQ STATE(${HTLC_HASHLOCK_PORT}) OR @BLOCK GTE TIMEOUTBLOCK OR PREVSTATE(${HTLC_CLAIMED_PORT}) EQ TRUE`,
      '    RETURN TRUE',
      'ENDIF',
    ]);
  },
  buildStateVariables({ previousState, transition }: ChannelProgramBuildStateInput): StateValue[] {
    if (!transition) return [
      programHexState(HTLC_HASHLOCK_PORT, getStateHex(previousState, HTLC_HASHLOCK_PORT, '')),
      programNumberState(HTLC_LOCKED_AMOUNT_PORT, getStateBigInt(previousState, HTLC_LOCKED_AMOUNT_PORT, 0n)),
      programNumberState(HTLC_TIMEOUT_BLOCK_PORT, getStateBigInt(previousState, HTLC_TIMEOUT_BLOCK_PORT, 0n)),
      programBoolState(HTLC_CLAIMED_PORT, getStateBool(previousState, HTLC_CLAIMED_PORT, false)),
      programHexState(HTLC_PREIMAGE_PORT, getStateHex(previousState, HTLC_PREIMAGE_PORT, '')),
    ];
    switch (transition.action) {
      case 'add': {
        const hashlock = normalizeHex(String(transition.inputs?.hashlock ?? ''));
        const amount = BigInt(String(transition.inputs?.amount ?? 0n));
        const timeoutBlock = BigInt(String(transition.inputs?.timeoutBlock ?? 0n));
        return [
          programHexState(HTLC_HASHLOCK_PORT, `0x${hashlock}`),
          programNumberState(HTLC_LOCKED_AMOUNT_PORT, amount),
          programNumberState(HTLC_TIMEOUT_BLOCK_PORT, timeoutBlock),
          programBoolState(HTLC_CLAIMED_PORT, false),
          programHexState(HTLC_PREIMAGE_PORT, ''),
        ];
      }
      case 'claim': {
        if (!transition.inputs?.preimage) return [
          programHexState(HTLC_HASHLOCK_PORT, getStateHex(previousState, HTLC_HASHLOCK_PORT, '')),
          programNumberState(HTLC_LOCKED_AMOUNT_PORT, getStateBigInt(previousState, HTLC_LOCKED_AMOUNT_PORT, 0n)),
          programNumberState(HTLC_TIMEOUT_BLOCK_PORT, getStateBigInt(previousState, HTLC_TIMEOUT_BLOCK_PORT, 0n)),
          programBoolState(HTLC_CLAIMED_PORT, false),
          programHexState(HTLC_PREIMAGE_PORT, getStateHex(previousState, HTLC_PREIMAGE_PORT, '')),
        ];
        const preimage = String(transition.inputs.preimage);
        const digest = preimageDigest(preimage);
        const lock = getStateHex(previousState, HTLC_HASHLOCK_PORT, '');
        if (digest !== normalizeHex(lock)) {
          return [
            programHexState(HTLC_HASHLOCK_PORT, lock),
            programNumberState(HTLC_LOCKED_AMOUNT_PORT, getStateBigInt(previousState, HTLC_LOCKED_AMOUNT_PORT, 0n)),
            programNumberState(HTLC_TIMEOUT_BLOCK_PORT, getStateBigInt(previousState, HTLC_TIMEOUT_BLOCK_PORT, 0n)),
            programBoolState(HTLC_CLAIMED_PORT, false),
            programHexState(HTLC_PREIMAGE_PORT, getStateHex(previousState, HTLC_PREIMAGE_PORT, '')),
          ];
        }
        return [
          programHexState(HTLC_HASHLOCK_PORT, lock),
          programNumberState(HTLC_LOCKED_AMOUNT_PORT, 0n),
          programNumberState(HTLC_TIMEOUT_BLOCK_PORT, getStateBigInt(previousState, HTLC_TIMEOUT_BLOCK_PORT, 0n)),
          programBoolState(HTLC_CLAIMED_PORT, true),
          programHexState(HTLC_PREIMAGE_PORT, `0x${bytesToHex(new TextEncoder().encode(preimage))}`),
        ];
      }
      case 'timeout': {
        return [
          programHexState(HTLC_HASHLOCK_PORT, getStateHex(previousState, HTLC_HASHLOCK_PORT, '')),
          programNumberState(HTLC_LOCKED_AMOUNT_PORT, 0n),
          programNumberState(HTLC_TIMEOUT_BLOCK_PORT, getStateBigInt(previousState, HTLC_TIMEOUT_BLOCK_PORT, 0n)),
          programBoolState(HTLC_CLAIMED_PORT, true),
          programHexState(HTLC_PREIMAGE_PORT, getStateHex(previousState, HTLC_PREIMAGE_PORT, '')),
        ];
      }
      default:
        return [
          programHexState(HTLC_HASHLOCK_PORT, getStateHex(previousState, HTLC_HASHLOCK_PORT, '')),
          programNumberState(HTLC_LOCKED_AMOUNT_PORT, getStateBigInt(previousState, HTLC_LOCKED_AMOUNT_PORT, 0n)),
          programNumberState(HTLC_TIMEOUT_BLOCK_PORT, getStateBigInt(previousState, HTLC_TIMEOUT_BLOCK_PORT, 0n)),
          programBoolState(HTLC_CLAIMED_PORT, getStateBool(previousState, HTLC_CLAIMED_PORT, false)),
          programHexState(HTLC_PREIMAGE_PORT, getStateHex(previousState, HTLC_PREIMAGE_PORT, '')),
        ];
    }
  },
  validateTransition({ previousState, nextState, transition }) {
    if (!transition) return { valid: true };
    switch (transition.action) {
      case 'add': {
        const nextHashlock = getStateHex(nextState, HTLC_HASHLOCK_PORT, '');
        const nextAmount = getStateBigInt(nextState, HTLC_LOCKED_AMOUNT_PORT, 0n);
        const expectedAmount = BigInt(String(transition.inputs?.amount ?? 0n));
        const claimed = getStateBool(nextState, HTLC_CLAIMED_PORT, false);
        if (claimed) return { valid: false, error: 'htlc add after claim is not allowed' };
        if (nextHashlock === '') return { valid: false, error: 'htlc add requires hashlock' };
        if (nextAmount !== expectedAmount) return { valid: false, error: 'htlc amount mismatch' };
        return { valid: true };
      }
      case 'claim': {
        if (!transition.inputs?.preimage) return { valid: false, error: 'htlc claim requires preimage' };
        const digest = preimageDigest(String(transition.inputs.preimage));
        const lock = getStateHex(previousState, HTLC_HASHLOCK_PORT, '');
        if (digest !== normalizeHex(lock)) return { valid: false, error: 'htlc preimage mismatch' };
        const nextAmount = getStateBigInt(nextState, HTLC_LOCKED_AMOUNT_PORT, 0n);
        const claimed = getStateBool(nextState, HTLC_CLAIMED_PORT, false);
        if (nextAmount !== 0n) return { valid: false, error: 'htlc claim must release locked amount' };
        if (!claimed) return { valid: false, error: 'htlc claim must set claimed flag' };
        return { valid: true };
      }
      case 'timeout': {
        const currentBlock = BigInt(String(transition.inputs?.currentBlock ?? '0'));
        const timeoutBlock = getStateBigInt(previousState, HTLC_TIMEOUT_BLOCK_PORT, 0n);
        if (currentBlock < timeoutBlock) return { valid: false, error: 'htlc timeout block not reached' };
        const nextAmount = getStateBigInt(nextState, HTLC_LOCKED_AMOUNT_PORT, 0n);
        const claimed = getStateBool(nextState, HTLC_CLAIMED_PORT, false);
        if (nextAmount !== 0n) return { valid: false, error: 'htlc timeout must release locked amount' };
        if (!claimed) return { valid: false, error: 'htlc timeout must set claimed flag' };
        return { valid: true };
      }
      default:
        return { valid: false, error: `unsupported htlc action: ${transition.action}` };
    }
  },
};

export const VaultProgram: ChannelProgram = {
  id: VAULT_PROGRAM_ID,
  version: 1,
  buildScript(parties: ChannelParticipant[]): string {
    return injectEltooScript(parties, [
      `LET LOCKEDVALUE=STATE(${VAULT_LOCKED_VALUE_PORT})`,
      `LET SWEPT=STATE(${VAULT_SWEPT_PORT})`,
      `IF SWEPT THEN`,
      '    ASSERT LOCKEDVALUE EQ 0',
      `    ASSERT SEQUENCE GTE PREVSTATE(${VAULT_RELEASE_SEQUENCE_PORT})`,
      '    RETURN TRUE',
      'ENDIF',
      `IF SEQUENCE LT PREVSTATE(${VAULT_RELEASE_SEQUENCE_PORT}) THEN`,
      `    ASSERT LOCKEDVALUE EQ PREVSTATE(${VAULT_LOCKED_VALUE_PORT})`,
      'ENDIF',
      `IF LOCKEDVALUE LT PREVSTATE(${VAULT_LOCKED_VALUE_PORT}) THEN`,
      '    ASSERT SWEPT',
      'ENDIF',
    ]);
  },
  buildStateVariables({ previousState, transition }: ChannelProgramBuildStateInput): StateValue[] {
    if (!transition) return [
      programNumberState(VAULT_LOCKED_VALUE_PORT, getStateBigInt(previousState, VAULT_LOCKED_VALUE_PORT, 0n)),
      programNumberState(VAULT_RELEASE_SEQUENCE_PORT, getStateBigInt(previousState, VAULT_RELEASE_SEQUENCE_PORT, 0n)),
      programBoolState(VAULT_SWEPT_PORT, getStateBool(previousState, VAULT_SWEPT_PORT, false)),
    ];
    switch (transition.action) {
      case 'lock': {
        const amount = BigInt(String(transition.inputs?.amount ?? 0n));
        const release = BigInt(String(transition.inputs?.releaseSequence ?? 0n));
        return [
          programNumberState(VAULT_LOCKED_VALUE_PORT, amount),
          programNumberState(VAULT_RELEASE_SEQUENCE_PORT, release),
          programBoolState(VAULT_SWEPT_PORT, false),
        ];
      }
      case 'extend': {
        const release = BigInt(String(transition.inputs?.releaseSequence ?? 0n));
        return [
          programNumberState(VAULT_LOCKED_VALUE_PORT, getStateBigInt(previousState, VAULT_LOCKED_VALUE_PORT, 0n)),
          programNumberState(VAULT_RELEASE_SEQUENCE_PORT, release),
          programBoolState(VAULT_SWEPT_PORT, getStateBool(previousState, VAULT_SWEPT_PORT, false)),
        ];
      }
      case 'release': {
        return [
          programNumberState(VAULT_LOCKED_VALUE_PORT, 0n),
          programNumberState(VAULT_RELEASE_SEQUENCE_PORT, getStateBigInt(previousState, VAULT_RELEASE_SEQUENCE_PORT, 0n)),
          programBoolState(VAULT_SWEPT_PORT, true),
        ];
      }
      default:
        return [
          programNumberState(VAULT_LOCKED_VALUE_PORT, getStateBigInt(previousState, VAULT_LOCKED_VALUE_PORT, 0n)),
          programNumberState(VAULT_RELEASE_SEQUENCE_PORT, getStateBigInt(previousState, VAULT_RELEASE_SEQUENCE_PORT, 0n)),
          programBoolState(VAULT_SWEPT_PORT, getStateBool(previousState, VAULT_SWEPT_PORT, false)),
        ];
    }
  },
  validateTransition({ channel, previousState, nextState, transition }) {
    if (!transition) return { valid: true };
    switch (transition.action) {
      case 'lock': {
        const amount = BigInt(String(transition.inputs?.amount ?? 0n));
        const release = BigInt(String(transition.inputs?.releaseSequence ?? 0n));
        if (amount < 0n) return { valid: false, error: 'vault lock amount must be non-negative' };
        const prevLocked = getStateBigInt(previousState, VAULT_LOCKED_VALUE_PORT, 0n);
        const prevRelease = getStateBigInt(previousState, VAULT_RELEASE_SEQUENCE_PORT, 0n);
        const nextAmount = getStateBigInt(nextState, VAULT_LOCKED_VALUE_PORT, 0n);
        const nextRelease = getStateBigInt(nextState, VAULT_RELEASE_SEQUENCE_PORT, 0n);
        const swept = getStateBool(nextState, VAULT_SWEPT_PORT, false);
        if (nextAmount !== amount) return { valid: false, error: 'vault locked value mismatch' };
        if (nextRelease !== release) return { valid: false, error: 'vault release sequence mismatch' };
        if (swept) return { valid: false, error: 'vault lock after sweep is not allowed' };
        if (prevLocked > 0n) {
          if (BigInt(nextState.sequence) < prevRelease && nextAmount !== prevLocked) {
            return { valid: false, error: 'vault lock before release must keep locked value' };
          }
          if (BigInt(nextState.sequence) >= prevRelease && nextAmount < prevLocked) {
            return { valid: false, error: 'vault lock must not decrease locked value' };
          }
        }
        return { valid: true };
      }
      case 'extend': {
        const release = BigInt(String(transition.inputs?.releaseSequence ?? 0n));
        const prevRelease = getStateBigInt(previousState, VAULT_RELEASE_SEQUENCE_PORT, 0n);
        const nextRelease = getStateBigInt(nextState, VAULT_RELEASE_SEQUENCE_PORT, 0n);
        const swept = getStateBool(nextState, VAULT_SWEPT_PORT, false);
        if (release < prevRelease) return { valid: false, error: 'vault extend must not shorten release' };
        if (nextRelease !== release) return { valid: false, error: 'vault release sequence mismatch' };
        if (swept) return { valid: false, error: 'vault extend after sweep is not allowed' };
        return { valid: true };
      }
      case 'release': {
        const prevRelease = getStateBigInt(previousState, VAULT_RELEASE_SEQUENCE_PORT, 0n);
        if (BigInt(nextState.sequence) < prevRelease) return { valid: false, error: 'vault release sequence not reached' };
        const nextAmount = getStateBigInt(nextState, VAULT_LOCKED_VALUE_PORT, 0n);
        const swept = getStateBool(nextState, VAULT_SWEPT_PORT, false);
        if (nextAmount !== 0n) return { valid: false, error: 'vault release must empty locked value' };
        if (!swept) return { valid: false, error: 'vault release must set swept flag' };
        return { valid: true };
      }
      default:
        return { valid: false, error: `unsupported vault action: ${transition.action}` };
    }
  },
};

export const TreasuryProgram: ChannelProgram = {
  id: TREASURY_PROGRAM_ID,
  version: 1,
  buildScript(parties: ChannelParticipant[]): string {
    return injectEltooScript(parties, [
      `LET SPENT=STATE(${TREASURY_SPENT_PORT})`,
      `LET CAP=STATE(${TREASURY_SPEND_CAP_PORT})`,
      'ASSERT SPENT LTE CAP',
    ]);
  },
  buildStateVariables({ previousState, transition }: ChannelProgramBuildStateInput): StateValue[] {
    if (!transition) return [
      programStringState(TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, getStateString(previousState, TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, '')),
      programStringState(TREASURY_VOTE_TALLY_HASH_PORT, getStateString(previousState, TREASURY_VOTE_TALLY_HASH_PORT, '')),
      programNumberState(TREASURY_SPEND_CAP_PORT, getStateBigInt(previousState, TREASURY_SPEND_CAP_PORT, 0n)),
      programNumberState(TREASURY_SPENT_PORT, getStateBigInt(previousState, TREASURY_SPENT_PORT, 0n)),
      programStringState(TREASURY_OUTCOME_PROOF_ID_PORT, getStateString(previousState, TREASURY_OUTCOME_PROOF_ID_PORT, '')),
    ];
    switch (transition.action) {
      case 'configure': {
        return [
          programStringState(TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, String(transition.inputs?.membershipSnapshotHash ?? '')),
          programStringState(TREASURY_VOTE_TALLY_HASH_PORT, String(transition.inputs?.voteTallyHash ?? '')),
          programNumberState(TREASURY_SPEND_CAP_PORT, BigInt(String(transition.inputs?.spendCap ?? 0n))),
          programNumberState(TREASURY_SPENT_PORT, 0n),
          programStringState(TREASURY_OUTCOME_PROOF_ID_PORT, String(transition.inputs?.outcomeProofId ?? '')),
        ];
      }
      case 'spend': {
        const amount = BigInt(String(transition.inputs?.amount ?? 0n));
        return [
          programStringState(TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, getStateString(previousState, TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, '')),
          programStringState(TREASURY_VOTE_TALLY_HASH_PORT, getStateString(previousState, TREASURY_VOTE_TALLY_HASH_PORT, '')),
          programNumberState(TREASURY_SPEND_CAP_PORT, getStateBigInt(previousState, TREASURY_SPEND_CAP_PORT, 0n)),
          programNumberState(TREASURY_SPENT_PORT, getStateBigInt(previousState, TREASURY_SPENT_PORT, 0n) + amount),
          programStringState(TREASURY_OUTCOME_PROOF_ID_PORT, getStateString(previousState, TREASURY_OUTCOME_PROOF_ID_PORT, '')),
        ];
      }
      case 'rotate_snapshot': {
        return [
          programStringState(TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, String(transition.inputs?.membershipSnapshotHash ?? '')),
          programStringState(TREASURY_VOTE_TALLY_HASH_PORT, String(transition.inputs?.voteTallyHash ?? '')),
          programNumberState(TREASURY_SPEND_CAP_PORT, BigInt(String(transition.inputs?.spendCap ?? 0n))),
          programNumberState(TREASURY_SPENT_PORT, 0n),
          programStringState(TREASURY_OUTCOME_PROOF_ID_PORT, String(transition.inputs?.outcomeProofId ?? '')),
        ];
      }
      default:
        return [
          programStringState(TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, getStateString(previousState, TREASURY_MEMBERSHIP_SNAPSHOT_HASH_PORT, '')),
          programStringState(TREASURY_VOTE_TALLY_HASH_PORT, getStateString(previousState, TREASURY_VOTE_TALLY_HASH_PORT, '')),
          programNumberState(TREASURY_SPEND_CAP_PORT, getStateBigInt(previousState, TREASURY_SPEND_CAP_PORT, 0n)),
          programNumberState(TREASURY_SPENT_PORT, getStateBigInt(previousState, TREASURY_SPENT_PORT, 0n)),
          programStringState(TREASURY_OUTCOME_PROOF_ID_PORT, getStateString(previousState, TREASURY_OUTCOME_PROOF_ID_PORT, '')),
        ];
    }
  },
  validateTransition({ previousState, nextState, transition }) {
    if (!transition) return { valid: true };
    switch (transition.action) {
      case 'configure': {
        const spendCap = getStateBigInt(nextState, TREASURY_SPEND_CAP_PORT, 0n);
        const spent = getStateBigInt(nextState, TREASURY_SPENT_PORT, 0n);
        if (spendCap < 0n) return { valid: false, error: 'treasury spend cap must be non-negative' };
        if (spent !== 0n) return { valid: false, error: 'treasury configure must reset spent' };
        return { valid: true };
      }
      case 'spend': {
        const outcomeProof = getStateString(previousState, TREASURY_OUTCOME_PROOF_ID_PORT, '');
        const requested = getStateString(nextState, TREASURY_OUTCOME_PROOF_ID_PORT, '');
        if (outcomeProof !== '' && requested !== outcomeProof) return { valid: false, error: 'treasury outcome proof mismatch' };
        const cap = getStateBigInt(previousState, TREASURY_SPEND_CAP_PORT, 0n);
        const prevSpent = getStateBigInt(previousState, TREASURY_SPENT_PORT, 0n);
        const nextSpent = getStateBigInt(nextState, TREASURY_SPENT_PORT, 0n);
        const amount = BigInt(String(transition.inputs?.amount ?? 0n));
        if (amount < 0n) return { valid: false, error: 'treasury spend amount must be non-negative' };
        if (nextSpent !== prevSpent + amount) return { valid: false, error: 'treasury spent accounting mismatch' };
        if (nextSpent > cap) return { valid: false, error: 'treasury spend exceeds cap' };
        return { valid: true };
      }
      case 'rotate_snapshot': {
        const spent = getStateBigInt(nextState, TREASURY_SPENT_PORT, 0n);
        if (spent !== 0n) return { valid: false, error: 'treasury rotate must reset spent' };
        return { valid: true };
      }
      default:
        return { valid: false, error: `unsupported treasury action: ${transition.action}` };
    }
  },
};

export const MembershipProgram: ChannelProgram = {
  id: MEMBERSHIP_PROGRAM_ID,
  version: 1,
  buildScript(parties: ChannelParticipant[]): string {
    return injectEltooScript(parties, [
      `LET ROOT=STATE(${MEMBERSHIP_MEMBER_ROOT_PORT})`,
      `LET POOL=STATE(${MEMBERSHIP_DIVIDEND_POOL_PORT})`,
      'ASSERT POOL GTE 0',
    ]);
  },
  buildStateVariables({ previousState, transition }: ChannelProgramBuildStateInput): StateValue[] {
    if (!transition) return [
      programHexState(MEMBERSHIP_MEMBER_ROOT_PORT, getStateHex(previousState, MEMBERSHIP_MEMBER_ROOT_PORT, '')),
      programNumberState(MEMBERSHIP_DIVIDEND_POOL_PORT, getStateBigInt(previousState, MEMBERSHIP_DIVIDEND_POOL_PORT, 0n)),
      programNumberState(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, getStateBigInt(previousState, MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0n)),
    ];
    switch (transition.action) {
      case 'member_add':
      case 'member_remove': {
        const root = normalizeHex(String(transition.inputs?.memberRoot ?? ''));
        return [
          programHexState(MEMBERSHIP_MEMBER_ROOT_PORT, root),
          programNumberState(MEMBERSHIP_DIVIDEND_POOL_PORT, getStateBigInt(previousState, MEMBERSHIP_DIVIDEND_POOL_PORT, 0n)),
          programNumberState(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, getStateBigInt(previousState, MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0n)),
        ];
      }
      case 'mint_dividend': {
        const amount = BigInt(String(transition.inputs?.amount ?? 0n));
        return [
          programHexState(MEMBERSHIP_MEMBER_ROOT_PORT, getStateHex(previousState, MEMBERSHIP_MEMBER_ROOT_PORT, '')),
          programNumberState(MEMBERSHIP_DIVIDEND_POOL_PORT, getStateBigInt(previousState, MEMBERSHIP_DIVIDEND_POOL_PORT, 0n) + amount),
          programNumberState(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, getStateBigInt(previousState, MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0n)),
        ];
      }
      case 'pay_dividend': {
        const payout = BigInt(String(transition.inputs?.payoutSequence ?? 0n));
        return [
          programHexState(MEMBERSHIP_MEMBER_ROOT_PORT, getStateHex(previousState, MEMBERSHIP_MEMBER_ROOT_PORT, '')),
          programNumberState(MEMBERSHIP_DIVIDEND_POOL_PORT, 0n),
          programNumberState(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, payout),
        ];
      }
      default:
        return [
          programHexState(MEMBERSHIP_MEMBER_ROOT_PORT, getStateHex(previousState, MEMBERSHIP_MEMBER_ROOT_PORT, '')),
          programNumberState(MEMBERSHIP_DIVIDEND_POOL_PORT, getStateBigInt(previousState, MEMBERSHIP_DIVIDEND_POOL_PORT, 0n)),
          programNumberState(MEMBERSHIP_PAYOUT_SEQUENCE_PORT, getStateBigInt(previousState, MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0n)),
        ];
    }
  },
  validateTransition({ previousState, nextState, transition }) {
    if (!transition) return { valid: true };
    switch (transition.action) {
      case 'member_add':
      case 'member_remove': {
        const root = normalizeHex(String(transition.inputs?.memberRoot ?? ''));
        const nextRoot = getStateHex(nextState, MEMBERSHIP_MEMBER_ROOT_PORT, '');
        if (root === '') return { valid: false, error: 'membership member root required' };
        if (nextRoot !== root) return { valid: false, error: 'membership member root mismatch' };
        return { valid: true };
      }
      case 'mint_dividend': {
        const amount = BigInt(String(transition.inputs?.amount ?? 0n));
        const prevPool = getStateBigInt(previousState, MEMBERSHIP_DIVIDEND_POOL_PORT, 0n);
        const nextPool = getStateBigInt(nextState, MEMBERSHIP_DIVIDEND_POOL_PORT, 0n);
        if (amount < 0n) return { valid: false, error: 'membership dividend amount must be non-negative' };
        if (nextPool !== prevPool + amount) return { valid: false, error: 'membership dividend pool mismatch' };
        return { valid: true };
      }
      case 'pay_dividend': {
        const payout = BigInt(String(transition.inputs?.payoutSequence ?? 0n));
        const prevPayout = getStateBigInt(previousState, MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0n);
        const nextPayout = getStateBigInt(nextState, MEMBERSHIP_PAYOUT_SEQUENCE_PORT, 0n);
        const nextPool = getStateBigInt(nextState, MEMBERSHIP_DIVIDEND_POOL_PORT, 0n);
        if (payout <= prevPayout) return { valid: false, error: 'membership payout must advance sequence' };
        if (nextPayout !== payout) return { valid: false, error: 'membership payout sequence mismatch' };
        if (nextPool !== 0n) return { valid: false, error: 'membership payout must empty pool' };
        return { valid: true };
      }
      default:
        return { valid: false, error: `unsupported membership action: ${transition.action}` };
    }
  },
};

export const AssetProgram: ChannelProgram = {
  id: ASSET_PROGRAM_ID,
  version: 1,
  buildScript(parties: ChannelParticipant[]): string {
    return injectEltooScript(parties, [
      `LET A=STATE(${ASSET_HOLDER_A_BALANCE_PORT})`,
      `LET B=STATE(${ASSET_HOLDER_B_BALANCE_PORT})`,
      `LET TOTAL=STATE(${ASSET_TOTAL_PORT})`,
      'ASSERT A GTE 0',
      'ASSERT B GTE 0',
      'ASSERT A ADD B EQ TOTAL',
    ]);
  },
  buildStateVariables({ previousState, transition }: ChannelProgramBuildStateInput): StateValue[] {
    if (!transition) return [
      programHexState(ASSET_TOKEN_ID_PORT, getStateHex(previousState, ASSET_TOKEN_ID_PORT, '')),
      programNumberState(ASSET_HOLDER_A_BALANCE_PORT, getStateBigInt(previousState, ASSET_HOLDER_A_BALANCE_PORT, 0n)),
      programNumberState(ASSET_HOLDER_B_BALANCE_PORT, getStateBigInt(previousState, ASSET_HOLDER_B_BALANCE_PORT, 0n)),
      programNumberState(ASSET_TOTAL_PORT, getStateBigInt(previousState, ASSET_TOTAL_PORT, 0n)),
    ];
    switch (transition.action) {
      case 'configure': {
        const a = BigInt(String(transition.inputs?.holderABalance ?? 0n));
        const b = BigInt(String(transition.inputs?.holderBBalance ?? 0n));
        return [
          programHexState(ASSET_TOKEN_ID_PORT, normalizeHex(String(transition.inputs?.tokenId ?? ''))),
          programNumberState(ASSET_HOLDER_A_BALANCE_PORT, a),
          programNumberState(ASSET_HOLDER_B_BALANCE_PORT, b),
          programNumberState(ASSET_TOTAL_PORT, a + b),
        ];
      }
      case 'transfer': {
        const amount = BigInt(String(transition.inputs?.amount ?? 0n));
        const to = String(transition.inputs?.to ?? 'b');
        const prevA = getStateBigInt(previousState, ASSET_HOLDER_A_BALANCE_PORT, 0n);
        const prevB = getStateBigInt(previousState, ASSET_HOLDER_B_BALANCE_PORT, 0n);
        const total = getStateBigInt(previousState, ASSET_TOTAL_PORT, 0n);
        const nextA = to === 'a' ? prevA + amount : prevA - amount;
        const nextB = to === 'a' ? prevB - amount : prevB + amount;
        return [
          programHexState(ASSET_TOKEN_ID_PORT, getStateHex(previousState, ASSET_TOKEN_ID_PORT, '')),
          programNumberState(ASSET_HOLDER_A_BALANCE_PORT, nextA),
          programNumberState(ASSET_HOLDER_B_BALANCE_PORT, nextB),
          programNumberState(ASSET_TOTAL_PORT, total),
        ];
      }
      default:
        return [
          programHexState(ASSET_TOKEN_ID_PORT, getStateHex(previousState, ASSET_TOKEN_ID_PORT, '')),
          programNumberState(ASSET_HOLDER_A_BALANCE_PORT, getStateBigInt(previousState, ASSET_HOLDER_A_BALANCE_PORT, 0n)),
          programNumberState(ASSET_HOLDER_B_BALANCE_PORT, getStateBigInt(previousState, ASSET_HOLDER_B_BALANCE_PORT, 0n)),
          programNumberState(ASSET_TOTAL_PORT, getStateBigInt(previousState, ASSET_TOTAL_PORT, 0n)),
        ];
    }
  },
  validateTransition({ previousState, nextState, transition }) {
    if (!transition) return { valid: true };
    switch (transition.action) {
      case 'configure': {
        const a = getStateBigInt(nextState, ASSET_HOLDER_A_BALANCE_PORT, 0n);
        const b = getStateBigInt(nextState, ASSET_HOLDER_B_BALANCE_PORT, 0n);
        const total = getStateBigInt(nextState, ASSET_TOTAL_PORT, 0n);
        if (a < 0n || b < 0n) return { valid: false, error: 'asset balances must be non-negative' };
        if (total !== a + b) return { valid: false, error: 'asset conservation mismatch' };
        return { valid: true };
      }
      case 'transfer': {
        const amount = BigInt(String(transition.inputs?.amount ?? 0n));
        const to = String(transition.inputs?.to ?? 'b');
        if (amount < 0n) return { valid: false, error: 'asset transfer amount must be non-negative' };
        const prevA = getStateBigInt(previousState, ASSET_HOLDER_A_BALANCE_PORT, 0n);
        const prevB = getStateBigInt(previousState, ASSET_HOLDER_B_BALANCE_PORT, 0n);
        const total = getStateBigInt(previousState, ASSET_TOTAL_PORT, 0n);
        const nextA = getStateBigInt(nextState, ASSET_HOLDER_A_BALANCE_PORT, 0n);
        const nextB = getStateBigInt(nextState, ASSET_HOLDER_B_BALANCE_PORT, 0n);
        const nextTotal = getStateBigInt(nextState, ASSET_TOTAL_PORT, 0n);
        const expectedA = to === 'a' ? prevA + amount : prevA - amount;
        const expectedB = to === 'a' ? prevB - amount : prevB + amount;
        if (expectedA < 0n || expectedB < 0n) return { valid: false, error: 'asset transfer exceeds balance' };
        if (nextA !== expectedA || nextB !== expectedB) return { valid: false, error: 'asset balance accounting mismatch' };
        if (nextTotal !== total) return { valid: false, error: 'asset conservation mismatch' };
        return { valid: true };
      }
      default:
        return { valid: false, error: `unsupported asset action: ${transition.action}` };
    }
  },
};

programs.set(`${HTLCPaymentProgram.id}@${HTLCPaymentProgram.version}`, HTLCPaymentProgram);
programs.set(`${VaultProgram.id}@${VaultProgram.version}`, VaultProgram);
programs.set(`${TreasuryProgram.id}@${TreasuryProgram.version}`, TreasuryProgram);
programs.set(`${MembershipProgram.id}@${MembershipProgram.version}`, MembershipProgram);
programs.set(`${AssetProgram.id}@${AssetProgram.version}`, AssetProgram);

export function registerChannelProgram(program: ChannelProgram): void {
  programs.set(`${program.id}@${program.version}`, program);
}

export function resolveChannelProgram(program?: ChannelProgram | { id?: string; version?: number }): ChannelProgram {
  if (!program) return DefaultEltooPaymentProgram;
  if ('buildScript' in program) return program;
  const id = program.id ?? DefaultEltooPaymentProgram.id;
  const version = program.version ?? DefaultEltooPaymentProgram.version;
  const resolved = programs.get(`${id}@${version}`);
  if (!resolved) throw new Error(`Unknown ChannelProgram: ${id}@${version}`);
  return resolved;
}

export function buildProgramUpdateTx(
  channel: OmniaChannel,
  sequence: number,
  balances: Record<string, bigint>,
  pendingHTLCs: HTLCRecord[],
  transition?: ProgramTransition,
): OmniaTxDraft {
  const program = resolveChannelProgram({ id: channel.programId, version: channel.programVersion });
  const canonicalTransition = canonicalizeProgramTransition(transition);
  const programStateVariables = program.buildStateVariables({
    channel,
    sequence,
    balances,
    pendingHTLCs: pendingHTLCs.filter(h => h.status === 'pending'),
    settlement: false,
    previousState: channel.latestState,
    transition: canonicalTransition,
  });
  return buildUpdateTx(channel, sequence, balances, pendingHTLCs, programStateVariables);
}

export function computeProgramUpdateDigest(
  channel: OmniaChannel,
  sequence: number,
  balances: Record<string, bigint>,
  pendingHTLCs: HTLCRecord[],
  transition?: ProgramTransition,
): Uint8Array {
  return computeOmniaTxDigest(buildProgramUpdateTx(channel, sequence, balances, pendingHTLCs, transition));
}

export function computeProgramUpdateDigestHex(
  channel: OmniaChannel,
  sequence: number,
  balances: Record<string, bigint>,
  pendingHTLCs: HTLCRecord[],
  transition?: ProgramTransition,
): string {
  return bytesToHex(computeProgramUpdateDigest(channel, sequence, balances, pendingHTLCs, transition));
}
