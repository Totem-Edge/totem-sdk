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

export function getStateBool(
  state: Pick<SignedChannelState, 'stateVariables'> | null | undefined,
  port: number,
  fallback = false,
): boolean {
  const value = getStateValue(state, port)?.value;
  if (value === undefined) return fallback;
  return Boolean(value);
}

export function getStateHex(
  state: Pick<SignedChannelState, 'stateVariables'> | null | undefined,
  port: number,
  fallback = '',
): string {
  const value = getStateValue(state, port)?.value;
  if (value === undefined) return fallback;
  return String(value);
}

export function programNumberState(port: number, value: bigint): StateValue {
  assertProgramStatePort(port);
  return { port, value, type: 'number' };
}

export function programBoolState(port: number, value: boolean): StateValue {
  assertProgramStatePort(port);
  return { port, value, type: 'bool' };
}

export function programHexState(port: number, value: string): StateValue {
  assertProgramStatePort(port);
  if (!/^(0x)?[0-9a-fA-F]*$/.test(value)) {
    throw new Error(`Program state port ${port}: hex value must be a hex string`);
  }
  return { port, value, type: 'hex' };
}

export function programStringState(port: number, value: string): StateValue {
  assertProgramStatePort(port);
  return { port, value, type: 'string' };
}

export function getStateString(
  state: Pick<SignedChannelState, 'stateVariables'> | null | undefined,
  port: number,
  fallback = '',
): string {
  const value = getStateValue(state, port)?.value;
  if (value === undefined) return fallback;
  return String(value);
}
