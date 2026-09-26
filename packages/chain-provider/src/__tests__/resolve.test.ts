import { HostedProvider } from '../providers/hosted.js';
import {
  resolveChainProvider,
  parseMinimaRpcUrl,
  assertConsentedNodeUrl,
  isSelfHosted,
} from '../resolve.js';
import type { ChainStateProvider } from '../types.js';

const hosted = { baseUrl: 'https://api.axia.to', apiKey: 'totem-shared' };

describe('parseMinimaRpcUrl / assertConsentedNodeUrl', () => {
  it('parses http(loopback) and https URLs into minima-rpc config', () => {
    expect(parseMinimaRpcUrl('http://127.0.0.1:9005')).toEqual({ host: '127.0.0.1', port: 9005, ssl: false });
    expect(parseMinimaRpcUrl('https://node.example.com')).toEqual({ host: 'node.example.com', port: 443, ssl: true });
    expect(() => parseMinimaRpcUrl('ftp://x')).toThrow(/http/);
  });

  it('requires HTTPS for remote hosts and permits http only on loopback', () => {
    expect(() => assertConsentedNodeUrl('https://node.example.com:9005')).not.toThrow();
    expect(() => assertConsentedNodeUrl('http://localhost:9005')).not.toThrow();
    expect(() => assertConsentedNodeUrl('http://127.0.0.1:9005')).not.toThrow();
    expect(() => assertConsentedNodeUrl('http://[::1]:9005')).not.toThrow();
    expect(() => assertConsentedNodeUrl('http://node.example.com:9005')).toThrow(/HTTPS/);
  });
});

describe('resolveChainProvider', () => {
  it('defaults to the hosted relay in axia mode', () => {
    const provider = resolveChainProvider({ mode: 'axia' }, { hosted });
    expect(provider).toBeInstanceOf(HostedProvider);
    expect(isSelfHosted({ mode: 'axia' })).toBe(false);
  });

  it('requires a URL for self-hosted modes', () => {
    expect(() => resolveChainProvider({ mode: 'minima-rpc' }, { hosted })).toThrow(/requires minimaRpcUrl/);
  });

  it('rejects a plaintext remote node URL', () => {
    expect(() =>
      resolveChainProvider({ mode: 'minima-rpc', minimaRpcUrl: 'http://evil.example.com:9005' }, { hosted }),
    ).toThrow(/HTTPS/);
  });

  it('resolves a node provider in minima-rpc mode', () => {
    const node = { id: 'node' } as unknown as ChainStateProvider;
    const provider = resolveChainProvider(
      { mode: 'minima-rpc', minimaRpcUrl: 'https://node.example.com' },
      { hosted, createMinimaProvider: () => node },
    );
    expect(provider).toBe(node);
  });

  it('composite prefers the node and falls back to the relay on error', async () => {
    const failing = {
      getTip: async () => { throw new Error('node down'); },
    } as unknown as ChainStateProvider;
    const relay = {
      getTip: async () => ({ block: 42 }),
    } as unknown as ChainStateProvider;

    const provider = resolveChainProvider(
      { mode: 'composite', minimaRpcUrl: 'https://node.example.com' },
      { hosted, hostedProvider: relay, createMinimaProvider: () => failing },
    );
    await expect(provider.getTip()).resolves.toEqual({ block: 42 });
    expect(isSelfHosted({ mode: 'composite' })).toBe(true);
  });

  it('composite with fallbackToAxia:false uses the node only', () => {
    const node = { id: 'node' } as unknown as ChainStateProvider;
    const provider = resolveChainProvider(
      { mode: 'composite', minimaRpcUrl: 'https://node.example.com', fallbackToAxia: false },
      { hosted, createMinimaProvider: () => node },
    );
    expect(provider).toBe(node);
  });
});
