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

$('lookup').addEventListener('click', async () => {
  const endpoint = endpointEl.value.trim().replace(/\/$/, '');
  const code = codeEl.value.trim();
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
});

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
