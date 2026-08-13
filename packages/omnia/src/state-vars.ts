import type { SignedChannelState, StateValue } from './types.js';

export const PROGRAM_STATE_PORT_MIN = 120;

export function assertProgramStatePort(port: number): void {
  if (!Number.isInteger(port) || port < PROGRAM_STATE_PORT_MIN) {
    throw new Error(`Program state port must be an integer >= ${PROGRAM_STATE_PORT_MIN}`);
  }
}

export function getStateValue(
  state: Pick<SignedChannelState, 'stateVariables'> | null | undefined,
  port: number,
): StateValue | undefined {
  return state?.stateVariables.find(v => v.port === port);
}

export function getStateBigInt(
  state: Pick<SignedChannelState, 'stateVariables'> | null | undefined,
  port: number,
  fallback = 0n,
): bigint {
  const value = getStateValue(state, port)?.value;
  if (value === undefined) return fallback;
  return BigInt(String(value));
}

export function programNumberState(port: number, value: bigint): StateValue {
  assertProgramStatePort(port);
  return { port, value, type: 'number' };
}
