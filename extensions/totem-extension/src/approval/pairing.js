// Totem — RFC-062 node pairing page (manual paste MVP).

const $ = (id) => document.getElementById(id);
const endpointEl = $('endpoint');
const codeEl = $('code');
const card = $('card');
const confirmBtn = $('confirm');
const statusEl = $('status');

let invitation = null;
let nodeInfo = null;

function setStatus(text, ok = false) {
  statusEl.textContent = text;
  statusEl.className = ok ? 'ok' : '';
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function originPattern(url) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

async function requestHostPermission(endpoint) {
  try {
    const pattern = originPattern(endpoint);
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) throw new Error('Node host permission was not granted');
  } catch (error) {
    // Older builds / dev pages may not expose optional permissions.
    console.warn('[pair] permission request:', error);
  }
}

async function reviewNode(endpoint, code) {
  if (!endpoint || !code) {
    setStatus('Enter both the node endpoint and the pairing code.');
    return;
  }
  try {
    await requestHostPermission(endpoint);
    setStatus('Checking node…');
    const response = await fetch(`${endpoint}/pair/v1/info?code=${encodeURIComponent(code)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `Node returned ${response.status}`);
    nodeInfo = body;
    invitation = { endpoint, code };
    $('node-id').textContent = body.nodeId;
    $('fingerprint').textContent = body.fingerprint;
    $('network').textContent = body.network;
    $('scopes').textContent = (body.scopes || []).join(', ');
    $('hub-url').textContent = body.capabilities?.p2p?.hubUrl || 'not advertised';
    card.style.display = 'block';
    confirmBtn.style.display = 'block';
    setStatus('Review the fingerprint, then confirm.');
  } catch (error) {
    card.style.display = 'none';
    confirmBtn.style.display = 'none';
    setStatus(error instanceof Error ? error.message : String(error));
  }
}

$('lookup').addEventListener('click', () => {
  reviewNode(endpointEl.value.trim().replace(/\/$/, ''), codeEl.value.trim());
});

async function detectHawk() {
  setStatus('Searching for a local Hawk node…');
  card.style.display = 'none';
  confirmBtn.style.display = 'none';
  const candidates = ['http://127.0.0.1:7789', 'http://localhost:7789'];
  for (const base of candidates) {
    try {
      const health = await fetch(`${base}/healthz`, { cache: 'no-store' });
      if (!health.ok) continue;
      const payload = await health.json().catch(() => null);
      if (!payload || payload.ok !== true) continue;
      const response = await fetch(`${base}/pair/v1/detect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        cache: 'no-store',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.code) continue;
      endpointEl.value = base;
      codeEl.value = body.code;
      await reviewNode(base, body.code);
      setStatus(`Hawk detected at ${base}. Review the fingerprint, then confirm.`);
      return;
    } catch {
      // Try the next loopback candidate.
    }
  }
  setStatus('No local Hawk pairing service found on 127.0.0.1:7789. Start the node pair service first.');
}

$('detect').addEventListener('click', detectHawk);

(async () => {
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;
  const stored = await chrome.storage.local.get('hawk_pairing_invitation');
  const found = stored?.hawk_pairing_invitation;
  if (found?.endpoint && found?.code) {
    await chrome.storage.local.remove('hawk_pairing_invitation');
    endpointEl.value = found.endpoint;
    codeEl.value = found.code;
    await reviewNode(found.endpoint, found.code);
  } else if (new URLSearchParams(location.search).has('detected')) {
    await detectHawk();
  }
})();

confirmBtn.addEventListener('click', async () => {
  if (!invitation || !nodeInfo) return;
  try {
    confirmBtn.disabled = true;
    setStatus('Pairing…');
    const devicePublicKey = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const response = await fetch(`${invitation.endpoint}/pair/v1/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: invitation.code,
        devicePublicKey,
        origin: new URL(chrome.runtime.getURL('')).origin,
        scopes: nodeInfo.scopes,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Node returned ${response.status}`);

    const capabilities = result.capabilities || {};
    const pairing = {
      endpoint: invitation.endpoint,
      nodeId: result.node.nodeId,
      fingerprint: result.node.fingerprint,
      network: result.node.network,
      scopes: nodeInfo.scopes,
      capabilities,
      hubUrl: capabilities.p2p?.hubUrl,
      hubToken: capabilities.p2p?.token,
      clientId: result.clientId,
      pairedAt: Date.now(),
    };
    await chrome.storage.local.set({
      self_hosted_pairing: pairing,
      ...(capabilities.chain?.rpcUrl ? {
        wallet_network_config: {
          chain: { mode: 'minima-rpc', minimaRpcUrl: capabilities.chain.rpcUrl },
          lease: { mode: 'local' },
        },
        self_hosted_node_consent: capabilities.chain.rpcUrl,
      } : {}),
      ...(capabilities.p2p?.hubUrl ? {
        p2p_hub_config: {
          hubUrl: capabilities.p2p.hubUrl,
          ...(capabilities.p2p.token ? { token: capabilities.p2p.token } : {}),
          scopes: capabilities.p2p.scopes,
        },
      } : {}),
    });
    setStatus('Paired. Node fingerprint pinned and P2P hub saved.', true);
    confirmBtn.style.display = 'none';
  } catch (error) {
    confirmBtn.disabled = false;
    setStatus(error instanceof Error ? error.message : String(error));
  }
});
