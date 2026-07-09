import { buildCommandString } from '../transport';
import { createPureMinimaClient } from '../client';
import { PureMinimaRpcError } from '../types';

describe('buildCommandString', () => {
  it('status — no params', () => {
    expect(buildCommandString('status')).toBe('status');
  });

  it('balance — address only', () => {
    expect(buildCommandString('balance', { address: 'Mx123' })).toBe('balance address:Mx123');
  });

  it('balance — megammr + tokendetails (Gap 1 fix)', () => {
    expect(
      buildCommandString('balance', { address: 'Mx123', megammr: true, tokendetails: true }),
    ).toBe('balance address:Mx123 megammr:true tokendetails:true');
  });

  it('coins — megammr param (Gap 1 fix)', () => {
    expect(buildCommandString('coins', { address: 'Mx123', megammr: true })).toBe(
      'coins address:Mx123 megammr:true',
    );
  });

  it('txnpost — mine + txndelete + burn (Gap 1 fix)', () => {
    expect(
      buildCommandString('txnpost', {
        id: 'tx1',
        auto: false,
        mine: true,
        txndelete: true,
        burn: '0.001',
      }),
    ).toBe('txnpost id:tx1 auto:false mine:true txndelete:true burn:0.001');
  });

  it('txnlist — id + transactiononly (Gap 1 fix)', () => {
    expect(buildCommandString('txnlist', { id: 'tx1', transactiononly: true })).toBe(
      'txnlist id:tx1 transactiononly:true',
    );
  });

  it('txnimport — data + id (Gap 1 fix)', () => {
    expect(buildCommandString('txnimport', { data: '0xABCD', id: 'imp1' })).toBe(
      'txnimport data:0xABCD id:imp1',
    );
  });

  it('getaddress — no params (Gap 2 explicit)', () => {
    expect(buildCommandString('getaddress')).toBe('getaddress');
  });

  it('txnbasics — id (Gap 2 explicit)', () => {
    expect(buildCommandString('txnbasics', { id: 'tx1' })).toBe('txnbasics id:tx1');
  });

  it('megammr — no params (Gap 2 explicit)', () => {
    expect(buildCommandString('megammr')).toBe('megammr');
  });

  it('coinexport — coinid (Gap 2 explicit)', () => {
    expect(buildCommandString('coinexport', { coinid: '0xCOIN' })).toBe('coinexport coinid:0xCOIN');
  });

  it('verify — publickey + data + signature (Gap 2 explicit)', () => {
    expect(
      buildCommandString('verify', { publickey: 'PK', data: 'DATA', signature: 'SIG' }),
    ).toBe('verify publickey:PK data:DATA signature:SIG');
  });

  it('webhooks action:list — no URL sanitiser issue (Gap 2 fix)', () => {
    expect(buildCommandString('webhooks', { action: 'list' })).toBe('webhooks action:list');
  });

  it('webhooks action:add with URL value (Gap 2 fix)', () => {
    expect(
      buildCommandString('webhooks', {
        action: 'add',
        hook: 'https://example.com/hook',
        filter: 'NEWTXPOW',
      }),
    ).toBe('webhooks action:add hook:https://example.com/hook filter:NEWTXPOW');
  });

  it('getmmrproof — coinid', () => {
    expect(buildCommandString('getmmrproof', { coinid: '0xCOIN' })).toBe(
      'getmmrproof coinid:0xCOIN',
    );
  });

  it('getchaintip — no params', () => {
    expect(buildCommandString('getchaintip')).toBe('getchaintip');
  });

  it('passthrough — unknown command with simple params', () => {
    expect(buildCommandString('debuglogs', { level: 'verbose' })).toBe('debuglogs level:verbose');
  });

  it('passthrough — rejects command with injection chars', () => {
    expect(() => buildCommandString('bad;cmd')).toThrow(PureMinimaRpcError);
  });
});

describe('createPureMinimaClient — fetch mocking', () => {
  const config = { host: '127.0.0.1', port: 9005, password: 'testpw' };

  function mockFetch(responseData: unknown, ok = true, status = 200) {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      status,
      text: () =>
        Promise.resolve(
          JSON.stringify({ command: 'test', status: true, pending: false, response: responseData }),
        ),
    }) as unknown as typeof fetch;
  }

  afterEach(() => jest.restoreAllMocks());

  it('status() calls fetch with correct body', async () => {
    mockFetch({ version: '1.0' });
    const client = createPureMinimaClient(config);
    const result = await client.status();
    expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBe('status');
    expect((result as { version: string }).version).toBe('1.0');
  });

  it('balance() with megammr sends correct command', async () => {
    mockFetch([]);
    const client = createPureMinimaClient(config);
    await client.balance({ address: 'Mx1', megammr: true });
    expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBe(
      'balance address:Mx1 megammr:true',
    );
  });

  it('txnImport() with id sends correct command', async () => {
    mockFetch(null);
    const client = createPureMinimaClient(config);
    await client.txnImport('0xHEX', 'lease-1');
    expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBe(
      'txnimport data:0xHEX id:lease-1',
    );
  });

  it('webhooks() list does not throw on URL values', async () => {
    mockFetch([{ hook: 'https://example.com/hook', filter: 'NEWTXPOW' }]);
    const client = createPureMinimaClient(config);
    const result = await client.webhooks('list');
    expect(Array.isArray(result)).toBe(true);
  });

  it('throws PureMinimaRpcError on HTTP 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('') }) as unknown as typeof fetch;
    const client = createPureMinimaClient(config);
    await expect(client.status()).rejects.toThrow(PureMinimaRpcError);
  });

  it('throws PureMinimaRpcError when Minima status:false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ command: 'status', status: false, pending: false, error: 'node locked' })),
    }) as unknown as typeof fetch;
    const client = createPureMinimaClient(config);
    await expect(client.status()).rejects.toThrow('node locked');
  });
});
