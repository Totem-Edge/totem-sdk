/**
 * RFC-058 P1 — host prepareOpenChannel / submitOpenChannel wallet funding.
 */

import os from 'node:os';
import { signRequestPayload } from '@totemsdk/omnia';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

const HEX_SEED = '0x' + 'ab'.repeat(32);
const dbPath = `${os.tmpdir()}/omnia-prepare-open-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const hex = (u8: Uint8Array) => '0x' + Buffer.from(u8).toString('hex');

describe('omnia prepareOpenChannel / submitOpenChannel', () => {
  it('prepares the funding digest, verifies the wallet signature and broadcasts', async () => {
    const config = loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: dbPath });
    const signing = createHostSigning(config);
    const getCoin = jest.fn(async () => ({
      coinid: '0x' + 'cc'.repeat(32),
      amount: '1000',
      address: '0x' + 'dd'.repeat(32),
      tokenid: '0x00',
      spent: false,
    }));
    const submitTransaction = jest.fn(async () => ({ success: true, txpowid: 'tx-funding' }));
    const chainProvider = {
      getCoin,
      getToken: jest.fn(async () => ({ script: 'RETURN TRUE' })),
      submitTransaction,
    };
    const context = {
      channels: new Map(),
      preparedOpen: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      signer: signing.signer,
      leaseProvider: signing.leaseProvider,
      chainProvider,
      localParticipant: {
        partyId: 'alice',
        publicKeyDigest: signing.publicKeyDigest,
        addressIndex: 0,
        settlementAddress: '0x' + '44'.repeat(32),
      },
      custodyMode: 'self',
    } as unknown as HostApiContext;

    const methods = createHostMethods(context);
    const prepared = await methods.get('omnia/prepareOpenChannel')!({
      operationId: 'prep-open-1',
      remotePartyId: 'bob',
      remotePublicKeyDigest: '0x' + 'bb'.repeat(32),
      remoteAddressIndex: 1,
      remoteSettlementAddress: '0x' + '55'.repeat(32),
      localAmount: '600',
      remoteAmount: '400',
      fundingCoinId: '0x' + 'cc'.repeat(32),
    });

    expect(prepared).toMatchObject({ success: true, status: 'signature-required' });
    const requests = (prepared as any).requests;
    const indices = { addressIndex: 0, l1: 0, l2: 0 };
    const intentSignature = await signing.signer.sign(signRequestPayload(requests.intent), indices);
    const fundingSignature = await signing.signer.sign(requests.funding.digest, indices);

    const submitted = await methods.get('omnia/submitOpenChannel')!({
      operationId: 'submit-open-1',
      preparedOperationId: 'prep-open-1',
      intentSignature: hex(intentSignature),
      fundingSignature: hex(fundingSignature),
      fundingCoinProofsHex: ['0x01'],
      fundingScriptProofsHex: ['0x02'],
    });

    expect(submitted).toMatchObject({
      success: true,
      fundingTxId: 'tx-funding',
      acknowledged: true,
    });
    const channel = context.channels.get((submitted as any).channelId)!;
    expect(channel.status).toBe('active');
    expect(channel.fundingTxId).toBe('tx-funding');
    expect(channel.balances).toEqual({ alice: 600n, bob: 400n });
    expect(submitTransaction).toHaveBeenCalledTimes(1);
  });
});
