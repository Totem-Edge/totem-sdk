import { bytesToHex } from '@totemsdk/core';
import type { ChannelParticipant, ChannelProgram, ChannelProgramBuildStateInput, OmniaChannel, OmniaTxDraft, StateValue, HTLCRecord, ProgramTransition } from './types.js';
import { buildEltooScript } from './script.js';
import { buildUpdateTx, computeOmniaTxDigest } from './transactions.js';
import { canonicalizeProgramTransition } from './transition.js';
import { getStateBigInt, programNumberState } from './state-vars.js';

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

const programs = new Map<string, ChannelProgram>();

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
