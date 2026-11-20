/**
 * OMN-058 / RFC-079 §4A — output-enforced full distribution.
 *
 * The covenant must independently establish WHO is paid and HOW MUCH, reading
 * the committed shares from the spent coin. Signatures authorize the trigger,
 * never the payout set.
 */

import { wotsAddressData } from '@totemsdk/core';
import { evaluateScript } from '@totemsdk/kissvm';
import type { TxContext } from '@totemsdk/kissvm';

import { buildFactoryOpening } from '../factory.js';
import {
  assertFactoryDistributable,
  buildFactoryDistribution,
  factoryDistributionPayouts,
} from '../distribution.js';
import {
  buildFactoryDistributionScript,
  buildFactoryScript,
  FACTORY_BALANCE_PORT_BASE,
  FACTORY_ESCAPE_PORT,
} from '../script.js';
import type { ChannelFactory, FactoryParticipant } from '../types.js';

function party(id: string, seed: string, amount: bigint): FactoryParticipant {
  const pk = '0x' + seed.repeat(32);
  return { partyId: id, publicKeyDigest: pk, addressIndex: 0, contributionAmount: amount, settlementAddress: pk };
}

function factory(participants: FactoryParticipant[], allocations: Record<string, bigint>): ChannelFactory {
  return {
    factoryId: 'f-dist',
    participants,
    totalValue: Object.values(allocations).reduce((sum, amount) => sum + amount, 0n),
    tokenId: '0x00',
    tokenScale: 0,
    allocations,
    virtualChannels: [],
    currentSequence: 1,
    status: 'active',
    stateLog: [],
    fundingScript: 'RETURN TRUE',
    fundingAddress: '0x' + 'aa'.repeat(32),
    fundingCoinId: '0x' + 'bb'.repeat(32),
  } as unknown as ChannelFactory;
}

const ALICE = party('alice', '11', 70n);
const BOB = party('bob', '22', 130n);
const PARTICIPANTS = [ALICE, BOB];
const ALICE_ADDR = wotsAddressData(ALICE.publicKeyDigest);
const BOB_ADDR = wotsAddressData(BOB.publicKeyDigest);

const committed = {
  100: '0',
  [FACTORY_ESCAPE_PORT]: '1500',
  [FACTORY_BALANCE_PORT_BASE]: '70',
  [FACTORY_BALANCE_PORT_BASE + 1]: '130',
};

function outputs(): NonNullable<TxContext['outputs']> {
  return [
    { address: ALICE_ADDR, amount: 70, tokenId: '0x00', keepState: false },
    { address: BOB_ADDR, amount: 130, tokenId: '0x00', keepState: false },
  ];
}

function witness(...signers: FactoryParticipant[]) {
  return {
    signatures: new Map(signers.map((signer) => [
      signer.publicKeyDigest.replace(/^0x/i, '').toLowerCase(),
      new Uint8Array(1088),
    ])),
  };
}

function context(overrides: Partial<TxContext> = {}): TxContext {
  return {
    block: 2_000,
    inputIndex: 0,
    inputs: [{ amount: 200, tokenId: '0x00', coinId: '0xbb', address: '0xaa' }],
    outputs: outputs(),
    state: {},
    prevState: { ...committed },
    simulationMode: true,
    ...overrides,
  } as TxContext;
}

const standalone = buildFactoryDistributionScript({ participants: PARTICIPANTS as never });

function run(overrides: Partial<TxContext> = {}, signers: FactoryParticipant[] = [ALICE]) {
  return evaluateScript(standalone, witness(...signers) as never, context(overrides));
}

describe('OMN-058 output-enforced distribution covenant', () => {
  it('pays every committed share from PREVSTATE', () => {
    expect(standalone).toContain(`VERIFYOUT(0 ${ALICE_ADDR} PREVSTATE(${FACTORY_BALANCE_PORT_BASE}) @TOKENID FALSE)`);
    expect(standalone).toContain(`VERIFYOUT(1 ${BOB_ADDR} PREVSTATE(${FACTORY_BALANCE_PORT_BASE + 1}) @TOKENID FALSE)`);
    expect(standalone).toContain('ASSERT @TOTOUT EQ 2');
    expect(standalone).toMatch(/PREVSTATE\(128\) \+ PREVSTATE\(129\) EQ @AMOUNT/);
  });

  it('needs only one participant signature to trigger', () => {
    expect(run({}, [ALICE]).passed).toBe(true);
    expect(run({}, [BOB]).passed).toBe(true);
  });

  it('rejects a spend with no participant signature', () => {
    expect(run({}, []).passed).toBe(false);
  });

  it('rejects before the escape block', () => {
    expect(run({ block: 1_000 }).passed).toBe(false);
  });

  it('rejects a redirected payout', () => {
    const redirected = outputs();
    redirected[0] = { ...redirected[0]!, address: wotsAddressData('0x' + 'cc'.repeat(32)) };
    expect(run({ outputs: redirected }).passed).toBe(false);
  });

  it('rejects a resized payout', () => {
    const resized = outputs();
    resized[0] = { ...resized[0]!, amount: 80 };
    resized[1] = { ...resized[1]!, amount: 120 };
    expect(run({ outputs: resized }).passed).toBe(false);
  });

  it('rejects a missing output', () => {
    expect(run({ outputs: [outputs()[0]!] }).passed).toBe(false);
  });

  it('rejects an extra output', () => {
    expect(run({
      outputs: [...outputs(), { address: ALICE_ADDR, amount: 0, tokenId: '0x00', keepState: false }],
    }).passed).toBe(false);
  });

  it('rejects a wrong token', () => {
    const wrong = outputs();
    wrong[0] = { ...wrong[0]!, tokenId: '0x' + 'dd'.repeat(32) };
    expect(run({ outputs: wrong }).passed).toBe(false);
  });

  it('rejects a stale coin whose shares changed (checkpoint binding)', () => {
    // The transaction claims the old 100/100 split while the spent coin holds
    // the checkpointed 70/130 allocation.
    const stale = [
      { address: ALICE_ADDR, amount: 100, tokenId: '0x00', keepState: false },
      { address: BOB_ADDR, amount: 100, tokenId: '0x00', keepState: false },
    ];
    expect(run({ outputs: stale }).passed).toBe(false);
  });
});

describe('OMN-058 distribution inside the funded covenant', () => {
  const script = buildFactoryScript(PARTICIPANTS as never, { settlement: 'full-distribution' });

  it('adds the checked branch before the per-party escape branches', () => {
    const distribution = script.indexOf('IF @TOTOUT EQ 2');
    const perParty = script.indexOf(`LET share=PREVSTATE(${FACTORY_BALANCE_PORT_BASE})`);
    expect(distribution).toBeGreaterThan(-1);
    expect(distribution).toBeLessThan(perParty);
  });

  it('settles the factory without a successor state', () => {
    const result = evaluateScript(script, witness(ALICE) as never, context({ state: {} }));
    expect(result.passed).toBe(true);
  });

  it('still rejects a payout the shares do not authorize', () => {
    const wrong = outputs();
    wrong[1] = { ...wrong[1]!, amount: 100 };
    expect(evaluateScript(script, witness(ALICE) as never, context({ outputs: wrong })).passed).toBe(false);
  });

  it('keeps the per-party escape available for a single share', () => {
    const perParty = evaluateScript(script, witness(ALICE) as never, context({
      outputs: [
        { address: ALICE_ADDR, amount: 70, tokenId: '0x00', keepState: false },
        { address: '0xaa', amount: 130, tokenId: '0x00', keepState: true },
      ],
      state: {
        [FACTORY_BALANCE_PORT_BASE]: '0',
        [FACTORY_BALANCE_PORT_BASE + 1]: '130',
        [FACTORY_ESCAPE_PORT]: '1500',
      },
    }));
    expect(perParty.passed).toBe(true);
  });
});

describe('OMN-058 distribution instruction budget', () => {
  function cost(count: number): number {
    const participants = Array.from({ length: count }, (_, index) =>
      party(`p${index}`, (index + 1).toString(16).padStart(2, '0'), 10n));
    const script = buildFactoryDistributionScript({ participants: participants as never });
    const share = 10;
    const ctx: TxContext = {
      block: 2_000,
      inputIndex: 0,
      inputs: [{ amount: 10 * count, tokenId: '0x00', coinId: '0xbb', address: '0xaa' }],
      outputs: participants.map((participant) => ({
        address: wotsAddressData(participant.publicKeyDigest),
        amount: share,
        tokenId: '0x00',
        keepState: false,
      })),
      state: {},
      prevState: Object.fromEntries(participants.map((_, index) => [FACTORY_BALANCE_PORT_BASE + index, String(share)])),
      simulationMode: true,
    } as TxContext;
    const result = evaluateScript(script, witness(participants[0]!) as never, ctx);
    expect(result.passed).toBe(true);
    return result.instructionsUsed;
  }

  it('keeps the combined funding covenant within budget for 2, 3 and 5 participants', () => {
    const measurements = [2, 3, 5, 10].map((count) => {
      const participants = Array.from({ length: count }, (_, index) =>
        party(`p${index}`, (index + 1).toString(16).padStart(2, '0'), 10n));
      const script = buildFactoryScript(participants as never, { settlement: 'full-distribution' });
      const share = 10;
      const ctx: TxContext = {
        block: 2_000,
        inputIndex: 0,
        inputs: [{ amount: 10 * count, tokenId: '0x00', coinId: '0xbb', address: '0xaa' }],
        outputs: participants.map((participant) => ({
          address: wotsAddressData(participant.publicKeyDigest),
          amount: share,
          tokenId: '0x00',
          keepState: false,
        })),
        state: {},
        prevState: Object.fromEntries([
          [FACTORY_ESCAPE_PORT, '0'],
          ...participants.map((_, index) => [FACTORY_BALANCE_PORT_BASE + index, String(share)]),
        ]),
        simulationMode: true,
      } as TxContext;
      const result = evaluateScript(script, witness(participants[0]!) as never, ctx);
      expect(result.passed).toBe(true);
      return { count, instructions: result.instructionsUsed };
    });
    for (const { count, instructions } of measurements) {
      expect({ count, withinBudget: instructions < 1024 }).toEqual({ count, withinBudget: true });
    }
  });

  it('stays within the KISSVM budget for 2, 3, 5 and 10 participants', () => {
    const measurements = [2, 3, 5, 10].map((count) => ({ count, instructions: cost(count) }));
    for (const { count, instructions } of measurements) {
      // 1024 is the evaluator limit; the MASH composite reservation leaves less,
      // so record the real numbers rather than asserting a guess.
      expect({ count, withinBudget: instructions < 1024 }).toEqual({ count, withinBudget: true });
    }
    // Growth is linear in participants and small relative to the budget.
    const ten = measurements.at(-1)!.instructions;
    const two = measurements[0]!.instructions;
    expect(ten - two).toBeLessThan(100);
  });
});

describe('OMN-058 distribution transaction', () => {
  it('materializes the committed allocation in participant order', () => {
    const built = buildFactoryDistribution(
      factory(PARTICIPANTS as never, { alice: 70n, bob: 130n }),
      { fundingCoinId: '0x' + 'bb'.repeat(32) },
    );
    expect(built.total).toBe(200n);
    expect(built.outputs.map((entry) => ({ id: entry.partyId, amount: entry.amount })))
      .toEqual([{ id: 'alice', amount: 70n }, { id: 'bob', amount: 130n }]);
    expect(built.draft.inputs).toHaveLength(1);
    expect(built.draft.inputs[0]).toMatchObject({ coinId: '0x' + 'bb'.repeat(32), amount: 200n });
    expect(built.draft.storeState).toBe(false);
  });

  it('uses the checkpointed allocation, not the funding split', () => {
    const checkpointed = factory(PARTICIPANTS as never, { alice: 10n, bob: 190n });
    expect(factoryDistributionPayouts(checkpointed).map((payout) => payout.amount)).toEqual([10n, 190n]);
  });

  it('refuses to distribute while a virtual channel holds value', () => {
    const withVc = factory(PARTICIPANTS as never, { alice: 70n, bob: 30n });
    (withVc as unknown as { virtualChannels: unknown[] }).virtualChannels = [{
      channelId: 'vc-1', status: 'active', totalValue: 100n,
    }];
    expect(() => assertFactoryDistributable(withVc)).toThrow(/virtual channel/);
    expect(() => buildFactoryDistribution(withVc, { fundingCoinId: '0x' + 'bb'.repeat(32) }))
      .toThrow(/virtual channel/);
  });

  it('refuses a zero committed share instead of building an invalid payout', () => {
    const zero = factory(PARTICIPANTS as never, { alice: 200n, bob: 0n });
    expect(() => factoryDistributionPayouts(zero)).toThrow(/zero committed share/);
    expect(() => buildFactoryDistribution(zero, { fundingCoinId: '0x' + 'bb'.repeat(32) })).toThrow(/zero committed share/);
  });

  it('rejects allocations that do not add up to the factory total', () => {
    const broken = factory(PARTICIPANTS as never, { alice: 70n, bob: 30n });
    (broken as unknown as { totalValue: bigint }).totalValue = 200n;
    expect(() => factoryDistributionPayouts(broken)).toThrow(/do not equal the factory total/);
  });
});


describe('OMN-058 funded covenant default', () => {
  it('funds new factories with the output-enforced distribution branch', async () => {
    const plan = await buildFactoryOpening(PARTICIPANTS as never, '0x00', 0);
    expect(plan.factory.fundingScript).toContain('IF @TOTIN EQ 1 THEN');
    expect(plan.factory.fundingScript).toContain('VERIFYOUT(');
    expect(plan.factory.fundingScript).toMatch(/SIGNEDBY\([^)]*\) OR SIGNEDBY/);
  });

  it('allows opting out to the per-party covenant', async () => {
    const plan = await buildFactoryOpening(PARTICIPANTS as never, '0x00', 0, undefined, undefined, {
      settlement: 'per-party',
    });
    expect(plan.factory.fundingScript).not.toContain('IF @TOTIN EQ 1 THEN');
  });
});
