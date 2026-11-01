/**
 * State-signature tests with REAL cryptographic material.
 *
 * The main omnia unit suite mocks `@totemsdk/core` verification so it can use
 * fake signatures. That makes every signature assertion in it vacuous, so the
 * signed-payload binding is proven here instead: real TreeKeys, real
 * `verifyTreeSignature`, no `jest.mock('@totemsdk/core')`.
 */
import { TreeKey, serializeTreeSignature } from '@totemsdk/core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { attachCounterpartySignature, updateState } from '../channel';
import { signState, verifyStateSignature } from '../sign';
import { configureRustMirror, verifyStateWithRustMirror } from '../rust-mirror';
import { buildEltooScript, scriptAddress } from '../script';
import type { ChannelSigner, OmniaChannel } from '../types';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const mk = (fill: number) => new TreeKey(new Uint8Array(32).fill(fill), 64, 3);
const publicKey = (key: TreeKey) => '0x' + hex(key.getPublicKey());

const aliceKey = mk(0xa1);
const bobKey = mk(0xb2);
const alicePkd = publicKey(aliceKey);
const bobPkd = publicKey(bobKey);

function makeLeaseProvider() {
  let l2 = 0;
  return {
    reserveKeyUse: async () => {
      const index = l2++;
      return {
        reservationId: `res-${index}`,
        indices: { addressIndex: 0, l1: 0, l2: index },
        expiresAt: Date.now() + 60_000,
      };
    },
    commitKeyUse: async () => {},
    burnReservation: async () => {},
  } as any;
}

function makeSigner(key: TreeKey, publicKeyDigest: string): ChannelSigner {
  return {
    publicKeyDigest,
    sign: async (digest: Uint8Array) => serializeTreeSignature(key.sign(digest)),
  };
}

function makeChannel(): OmniaChannel {
  const parties = [
    { partyId: 'alice', publicKeyDigest: alicePkd, addressIndex: 0 },
    { partyId: 'bob', publicKeyDigest: bobPkd, addressIndex: 1 },
  ];
  const script = buildEltooScript(parties);
  return {
    channelId: '0xrealstate0000001',
    fundingTxId: '0xtxpow0',
    fundingCoinId: '0x' + 'aa'.repeat(32),
    fundingScript: script,
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: scriptAddress(script),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties,
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('@totemsdk/omnia — state signatures (real WOTS)', () => {
  it('verifies a real TreeSignature and rejects re-labelled state bytes', async () => {
    const channel = makeChannel();
    const { signedState } = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      makeLeaseProvider(),
      makeSigner(aliceKey, alicePkd),
    );

    expect(verifyStateSignature(channel, signedState as any, 'alice', alicePkd)).toBe(true);

    const tamperedVariables = {
      ...signedState,
      stateVariables: [
        ...(signedState.stateVariables ?? []),
        { port: 199, value: 1n, type: 'number' as const },
      ],
    };
    expect(verifyStateSignature(channel, tamperedVariables as any, 'alice', alicePkd)).toBe(false);

    const tamperedTransaction = {
      ...signedState,
      transactionHex: '00' + (signedState.transactionHex ?? '').slice(2),
    };
    expect(verifyStateSignature(channel, tamperedTransaction as any, 'alice', alicePkd)).toBe(false);
  });

  it('rejects tampered balances and the wrong signing key', async () => {
    const channel = makeChannel();
    const { signedState } = await updateState(
      channel,
      { newBalances: { alice: 500n, bob: 500n } },
      makeLeaseProvider(),
      makeSigner(aliceKey, alicePkd),
    );

    const tamperedBalances = { ...signedState, balances: { alice: 900n, bob: 100n } };
    expect(verifyStateSignature(channel, tamperedBalances as any, 'alice', alicePkd)).toBe(false);

    // Bob's key must not satisfy Alice's party binding.
    expect(verifyStateSignature(channel, signedState as any, 'alice', bobPkd)).toBe(false);
  });
});


const WASM_PATH = join(__dirname, '../../../../../packages/omnia/rust/pkg-node/omnia_wasm.js');
const hasWasm = existsSync(WASM_PATH);
const requireWasm = createRequire(__filename);
const wasm = hasWasm ? requireWasm(WASM_PATH) : null;

(hasWasm ? describe : describe.skip)('@totemsdk/omnia — Rust verify-state parity', () => {
  beforeAll(() => configureRustMirror(wasm.verify_state_wasm));

  it('accepts a fully signed state and rejects tampered balances', async () => {
    const channel = makeChannel();
    const balances = { alice: 500n, bob: 500n };

    const alicePartial = await signState(
      channel,
      { newSequence: 1, newBalances: balances },
      makeLeaseProvider(),
      makeSigner(aliceKey, alicePkd),
    );
    const bobPartial = await signState(
      channel,
      { newSequence: 1, newBalances: balances },
      makeLeaseProvider(),
      makeSigner(bobKey, bobPkd),
    );
    const { signedState } = attachCounterpartySignature(
      channel,
      alicePartial,
      'bob',
      bobPartial.signatures!.bob,
      bobPartial.signingIndices!.bob,
      bobPartial.closePackage,
    );

    const result = verifyStateWithRustMirror(channel, signedState);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);

    const tamperedBalances = { ...signedState, balances: { alice: 900n, bob: 100n } };
    expect(verifyStateWithRustMirror(channel, tamperedBalances).valid).toBe(false);

    const tamperedTransaction = {
      ...signedState,
      transactionHex: '00' + (signedState.transactionHex ?? '').slice(2),
    };
    expect(verifyStateWithRustMirror(channel, tamperedTransaction).valid).toBe(false);

    const forgedSignature = {
      ...signedState,
      signatures: { ...signedState.signatures, bob: signedState.signatures.alice },
    };
    expect(verifyStateWithRustMirror(channel, forgedSignature).valid).toBe(false);
  });
});
