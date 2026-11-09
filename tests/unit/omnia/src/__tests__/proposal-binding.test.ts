/**
 * RFC-078 §4.3 — a channel proposal must be bound to the accepting signer and
 * the authenticated peer identity before it is accepted.
 */

import { acceptChannel } from '../channel.js';
import { buildEltooScript, scriptAddress } from '../script.js';
import type { ChannelProposal, ChannelParticipant } from '../types.js';

const pk = (fill: string) => '0x' + fill.repeat(32);
const alice: ChannelParticipant = {
  partyId: 'alice',
  publicKeyDigest: pk('11'),
  addressIndex: 0,
  transportPubkey: pk('aa'),
};
const bob: ChannelParticipant = {
  partyId: 'bob',
  publicKeyDigest: pk('22'),
  addressIndex: 1,
  transportPubkey: pk('bb'),
};

function proposal(): ChannelProposal {
  return {
    channelId: 'chan-binding',
    localParty: bob,
    remoteParty: alice,
    localAmount: 400n,
    remoteAmount: 600n,
    tokenId: '0x00',
    fundingScript: buildEltooScript([bob, alice]),
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingTxId: '0x' + 'ff'.repeat(32),
    fundingCoinId: '0x' + 'ee'.repeat(32),
  };
}

const accept = (
  options: Parameters<typeof acceptChannel>[3],
  provider?: Parameters<typeof acceptChannel>[1],
) => acceptChannel(proposal(), provider, 1, { allowShortContestDelay: true, ...options });

describe('channel proposal identity binding', () => {
  it('accepts a proposal bound to the local signer and authenticated peer', async () => {
    const channel = await accept({
      localPublicKeyDigest: bob.publicKeyDigest,
      remoteTransportPubkey: alice.transportPubkey,
    });
    expect(channel.parties.map((p) => p.partyId)).toEqual(['bob', 'alice']);
  });

  it('rejects a proposal whose local party is not this signer', async () => {
    await expect(accept({ localPublicKeyDigest: pk('33') })).rejects.toThrow(/local party/i);
  });

  it('rejects a proposal whose remote party is not the authenticated peer', async () => {
    await expect(accept({
      localPublicKeyDigest: bob.publicKeyDigest,
      remoteTransportPubkey: pk('cc'),
    })).rejects.toThrow(/authenticated peer/i);
  });

  it('accepts a funding coin whose address differs only by hex case', async () => {
    const p = proposal();
    const address = scriptAddress(p.fundingScript);
    const provider = {
      getCoin: async () => ({
        coinid: p.fundingCoinId,
        address: address.toUpperCase(),
        amount: 1000n,
        tokenid: '0x00',
        spent: false,
        created: '5',
      }),
      getTip: async () => ({ block: 10 }),
    } as unknown as Parameters<typeof acceptChannel>[1];
    const channel = await accept(undefined, provider);
    expect(channel.fundingAddress).toBe(address);
  });

  it('requires a chain provider for network acceptance', async () => {
    await expect(accept({
      localPublicKeyDigest: bob.publicKeyDigest,
      remoteTransportPubkey: alice.transportPubkey,
      requireChainProvider: true,
    })).rejects.toThrow(/chain provider/i);
  });
});
