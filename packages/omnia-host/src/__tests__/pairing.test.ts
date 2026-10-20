import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPairingHttpServer, createPairingService } from '../pairing.js';

function tmpStore(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-pairing-')), 'pairing.json');
}

const capabilities = {
  chain: { rpcUrl: 'http://127.0.0.1:9002', network: 'minima' },
  p2p: { hubUrl: 'ws://127.0.0.1:7788', scopes: ['p2p.pubsub'] as ['p2p.pubsub'] },
};

describe('pairing service', () => {
  it('issues a one-time code, exposes fingerprint and binds a scoped client', () => {
    const service = createPairingService({
      storePath: tmpStore(),
      capabilities,
      allowedOrigins: ['chrome-extension://abc'],
    });
    const invitation = service.createInvitation();
    expect(invitation.code).toBeTruthy();
    const info = service.info(invitation.code);
    expect(info.fingerprint).toBe(service.fingerprint);
    expect(info.capabilities.p2p?.hubUrl).toBe('ws://127.0.0.1:7788');

    const result = service.complete({
      code: invitation.code,
      devicePublicKey: 'device-key-1',
      origin: 'chrome-extension://abc',
      scopes: ['chain.read', 'p2p.pubsub'],
    });
    expect(result.token).toBeTruthy();
    expect(result.clientId).toMatch(/^pair-/);
    expect(service.listClients()).toHaveLength(1);
    expect(service.listClients()[0].scopes).toEqual(['chain.read', 'p2p.pubsub']);

    expect(() => service.complete({
      code: invitation.code,
      devicePublicKey: 'device-key-1',
      origin: 'chrome-extension://abc',
    })).toThrow(/expired|Invalid/);

    expect(service.revoke(result.clientId)).toBe(true);
    expect(service.listClients()[0].revokedAt).toBeTruthy();
  });

  it('rejects disallowed origins and unoffered scopes', () => {
    const service = createPairingService({
      storePath: tmpStore(),
      allowedOrigins: ['chrome-extension://abc'],
    });
    const one = service.createInvitation();
    expect(() => service.complete({
      code: one.code,
      devicePublicKey: 'd',
      origin: 'https://evil.example',
    })).toThrow(/Origin not allowed/);

    const two = service.createInvitation();
    expect(() => service.complete({
      code: two.code,
      devicePublicKey: 'd',
      origin: 'chrome-extension://abc',
      scopes: ['sign'],
    })).toThrow(/scope/);
  });

  it('expires pairing codes', () => {
    let clock = 1000;
    const service = createPairingService({
      storePath: tmpStore(),
      ttlMs: 100,
      now: () => clock,
    });
    const invitation = service.createInvitation();
    clock += 101;
    expect(() => service.info(invitation.code)).toThrow(/expired/);
  });
});

describe('pairing HTTP server', () => {
  it('serves identity/info and completes pairing', async () => {
    const service = createPairingService({ storePath: tmpStore(), capabilities });
    const server = createPairingHttpServer(service, { host: '127.0.0.1', port: 0 });
    const address = await server.listen();
    try {
      const base = `http://127.0.0.1:${address.port}`;
      const identity = await (await fetch(`${base}/node/v1/identity`)).json() as { fingerprint: string };
      expect(identity.fingerprint).toBe(service.fingerprint);

      const invitation = service.createInvitation();
      const info = await (await fetch(`${base}/pair/v1/info?code=${encodeURIComponent(invitation.code)}`)).json() as { nodeId: string };
      expect(info.nodeId).toBe(service.nodeId);

      const completed = await (await fetch(`${base}/pair/v1/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: invitation.code,
          devicePublicKey: 'device-key',
          origin: 'chrome-extension://abc',
          scopes: ['p2p.pubsub'],
        }),
      })).json() as { token: string };
      expect(completed.token).toBeTruthy();
    } finally {
      await server.close();
    }
  });
});
