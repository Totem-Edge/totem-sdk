import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SyncSqliteStore } from '@totemsdk/storage/sqlite-sync';
import { SqliteChannelStore } from '../stores/sqlite-store.js';
import { OperationStore } from '../stores/operations.js';
import { serializeChannelSnapshot, type OmniaChannel } from '@totemsdk/omnia';

function sqliteAvailable(): boolean {
  try {
    const store = new SqliteChannelStore(':memory:');
    store.close();
    return true;
  } catch (error) {
    if (String(error).includes('Could not locate the bindings file')) return false;
    throw error;
  }
}

const describeSqlite = sqliteAvailable() ? describe : describe.skip;

describeSqlite('SqliteChannelStore', () => {
  it('persists recoverable channel state and omits runtime signers', () => {
    const store = new SqliteChannelStore(':memory:');
    const signature = new Uint8Array([1, 2, 3, 4]);
    const channel = {
      channelId: 'channel-1',
      fundingTxId: 'tx',
      fundingCoinId: 'coin',
      fundingScript: 'script',
      programId: 'eltoo-payment',
      programVersion: 1,
      fundingAddress: 'address',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: 10n,
      parties: [
        { partyId: 'alice', publicKeyDigest: 'alice-pkd', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'bob-pkd', addressIndex: 1 },
      ],
      balances: { alice: 7n, bob: 3n },
      pendingHTLCs: [],
      currentSequence: 2,
      latestState: {
        sequence: 2,
        balances: { alice: 7n, bob: 3n },
        pendingHTLCs: [],
        stateVariables: [],
        transactionHex: '0x1234',
        signatures: { alice: signature },
        signingIndices: { alice: { addressIndex: 0, l1: 0, l2: 2 } },
      },
      stateLog: [],
      status: 'active',
      channelType: 'direct',
      localSigner: { sign: jest.fn(), publicKeyDigest: 'runtime-only' },
      createdAt: 1,
      updatedAt: 2,
    } as unknown as OmniaChannel;

    store.set(channel.channelId, channel);
    const loaded = store.get(channel.channelId)!;

    expect(loaded.totalValue).toBe(10n);
    expect(loaded.balances).toEqual({ alice: 7n, bob: 3n });
    expect(loaded.latestState?.signatures.alice).toBeInstanceOf(Uint8Array);
    expect(Array.from(loaded.latestState!.signatures.alice)).toEqual([1, 2, 3, 4]);
    expect(loaded.localSigner).toBeUndefined();
    expect(store.size).toBe(1);
    store.close();
  });

  it('rebinds the host signer on every recovered channel (CAN-002)', () => {
    const store = new SqliteChannelStore(':memory:');
    const signer = { publicKeyDigest: 'local-pkd', sign: jest.fn() } as never;
    store.setLocalSigner(signer);
    const channel = {
      channelId: 'channel-2',
      fundingTxId: 'tx',
      fundingCoinId: 'coin',
      fundingScript: 'script',
      programId: 'eltoo-payment',
      programVersion: 1,
      fundingAddress: 'address',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: 10n,
      parties: [
        { partyId: 'alice', publicKeyDigest: 'alice-pkd', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'bob-pkd', addressIndex: 1 },
      ],
      balances: { alice: 7n, bob: 3n },
      pendingHTLCs: [],
      currentSequence: 2,
      latestState: {
        sequence: 2,
        balances: { alice: 7n, bob: 3n },
        pendingHTLCs: [],
        stateVariables: [],
        transactionHex: '0x1234',
        signatures: {},
        signingIndices: {},
      },
      stateLog: [],
      status: 'active',
      channelType: 'direct',
      createdAt: 1,
      updatedAt: 2,
    } as unknown as OmniaChannel;

    store.set('channel-2', channel);
    expect(store.get('channel-2')!.localSigner).toBe(signer);
    const values = Array.from(store.values());
    expect(values[0].localSigner).toBe(signer);
    store.close();
  });
});

describeSqlite('OperationStore', () => {
  it('creates and atomically transitions operations', () => {
    const store = new OperationStore(':memory:');
    const created = store.create('op-1', { amount: '10' }, 100);
    expect(created.status).toBe('pending');

    const executing = store.transition('op-1', 'pending', 'executing', {}, 200);
    expect(executing.status).toBe('executing');

    const committed = store.transition('op-1', 'executing', 'committed', { result: { ok: true } }, 300);
    expect(committed.result).toEqual({ ok: true });
    expect(() => store.transition('op-1', 'pending', 'failed')).toThrow('expected status pending');
    store.close();
  });

  it('journals bigint-bearing requests/results without throwing (CAN-001)', () => {
    const store = new OperationStore(':memory:');
    const request = { route: { hops: [{ amount: 5000n, channelId: 'c-1' }] } };
    const created = store.create('op-big', request, 100);
    expect(created.request).toEqual(request);
    expect(store.verifyRequest('op-big', request)).toBe(true);
    expect(store.verifyRequest('op-big', { route: { hops: [{ amount: 6000n }] } })).toBe(false);

    const committed = store.transition('op-big', 'pending', 'committed', { result: { paid: 5000n } });
    expect(committed.result).toEqual({ paid: 5000n });
    store.close();
  });
});


function makeChannel(id: string): OmniaChannel {
  return {
    channelId: id,
    fundingTxId: 'tx',
    fundingCoinId: 'coin',
    fundingScript: 'script',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: 'address',
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 10n,
    parties: [
      { partyId: 'alice', publicKeyDigest: 'alice-pkd', addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: 'bob-pkd', addressIndex: 1 },
    ],
    balances: { alice: 7n, bob: 3n },
    pendingHTLCs: [],
    currentSequence: 2,
    latestState: {
      sequence: 2,
      balances: { alice: 7n, bob: 3n },
      pendingHTLCs: [],
      stateVariables: [],
      transactionHex: '0x1234',
      signatures: {},
      signingIndices: {},
    },
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1,
    updatedAt: 2,
  } as unknown as OmniaChannel;
}

describeSqlite('storage-backed persistence (RFC-007 §4.2 / Phase 4 gate)', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-store-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reopens channel state and the operation journal from disk', () => {
    const file = path.join(dir, 'omnia.sqlite');

    const channels = new SqliteChannelStore(file);
    channels.set('ch-reopen', makeChannel('ch-reopen'));
    channels.close();
    const reopenedChannels = new SqliteChannelStore(file);
    expect(reopenedChannels.get('ch-reopen')!.balances).toEqual({ alice: 7n, bob: 3n });
    reopenedChannels.close();

    const ops = new OperationStore(file);
    ops.create('op-reopen', { amount: 5n }, 10);
    ops.transition('op-reopen', 'pending', 'committed', { result: { ok: true } }, 20);
    ops.close();
    const reopenedOps = new OperationStore(file);
    expect(reopenedOps.get('op-reopen')!.status).toBe('committed');
    expect(reopenedOps.get('op-reopen')!.result).toEqual({ ok: true });
    reopenedOps.close();
  });

  it('migrates legacy omnia_channels and drops the table', () => {
    const file = path.join(dir, 'channels.sqlite');
    const legacy = new SyncSqliteStore(file);
    legacy.exec(
      'CREATE TABLE omnia_channels (channel_id TEXT PRIMARY KEY, channel_json TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    );
    const json = serializeChannelSnapshot(makeChannel('ch-legacy')).replace(/'/g, "''");
    legacy.exec(
      `INSERT INTO omnia_channels (channel_id, channel_json, updated_at) VALUES ('ch-legacy', '${json}', 1)`,
    );
    legacy.close();

    const store = new SqliteChannelStore(file);
    expect(store.get('ch-legacy')!.channelId).toBe('ch-legacy');
    expect(store.size).toBe(1);
    store.close();

    const check = new SyncSqliteStore(file);
    expect(check.tableExists('omnia_channels')).toBe(false);
    check.close();
  });

  it('migrates legacy omnia_operations with bigint JSON', () => {
    const file = path.join(dir, 'ops.sqlite');
    const legacy = new SyncSqliteStore(file);
    legacy.exec(
      'CREATE TABLE omnia_operations (operation_id TEXT PRIMARY KEY, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, request_json TEXT, request_digest TEXT, result_json TEXT, error TEXT)',
    );
    legacy.exec(
      `INSERT INTO omnia_operations (operation_id,status,created_at,updated_at,request_json,result_json) ` +
      `VALUES ('op-legacy','committed',1,2,'{"amount":{"$bigint":"5000"}}','{"paid":{"$bigint":"5000"}}')`,
    );
    legacy.close();

    const store = new OperationStore(file);
    expect(store.get('op-legacy')!.request).toEqual({ amount: 5000n });
    expect(store.get('op-legacy')!.result).toEqual({ paid: 5000n });
    store.close();
  });

  it('surfaces corruption instead of treating it as absent', () => {
    const file = path.join(dir, 'corrupt.sqlite');
    const store = new SqliteChannelStore(file);
    store.set('ch-corrupt', makeChannel('ch-corrupt'));
    store.close();

    const raw = new SyncSqliteStore(file);
    raw.exec(`UPDATE totemsdk_kv SET value = x'00' WHERE key = 'omnia:channel:ch-corrupt'`);
    raw.close();

    const reopened = new SqliteChannelStore(file);
    expect(() => reopened.get('ch-corrupt')).toThrow();
    reopened.close();
  });

  it('refuses to open an unsupported store format', () => {
    const channelFile = path.join(dir, 'format-channel.sqlite');
    const rawChannel = new SyncSqliteStore(channelFile);
    rawChannel.set('omnia:store:channel:format', 999);
    rawChannel.close();
    expect(() => new SqliteChannelStore(channelFile)).toThrow(
      'Unsupported SqliteChannelStore format 999',
    );

    const opFile = path.join(dir, 'format-op.sqlite');
    const rawOp = new SyncSqliteStore(opFile);
    rawOp.set('omnia:store:operation:format', 999);
    rawOp.close();
    expect(() => new OperationStore(opFile)).toThrow('Unsupported OperationStore format 999');
  });
});
