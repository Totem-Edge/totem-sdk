import { test, expect } from './fixtures';

test.describe('RFC-062 Pair Node page', () => {
  test('pins the fingerprint and stores the pairing capability map', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.addInitScript(() => {
      // Headless tests cannot interact with the Chrome permission bubble.
      (chrome as any).permissions.request = async () => true;
    });

    const info = {
      nodeId: 'node-test',
      fingerprint: 'fp-test-1234',
      network: 'minima',
      scopes: ['chain.read', 'chain.submit', 'p2p.pubsub'],
      capabilities: {
        chain: { rpcUrl: 'http://127.0.0.1:9005', network: 'minima' },
        p2p: { hubUrl: 'ws://127.0.0.1:7788', scopes: ['p2p.pubsub'] },
      },
      expiresAt: Date.now() + 60_000,
    };
    const completed = {
      token: 'pair-token',
      clientId: 'pair-client-1',
      node: { nodeId: info.nodeId, fingerprint: info.fingerprint, network: 'minima' },
      capabilities: info.capabilities,
    };

    await page.route('http://127.0.0.1:7799/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/pair/v1/info')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(info) });
      if (url.includes('/pair/v1/complete')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(completed) });
      return route.fulfill({ status: 404, body: '{}' });
    });

    await page.goto(`chrome-extension://${extensionId}/approval/pairing.html`);
    await page.locator('#endpoint').fill('http://127.0.0.1:7799');
    await page.locator('#code').fill('one-time-code');
    await page.getByRole('button', { name: /REVIEW NODE/i }).click();

    await expect(page.locator('#fingerprint')).toHaveText(info.fingerprint);
    await expect(page.locator('#hub-url')).toHaveText(info.capabilities.p2p.hubUrl);
    await page.getByRole('button', { name: /PAIR AND SAVE/i }).click();
    await expect(page.locator('#status')).toContainText(/Paired/i);

    const stored = await page.evaluate(async () => {
      return await chrome.storage.local.get(['self_hosted_pairing', 'p2p_hub_config', 'wallet_network_config']);
    });
    expect(stored.self_hosted_pairing).toMatchObject({
      nodeId: info.nodeId,
      fingerprint: info.fingerprint,
      hubUrl: info.capabilities.p2p.hubUrl,
    });
    expect(stored.p2p_hub_config).toMatchObject({ hubUrl: info.capabilities.p2p.hubUrl });
    expect(stored.wallet_network_config).toMatchObject({
      chain: { mode: 'minima-rpc', minimaRpcUrl: 'http://127.0.0.1:9005' },
    });

    await page.close();
  });

  test('detects a local Hawk node and starts the review flow', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.addInitScript(() => {
      (chrome as any).permissions.request = async () => true;
    });

    const info = {
      nodeId: 'hawk-node-1',
      fingerprint: 'hawk-fp-1',
      network: 'minima',
      scopes: ['chain.read', 'chain.submit', 'p2p.pubsub'],
      capabilities: { chain: { rpcUrl: 'http://127.0.0.1:9005', network: 'minima' } },
      expiresAt: Date.now() + 60_000,
    };
    const invitation = { ...info, endpoint: 'http://127.0.0.1:7789', code: 'detected-code' };

    await page.route('http://127.0.0.1:7789/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/healthz')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      if (url.endsWith('/pair/v1/detect')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(invitation) });
      if (url.includes('/pair/v1/info')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(info) });
      return route.fulfill({ status: 404, body: '{}' });
    });

    await page.goto(`chrome-extension://${extensionId}/approval/pairing.html`);
    await page.getByRole('button', { name: /DETECT HAWK/i }).click();

    await expect(page.locator('#endpoint')).toHaveValue('http://127.0.0.1:7789');
    await expect(page.locator('#code')).toHaveValue('detected-code');
    await expect(page.locator('#fingerprint')).toHaveText(info.fingerprint);
    await expect(page.locator('#status')).toContainText(/Hawk detected/i);
    await page.close();
  });
});
