/**
 * RFC-062 — local node/extension pairing MVP.
 *
 * A loopback HTTP service issues one-time pairing codes, verifies the extension
 * origin, binds a device key and returns a scoped bearer token plus the node
 * identity/fingerprint and advertised capabilities (chain RPC, P2P hub, lease).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

export interface PairingCapabilities {
  chain?: { rpcUrl: string; network: string; genesisHash?: string };
  lease?: { modes: Array<'local' | 'hybrid'>; onchainWatermarkUrl?: string };
  omnia?: { relayUrl?: string; hostControlUrl?: string; transportPubkey?: string };
  p2p?: { hubUrl: string; token?: string; scopes: Array<'p2p.pubsub'>; topicPrefixes?: string[] };
}

interface StoredIdentity {
  publicKey: string;
  privateKey: string;
  createdAt: number;
}

export interface LinkedClient {
  clientId: string;
  origin: string;
  devicePublicKey: string;
  scopes: string[];
  tokenHash: string;
  createdAt: number;
  lastUsedAt: number;
  revokedAt?: number;
}

interface StoreFile {
  identity: StoredIdentity;
  clients: Record<string, LinkedClient>;
}

export interface PairingInvitation {
  endpoint: string;
  code: string;
  nodeId: string;
  fingerprint: string;
  network: string;
  scopes: string[];
  capabilities: PairingCapabilities;
  expiresAt: number;
}

export interface PairingServiceOptions {
  storePath: string;
  endpoint?: string;
  network?: string;
  ttlMs?: number;
  allowedOrigins?: string[];
  scopes?: string[];
  capabilities?: PairingCapabilities;
  now?: () => number;
}

export interface PairingService {
  readonly nodeId: string;
  readonly fingerprint: string;
  readonly network: string;
  readonly scopes: string[];
  readonly capabilities: PairingCapabilities;
  createInvitation(): PairingInvitation;
  info(code: string): Omit<PairingInvitation, 'code' | 'endpoint'>;
  complete(input: {
    code: string;
    devicePublicKey: string;
    origin: string;
    scopes?: string[];
  }): { token: string; clientId: string; node: { nodeId: string; fingerprint: string; network: string }; capabilities: PairingCapabilities };
  identity(): { nodeId: string; fingerprint: string; publicKey: string; network: string; capabilities: PairingCapabilities };
  listClients(): LinkedClient[];
  revoke(clientId: string): boolean;
  allowsOrigin(origin?: string): boolean;
}

interface Session {
  hash: string;
  expiresAt: number;
  attempts: number;
}

function sha256(value: string | Uint8Array): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function loadStore(storePath: string): StoreFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as StoreFile;
    if (parsed.identity?.publicKey && parsed.identity?.privateKey) {
      return { identity: parsed.identity, clients: parsed.clients ?? {} };
    }
  } catch {
    // Create a new identity below.
  }
  const pair = crypto.generateKeyPairSync('ed25519');
  const identity: StoredIdentity = {
    publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    createdAt: Date.now(),
  };
  const store: StoreFile = { identity, clients: {} };
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), { mode: 0o600 });
  return store;
}

export function createPairingService(options: PairingServiceOptions): PairingService {
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  const endpoint = options.endpoint ?? 'http://127.0.0.1:7789';
  const network = options.network ?? 'minima';
  const scopes = options.scopes ?? ['chain.read', 'chain.submit', 'p2p.pubsub'];
  const capabilities = options.capabilities ?? {};
  const store = loadStore(options.storePath);
  const sessions = new Map<string, Session>();
  const publicKeyBytes = Buffer.from(store.identity.publicKey, 'base64');
  const fingerprint = sha256(publicKeyBytes);
  const nodeId = fingerprint.slice(0, 16);

  const persist = (): void => {
    fs.mkdirSync(path.dirname(options.storePath), { recursive: true });
    fs.writeFileSync(options.storePath, JSON.stringify(store, null, 2), { mode: 0o600 });
  };

  const allowsOrigin = (origin?: string): boolean => {
    if (!origin) return true;
    if (!options.allowedOrigins || options.allowedOrigins.length === 0) return true;
    return options.allowedOrigins.includes(origin);
  };

  const baseInfo = () => ({
    nodeId,
    fingerprint,
    network,
    scopes,
    capabilities,
  });

  return {
    nodeId,
    fingerprint,
    network,
    scopes,
    capabilities,

    createInvitation() {
      const code = crypto.randomBytes(18).toString('base64url');
      const hash = sha256(code);
      const expiresAt = now() + ttlMs;
      sessions.set(hash, { hash, expiresAt, attempts: 0 });
      // Opportunistic cleanup; expired sessions cannot be completed.
      for (const [key, session] of sessions) {
        if (session.expiresAt <= now()) sessions.delete(key);
      }
      return { endpoint, code, ...baseInfo(), expiresAt };
    },

    info(code) {
      const session = sessions.get(sha256(code));
      if (!session || session.expiresAt <= now()) throw new Error('Invalid or expired pairing code');
      return { ...baseInfo(), expiresAt: session.expiresAt };
    },

    complete({ code, devicePublicKey, origin, scopes: requested }) {
      const hash = sha256(code);
      const session = sessions.get(hash);
      if (!session || session.expiresAt <= now()) throw new Error('Invalid or expired pairing code');
      if (!allowsOrigin(origin)) throw new Error('Origin not allowed for pairing');
      const granted = requested ?? scopes;
      if (granted.some((scope) => !scopes.includes(scope))) throw new Error('Requested scope is not offered');
      const token = crypto.randomBytes(32).toString('base64url');
      const clientId = `pair-${crypto.randomBytes(8).toString('hex')}`;
      store.clients[clientId] = {
        clientId,
        origin,
        devicePublicKey,
        scopes: granted,
        tokenHash: sha256(token),
        createdAt: now(),
        lastUsedAt: now(),
      };
      persist();
      sessions.delete(hash);
      return {
        token,
        clientId,
        node: { nodeId, fingerprint, network },
        capabilities,
      };
    },

    identity() {
      return {
        nodeId,
        fingerprint,
        publicKey: store.identity.publicKey,
        network,
        capabilities,
      };
    },

    listClients() {
      return Object.values(store.clients);
    },

    revoke(clientId) {
      const client = store.clients[clientId];
      if (!client) return false;
      client.revokedAt = now();
      persist();
      return true;
    },

    allowsOrigin,
  };
}

export interface PairingHttpServerOptions {
  host?: string;
  port: number;
  maxBodyBytes?: number;
}

export interface PairingHttpServer {
  listen(): Promise<{ host: string; port: number }>;
  close(): Promise<void>;
  readonly address?: AddressInfo;
}

export function createPairingHttpServer(
  service: PairingService,
  options: PairingHttpServerOptions,
): PairingHttpServer {
  const maxBodyBytes = options.maxBodyBytes ?? 16 * 1024;
  const server = http.createServer(async (req, res) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const cors = (): void => {
      if (origin && service.allowsOrigin(origin)) {
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'Origin');
      }
      res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
      res.setHeader('access-control-allow-headers', 'content-type');
    };
    cors();
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    const send = (status: number, body: unknown): void => {
      const payload = JSON.stringify(body);
      res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
      res.end(payload);
    };
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/healthz') return send(200, { ok: true });
      if (req.method === 'GET' && url.pathname === '/node/v1/identity') return send(200, service.identity());
      if (req.method === 'GET' && url.pathname === '/pair/v1/info') {
        const code = url.searchParams.get('code');
        if (!code) return send(400, { error: 'code is required' });
        if (origin && !service.allowsOrigin(origin)) return send(403, { error: 'Origin not allowed' });
        return send(200, service.info(code));
      }
      if (req.method === 'POST' && url.pathname === '/pair/v1/complete') {
        const body = await readBody(req, maxBodyBytes);
        const parsed = JSON.parse(body) as {
          code?: string;
          devicePublicKey?: string;
          origin?: string;
          scopes?: string[];
        };
        if (!parsed.code || !parsed.devicePublicKey) return send(400, { error: 'code and devicePublicKey are required' });
        return send(200, service.complete({
          code: parsed.code,
          devicePublicKey: parsed.devicePublicKey,
          origin: parsed.origin ?? origin ?? '',
          scopes: parsed.scopes,
        }));
      }
      send(404, { error: 'Not found' });
    } catch (error) {
      send(400, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  let address: AddressInfo | undefined;
  return {
    get address() { return address; },
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port, options.host ?? '127.0.0.1', () => {
        server.off('error', reject);
        address = server.address() as AddressInfo;
        resolve({ host: address.address, port: address.port });
      });
    }),
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

async function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limit) throw new Error('Request body too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
