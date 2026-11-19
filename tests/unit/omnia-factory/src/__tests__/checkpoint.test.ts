/**
 * OMN-058 / RFC-079 §4 — checkpoint mode.
 *
 * Every allocation change consumes the factory coin and recreates it at the same
 * script with an advanced sequence, so the unilateral escape always pays the
 * latest checkpoint rather than the original funding split.
 */

import {
  assertFactoryCheckpointTransition,
  buildFactoryCheckpoint,
  factoryCheckpointSnapshot,
  factoryCheckpointStateVariables,
} from '../checkpoint.js';
import {
  buildFactoryScript,
  computeFactoryBalanceRoot,
  computeFactoryPartyRoot,
  FACTORY_BALANCE_PORT_BASE,
  FACTORY_BALANCE_ROOT_PORT,
  FACTORY_CHECKPOINT_SEQUENCE_PORT,
  FACTORY_ESCAPE_PORT,
  FACTORY_PARTY_ROOT_PORT,
} from '../script.js';
import type { FactoryParticipant } from '../types.js';
import { evaluateScript } from '@totemsdk/kissvm';
import type { TxContext } from '@totemsdk/kissvm';

const participants: FactoryParticipant[] = [
  { partyId: 'alice', publicKeyDigest: '0x' + '11'.repeat(32), addressIndex: 0, contributionAmount: 100n },
  { partyId: 'bob', publicKeyDigest: '0x' + '22'.repeat(32), addressIndex: 1, contributionAmount: 100n },
];

const ADDRESS = '0x' + 'aa'.repeat(32);
const COIN = '0x' + 'bb'.repeat(32);

function checkpoint(allocations: Record<string, bigint>, sequence = 1n, previousSequence = 0n) {
  return buildFactoryCheckpoint({
    participants,
    allocations,
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 200n,
    fundingAddress: ADDRESS,
    fundingCoinId: COIN,
    escapeBlock: 1_500,
    sequence,
    previousSequence,
  });
}

describe('OMN-058 checkpoint transaction', () => {
  it('recreates the factory coin at the same script with the new allocation', () => {
    const built = checkpoint({ alice: 70n, bob: 130n });
    expect(built.draft.inputs).toHaveLength(1);
    expect(built.draft.inputs[0]).toMatchObject({ coinId: COIN, address: ADDRESS, amount: 200n });
    expect(built.output).toMatchObject({ address: ADDRESS, amount: 200n, storeState: true });

    const byPort = new Map(built.stateVariables.map((entry) => [entry.port, entry.value]));
    expect(byPort.get(FACTORY_BALANCE_PORT_BASE)).toBe(70n);
    expect(byPort.get(FACTORY_BALANCE_PORT_BASE + 1)).toBe(130n);
    expect(byPort.get(FACTORY_CHECKPOINT_SEQUENCE_PORT)).toBe(1n);
    expect(byPort.get(FACTORY_ESCAPE_PORT)).toBe(1_500n);
    expect(byPort.get(FACTORY_PARTY_ROOT_PORT)).toBe(computeFactoryPartyRoot(participants));
    expect(byPort.get(FACTORY_BALANCE_ROOT_PORT)).toBe(
      computeFactoryBalanceRoot({ alice: 70n, bob: 130n }),
    );
  });

  it('carries share amounts at scale 44 so the escape pays them as coins', () => {
    const built = checkpoint({ alice: 70n, bob: 130n });
    const share = built.stateVariables.find((entry) => entry.port === FACTORY_BALANCE_PORT_BASE);
    expect(share).toMatchObject({ type: 'number', scale: 44 });
  });

  it('rejects an allocation that does not conserve the factory value', () => {
    expect(() => checkpoint({ alice: 70n, bob: 100n })).toThrow(/do not conserve/);
  });

  it('rejects an unknown or missing participant', () => {
    expect(() => checkpoint({ alice: 100n, mallory: 100n })).toThrow(/exactly the factory participants/);
    expect(() => checkpoint({ alice: 200n })).toThrow(/exactly the factory participants/);
  });

  it('rejects a non-advancing sequence', () => {
    expect(() => checkpoint({ alice: 100n, bob: 100n }, 1n, 1n)).toThrow(/must be greater/);
  });
});

describe('OMN-058 checkpoint transition rules', () => {
  const before = factoryCheckpointSnapshot(checkpoint({ alice: 100n, bob: 100n }, 1n, 0n), participants);
  const after = factoryCheckpointSnapshot(checkpoint({ alice: 70n, bob: 130n }, 2n, 1n), participants);

  it('accepts a conserving, advancing, same-script transition', () => {
    expect(() => assertFactoryCheckpointTransition(before, after)).not.toThrow();
  });

  it('rejects a different script address', () => {
    expect(() => assertFactoryCheckpointTransition(before, { ...after, address: '0x' + 'cc'.repeat(32) }))
      .toThrow(/same script address/);
  });

  it('rejects a value change', () => {
    expect(() => assertFactoryCheckpointTransition(before, { ...after, totalValue: 201n }))
      .toThrow(/conserve the factory value/);
  });

  it('rejects a stale or equal sequence', () => {
    expect(() => assertFactoryCheckpointTransition(before, { ...after, sequence: 1n }))
      .toThrow(/must advance/);
  });

  it('rejects a changed party set', () => {
    expect(() => assertFactoryCheckpointTransition(before, { ...after, partyRoot: '0x' + 'dd'.repeat(32) }))
      .toThrow(/committed party set/);
  });

  it('rejects a balance root that does not commit the allocations', () => {
    expect(() => assertFactoryCheckpointTransition(before, {
      ...after,
      balanceRoot: computeFactoryBalanceRoot({ alice: 100n, bob: 100n }),
    })).toThrow(/balance root/);
  });
});

describe('OMN-058 checkpoint covenant', () => {
  const script = buildFactoryScript(participants, { enforceCheckpoints: true });
  const defaultScript = buildFactoryScript(participants);

  it('requires the sequence to advance by exactly one', () => {
    expect(script).toContain(
      `ASSERT STATE(${FACTORY_CHECKPOINT_SEQUENCE_PORT}) EQ INC(PREVSTATE(${FACTORY_CHECKPOINT_SEQUENCE_PORT}))`,
    );
    expect(defaultScript).not.toContain('INC(PREVSTATE(104))');
  });

  it('requires a same-script, same-value successor and a pinned party set', () => {
    expect(script).toContain('ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)');
    expect(script).toContain(`ASSERT SAMESTATE(${FACTORY_PARTY_ROOT_PORT} ${FACTORY_PARTY_ROOT_PORT})`);
  });

  it('still pays the latest checkpointed shares in the escape branch', () => {
    // The escape reads PREVSTATE, so after a checkpoint it pays the new split.
    expect(script).toContain('LET share=PREVSTATE(' + FACTORY_BALANCE_PORT_BASE + ')');
  });

  const partyRoot = computeFactoryPartyRoot(participants);
  const committed = {
    100: '0',
    104: '1',
    [FACTORY_ESCAPE_PORT]: '1500',
    [FACTORY_PARTY_ROOT_PORT]: partyRoot,
    [FACTORY_BALANCE_PORT_BASE]: '100',
    [FACTORY_BALANCE_PORT_BASE + 1]: '100',
  };

  function context(overrides: Partial<TxContext> = {}): TxContext {
    return {
      block: 1_000,
      inputIndex: 0,
      inputs: [{ amount: 200, tokenId: '0x00', coinId: COIN, address: ADDRESS }],
      outputs: [{ address: ADDRESS, amount: 200, tokenId: '0x00', keepState: true }],
      state: { ...committed, 104: '2' },
      prevState: { ...committed },
      simulationMode: true,
      ...overrides,
    } as TxContext;
  }

  function run(overrides: Partial<TxContext> = {}) {
    const witness = {
      signatures: new Map([[participants[0]!.publicKeyDigest.replace(/^0x/i, '').toLowerCase(), new Uint8Array(1088)],
        [participants[1]!.publicKeyDigest.replace(/^0x/i, '').toLowerCase(), new Uint8Array(1088)]]),
    };
    return evaluateScript(script, witness as never, context(overrides));
  }

  it('accepts a same-script successor that advances the sequence', () => {
    expect(run().passed).toBe(true);
  });

  it('rejects a stale sequence', () => {
    expect(run({ state: { ...committed, 104: '1' } }).passed).toBe(false);
  });

  it('rejects a successor that changes the value', () => {
    const inflated = [{ address: ADDRESS, amount: 201, tokenId: '0x00', keepState: true }];
    expect(run({ outputs: inflated }).passed).toBe(false);
  });

  it('rejects a successor at a different script', () => {
    const moved = [{ address: '0x' + 'ee'.repeat(32), amount: 200, tokenId: '0x00', keepState: true }];
    expect(run({ outputs: moved }).passed).toBe(false);
  });

  it('seeds the checkpoint sequence state variable', () => {
    const variables = factoryCheckpointStateVariables({
      participants,
      allocations: { alice: 100n, bob: 100n },
      tokenId: '0x00',
      totalValue: 200n,
      escapeBlock: 1_500,
      sequence: 0n,
    });
    expect(variables.find((entry) => entry.port === FACTORY_CHECKPOINT_SEQUENCE_PORT)?.value).toBe(0n);
  });
});
