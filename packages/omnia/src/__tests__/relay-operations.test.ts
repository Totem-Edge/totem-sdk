/**
 * Local Omnia channel operations ported from omnia-host (RFC-014 §6.3),
 * backed by injected wallet signing material.
 */

jest.mock('../channel.js', () => ({
  createChannel: jest.fn(),
  updateState: jest.fn(),
}));
jest.mock('../settlement.js', () => ({
  proposeSettlement: jest.fn(),
  markChannelClosing: jest.fn((c: unknown) => ({ ...(c as object), status: 'closing_mutual' })),
  markChannelClosed: jest.fn((c: unknown) => ({ ...(c as object), status: 'closed' })),
}));

import { createChannel, updateState } from '../channel.js';
import { proposeSettlement, markChannelClosed } from '../settlement.js';
import { createRelayOmniaOperations } from '../relay-client.js';
import type { OmniaSwarm, OmniaPeer } from '../messaging-types.js';
import type { OmniaChannel } from '../types.js';

const createChannelMock = createChannel as jest.Mock;
const updateStateMock = updateState as jest.Mock;
const proposeSettlementMock = proposeSettlement as jest.Mock;
const markChannelClosedMock = markChannelClosed as jest.Mock;

const localParticipant = { partyId: 'p1', publicKeyDigest: 'aa', addressIndex: 0 };
const signer = { publicKeyDigest: 'aa', sign: jest.fn() };
const leaseProvider = { reserveKeyUse: jest.fn(), releaseReservation: jest.fn() };
const chainProvider = { broadcastTxPoW: jest.fn(), getCoins: jest.fn() } as never;

function fakeSwarm() {
  const peer = { sendMessage: jest.fn(async () => {}) } as unknown as OmniaPeer;
  const swarm: OmniaSwarm = {
    advertise: jest.fn(),
    connectToPeer: jest.fn(async () => peer),
    listenForChannels: jest.fn(() => () => {}),
    broadcast: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { swarm, peer };
}

function channel(overrides: Partial<OmniaChannel> = {}): OmniaChannel {
  return {
    channelId: 'c1',
    status: 'active',
    tokenId: '0x00',
    totalValue: 20n,
    currentSequence: 1,
    parties: [
      { partyId: 'p1', publicKeyDigest: 'aa', addressIndex: 0 },
      { partyId: 'p2', publicKeyDigest: 'bb', addressIndex: 0 },
    ],
    balances: { p1: 10n, p2: 10n },
    pendingHTLCs: [],
    ...overrides,
  } as unknown as OmniaChannel;
}

function ops(channels = new Map<string, OmniaChannel>()) {
  const { swarm, peer } = fakeSwarm();
  const operations = createRelayOmniaOperations({
    swarm,
    channels,
    localParticipant,
    signer: signer as never,
    leaseProvider: leaseProvider as never,
    chainProvider,
  });
  return { operations, swarm, peer, channels };
}

beforeEach(() => jest.clearAllMocks());

describe('RelayOmniaOperations', () => {
  it('openChannel creates the channel, stores it and sends a CHANNEL_PROPOSAL', async () => {
    createChannelMock.mockResolvedValue({
      channel: { channelId: 'c1', fundingTxId: 'f1' },
      proposal: { channelId: 'c1' },
    });
    const { operations, peer, channels } = ops();

    const result = (await operations.openChannel!({
      remotePartyId: 'p2',
      remotePublicKeyDigest: 'bb',
      localAmount: '10',
      remoteAmount: '10',
      fundingCoinId: '0xabc',
      fundingWitnessHex: '0xdead',
    })) as { success: boolean; channelId: string };

    expect(createChannelMock).toHaveBeenCalledTimes(1);
    expect(channels.get('c1')).toBeDefined();
    expect(peer.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CHANNEL_PROPOSAL', channelId: 'c1' }),
    );
    expect(result).toMatchObject({ success: true, channelId: 'c1' });
  });

  it('pay moves balance, persists the update and sends a STATE_UPDATE', async () => {
    const channels = new Map([['c1', channel()]]);
    updateStateMock.mockResolvedValue({
      channel: channel({ currentSequence: 2, balances: { p1: 5n, p2: 15n } }),
      signedState: { sequence: 2 },
    });
    const { operations, peer } = ops(channels);

    const result = (await operations.pay!({ channelId: 'c1', amount: '5' })) as { sequence: number };

    expect(updateStateMock).toHaveBeenCalledTimes(1);
    expect(peer.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'STATE_UPDATE', channelId: 'c1' }),
    );
    expect(result.sequence).toBe(2);
  });

  it('pay rejects an amount above the local balance', async () => {
    const { operations } = ops(new Map([['c1', channel()]]));
    await expect(operations.pay!({ channelId: 'c1', amount: '999' })).rejects.toThrow(/Insufficient/);
    expect(updateStateMock).not.toHaveBeenCalled();
  });

  it('settle proposes a mutual settlement and marks the channel closed', async () => {
    const channels = new Map([['c1', channel()]]);
    proposeSettlementMock.mockResolvedValue({
      settlementPayload: { txpowId: 't1', balances: { p1: 5n, p2: 15n } },
      partialState: {},
    });
    const { operations } = ops(channels);

    const result = (await operations.settle!({ channelId: 'c1' })) as { settlementTxId: string };

    expect(proposeSettlementMock).toHaveBeenCalledTimes(1);
    expect(markChannelClosedMock).toHaveBeenCalled();
    expect(channels.get('c1')?.status).toBe('closed');
    expect(result.settlementTxId).toBe('t1');
  });

  it('closeChannel marks the channel closed', async () => {
    const channels = new Map([['c1', channel()]]);
    const { operations } = ops(channels);
    const result = (await operations.closeChannel!({ channelId: 'c1' })) as { success: boolean };
    expect(result.success).toBe(true);
    expect(channels.get('c1')?.status).toBe('closed');
  });

  it('throws on an unknown channel', async () => {
    const { operations } = ops();
    await expect(operations.pay!({ channelId: 'missing', amount: '1' })).rejects.toThrow(/not found/);
    await expect(operations.settle!({ channelId: 'missing' })).rejects.toThrow(/not found/);
  });
});
