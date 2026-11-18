/**
 * OMN-006: a preimage fulfilled on the outgoing side is a durable duty to the
 * previous hop. A crash between fulfilling the incoming HTLC and sending the
 * backward update must not clear the link; recovery retries the same nonce.
 */
import type { OmniaChannel } from '@totemsdk/omnia';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { createMultiHopForwarder, type HtlcLink, type HtlcLinkJournal } from '../forwarder';

const SELF = '0x' + '11'.repeat(32);
const PREV = '0x' + '22'.repeat(32);
const HASHLOCK = '0x' + 'aa'.repeat(32);
const IN_CHANNEL = 'channel-in';

function channel(htlcStatus: 'pending' | 'fulfilled'): OmniaChannel {
  return {
    channelId: IN_CHANNEL,
    fundingTxId: '0xtx',
    fundingCoinId: '0x' + 'bb'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + 'cc'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'relay', publicKeyDigest: SELF, addressIndex: 0 },
      { partyId: 'hop', publicKeyDigest: PREV, addressIndex: 1 },
    ],
    balances: { relay: 500n, hop: 500n },
    pendingHTLCs: [{
      htlcId: 'in-htlc',
      amount: 100n,
      hashlock: HASHLOCK,
      timeoutBlock: 100n,
      direction: 'received',
      status: htlcStatus,
      htlcAddress: '0x' + 'dd'.repeat(32),
      senderPublicKeyDigest: PREV,
      recipientPublicKeyDigest: SELF,
    }],
    currentSequence: 1,
    latestState: {
      sequence: 1,
      balances: { relay: 500n, hop: 500n },
      pendingHTLCs: [],
      stateVariables: [],
      transactionHex: '0xupdate',
      signatures: {},
      signingIndices: {},
    },
    stateLog: [],
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
  };
}

function journal(initial: HtlcLink[] = []): HtlcLinkJournal & { links: Map<string, HtlcLink> } {
  const links = new Map(initial.map((link) => [link.hashlock, link]));
  return {
    links,
    get: (hashlock: string) => links.get(hashlock),
    record: (link: HtlcLink) => { links.set(link.hashlock, link); },
    remove: (hashlock: string) => { links.delete(hashlock); },
    list: () => [...links.values()],
  };
}

function makeForwarder(
  htlcStatus: 'pending' | 'fulfilled',
  linkJournal: HtlcLinkJournal,
  sendMessage: jest.Mock,
) {
  const channels = new Map([[IN_CHANNEL, channel(htlcStatus)]]);
  return createMultiHopForwarder({
    channels,
    leaseProvider: {} as never,
    signer: {} as never,
    chainProvider: {} as ChainStateProvider,
    swarm: {
      connectToPeer: jest.fn(async () => ({ sendMessage })),
    } as never,
    linkJournal,
  });
}

const pendingLink = (): HtlcLink => ({
  hashlock: HASHLOCK,
  inChannelId: IN_CHANNEL,
  inHtlcId: 'in-htlc',
  outChannelId: 'channel-out',
  outHtlcId: 'out-htlc',
  via: PREV,
  status: 'preimage-revealed',
  preimage: '0xdeadbeef',
  backwardNonce: 1234,
});

describe('multi-hop preimage recovery (OMN-006)', () => {
  it('retries the backward preimage when the incoming HTLC is already terminal', async () => {
    const store = journal([pendingLink()]);
    const sendMessage = jest.fn(async () => {});
    const forwarder = makeForwarder('fulfilled', store, sendMessage);

    const unresolved = await forwarder.recover();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0]![0]).toMatchObject({
      type: 'STATE_UPDATE',
      channelId: IN_CHANNEL,
      nonce: 1234,
      payload: expect.objectContaining({ preimage: '0xdeadbeef' }),
    });
    expect(store.links.get(HASHLOCK)?.status).toBe('backward-sent');
    expect(unresolved.map((link) => link.hashlock)).toEqual([HASHLOCK]);
  });

  it('does not resend once the backward update is recorded as sent', async () => {
    const store = journal([{ ...pendingLink(), status: 'backward-sent' }]);
    const sendMessage = jest.fn(async () => {});
    const forwarder = makeForwarder('fulfilled', store, sendMessage);

    const unresolved = await forwarder.recover();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(store.links.has(HASHLOCK)).toBe(false);
    expect(unresolved).toEqual([]);
  });

  it('keeps the duty recoverable when the backward send fails', async () => {
    const store = journal([pendingLink()]);
    const sendMessage = jest.fn(async () => { throw new Error('peer offline'); });
    const forwarder = makeForwarder('fulfilled', store, sendMessage);

    const unresolved = await forwarder.recover();

    expect(store.links.get(HASHLOCK)?.status).toBe('preimage-revealed');
    expect(unresolved.map((link) => link.hashlock)).toEqual([HASHLOCK]);
  });

  it('clears a terminal link that never carried a preimage', async () => {
    const store = journal([{ ...pendingLink(), status: 'active', preimage: undefined }]);
    const sendMessage = jest.fn(async () => {});
    const forwarder = makeForwarder('fulfilled', store, sendMessage);

    await forwarder.recover();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(store.links.has(HASHLOCK)).toBe(false);
  });
});
