import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MemoryStore } from '@totemsdk/storage';
import { OmniaAxiaLeaseProvider } from '../omnia-axia.js';

function readBody(req: import('node:http').IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

describe('OmniaAxiaLeaseProvider over HTTP', () => {
  let server: Server;
  let baseUrl: string;
  const requests: Array<{ path: string; body: any }> = [];

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const body = await readBody(req);
      requests.push({ path: req.url ?? '', body });
      res.setHeader('content-type', 'application/json');

      if (req.url === '/v1/wots-hardened/prepare') {
        res.end(JSON.stringify({
          leaseToken: 'http-lease-token',
          leaseId: 'http-lease-id',
          addressIndex: body.addressIndex,
          l1: 12,
          l2: 34,
          leaseTTL: 5000,
        }));
        return;
      }
      if (req.url === '/v1/wots-hardened/consume') {
        res.end(JSON.stringify({ consumed: true }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'not found' }));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    requests.length = 0;
  });

  test('round-trips prepare and consume with the Omnia channel tree id', async () => {
    const lease = new OmniaAxiaLeaseProvider({
      apiUrl: baseUrl,
      apiKey: 'test-key',
      rootPublicKey: '0x' + 'ab'.repeat(32),
      addressIndex: 0,
      storage: new MemoryStore(),
    });

    const reservation = await lease.reserveKeyUse({
      treeId: 'omnia-channel-0xabc',
      payloadHash: '0x' + '11'.repeat(32),
    });
    expect(reservation.indices).toEqual({ addressIndex: 0, l1: 12, l2: 34 });
    expect(reservation.leaseToken).toBe('http-lease-token');

    await lease.commitKeyUse(reservation.reservationId, '0x' + '22'.repeat(32));

    expect(requests[0].body).toMatchObject({
      addressIndex: 0,
      rootPublicKey: '0x' + 'ab'.repeat(32),
      paramSet: 'v2-spec',
    });
    expect(requests[1].body).toEqual({
      leaseToken: 'http-lease-token',
      txHash: '0x' + '22'.repeat(32),
    });

    const watermark = await lease.getLocalWatermark('omnia-channel-0xabc');
    expect(watermark.unavailableCount).toBeGreaterThan(0);
  });
});
