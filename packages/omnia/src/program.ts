import { bytesToHex } from '@totemsdk/core';
import type { ChannelParticipant, ChannelProgram, ChannelProgramBuildStateInput, OmniaChannel, OmniaTxDraft, StateValue, HTLCRecord, ProgramTransition } from './types.js';
import { buildEltooScript } from './script.js';
import { buildUpdateTx, computeOmniaTxDigest } from './transactions.js';
import { canonicalizeProgramTransition } from './transition.js';

export const ELTOO_PAYMENT_PROGRAM_ID = 'eltoo-payment';

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

programs.set(`${DefaultEltooPaymentProgram.id}@${DefaultEltooPaymentProgram.version}`, DefaultEltooPaymentProgram);

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
