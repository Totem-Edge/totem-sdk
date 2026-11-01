import type { OmniaChannel, SignedChannelState } from './types.js';

/**
 * Rust/WASM state mirror.
 *
 * The mirror independently recomputes the state commitment, replays the signed
 * transaction bytes, verifies every party's WOTS tree signature and checks the
 * close package. It is fed the serialized decimal-string form (bigints as
 * decimal strings, signatures as hex), which is also the persistence form.
 *
 * If the wasm build is absent this fails closed — it never reports a state as
 * valid by default.
 */

type VerifyStateFn = (
  channelJson: string,
  stateJson: string,
) => { valid: boolean; errors?: string[] };

let verifyStateWasm: VerifyStateFn | undefined;

// Prefer the Node build; the browser build is ESM and cannot be required here.
for (const candidate of ['../rust/pkg-node/omnia_wasm.js', '../rust/pkg/omnia_wasm.js']) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const wasm = require(candidate);
    if (typeof wasm.verify_state_wasm === 'function') {
      verifyStateWasm = wasm.verify_state_wasm;
      break;
    }
  } catch {
    // try the next candidate
  }
}

/**
 * Inject a mirror verifier (tests, hosts, alternate builds). Passing `undefined`
 * restores the bundled lookup.
 */
export function configureRustMirror(verifier: VerifyStateFn | undefined): void {
  verifyStateWasm = verifier;
}

function hexifySignatures(signatures: Record<string, Uint8Array> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(signatures).map(([party, signature]) => [
      party,
      '0x' + Buffer.from(signature).toString('hex'),
    ]),
  );
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
}

export function serializeChannelForMirror(channel: OmniaChannel): string {
  return stringify(channel);
}

export function serializeStateForMirror(state: SignedChannelState): string {
  const closePackage = state.closePackage
    ? {
        ...state.closePackage,
        update: {
          ...state.closePackage.update,
          signatures: hexifySignatures(state.closePackage.update.signatures),
        },
        settlement: {
          ...state.closePackage.settlement,
          signatures: hexifySignatures(state.closePackage.settlement.signatures),
        },
      }
    : undefined;

  return stringify({
    ...state,
    signatures: hexifySignatures(state.signatures),
    closePackage,
  });
}

/**
 * Verify a signed channel state with the Rust mirror.
 *
 * Returns `{ valid: false }` when the mirror is unavailable or throws.
 */
export function verifyStateWithRustMirror(
  channel: OmniaChannel,
  state: SignedChannelState,
): { valid: boolean; errors: string[] } {
  if (!verifyStateWasm) {
    return { valid: false, errors: ['Rust state mirror is not built'] };
  }
  try {
    const result = verifyStateWasm(
      serializeChannelForMirror(channel),
      serializeStateForMirror(state),
    );
    return { valid: result.valid === true, errors: result.errors ?? [] };
  } catch (error) {
    return { valid: false, errors: [String(error)] };
  }
}

/** True when the wasm mirror is loaded in this runtime. */
export function isRustMirrorAvailable(): boolean {
  return verifyStateWasm !== undefined;
}
