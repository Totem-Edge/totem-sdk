// Totem — Permission approval page logic.
// Loaded as an external script (permissions-approval.js) to satisfy the
// extension's Content Security Policy, which forbids inline <script> blocks.

const INTENT_META = {
  send:              { desc: 'Initiate MINIMA token sends without asking each time', risk: 'medium' },
  token_send:        { desc: 'Initiate custom token sends without asking each time', risk: 'medium' },
  utxo_read:         { desc: 'Read your spendable coin (UTXO) list for transaction building', risk: 'low' },
  swap:              { desc: 'Initiate token swap transactions on your behalf', risk: 'high' },
  liquidity_add:     { desc: 'Add liquidity to AMM pools using your funds', risk: 'high' },
  liquidity_remove:  { desc: 'Remove liquidity from AMM pools and receive funds', risk: 'high' },
  contract_call:     { desc: 'Execute MAST smart contract calls spending your coins', risk: 'high' },
  multisig:          { desc: 'Participate in multi-party signature transactions', risk: 'high' },
  timelock:          { desc: 'Create time-locked transactions spending your coins', risk: 'high' },
  htlc:              { desc: 'Create Hash Time-Locked Contract transactions (atomic swaps)', risk: 'high' },
  custom:            { desc: 'Execute arbitrary custom transactions with your key', risk: 'high' },
  complex_send:      { desc: 'Build and send complex multi-input/output transactions', risk: 'high' },
  sign_data:         { desc: 'Produce cryptographic WOTS signatures with your private key', risk: 'high' },
  broadcast_tx:      { desc: 'Submit pre-built transactions directly to the Minima network', risk: 'high' },
};

let pendingData = null;
let currentWindowId = null;

chrome.windows.getCurrent((win) => {
  if (chrome.runtime.lastError) return;
  currentWindowId = win.id;
});

chrome.runtime.sendMessage({ method: 'permissions:getPending', id: Date.now().toString() }, (response) => {
  if (chrome.runtime.lastError) {
    document.getElementById('intent-table').textContent = 'Error loading permission request.';
    return;
  }
  if (!response || !response.result) {
    document.getElementById('intent-table').textContent = 'No pending permission request found.';
    return;
  }
  pendingData = response.result;
  render(pendingData);
});

function render(data) {
  document.getElementById('origin').textContent = data.origin;

  const expiry = data.expiresInDays || 30;
  document.getElementById('expiry').textContent = expiry + ' day' + (expiry !== 1 ? 's' : '');

  const tableEl = document.getElementById('intent-table');
  const intents = Array.isArray(data.allowedIntents) ? data.allowedIntents : [];
  if (intents.length === 0) {
    tableEl.innerHTML = '<div style="padding:12px;color:#888;font-size:11px;">No intents requested.</div>';
  } else {
    tableEl.innerHTML = intents.map(intent => {
      const meta = INTENT_META[intent] || { desc: 'Custom transaction capability', risk: 'high' };
      const riskLabel = meta.risk === 'high' ? 'HIGH' : meta.risk === 'medium' ? 'MED' : 'LOW';
      return `
          <div class="intent-row">
              <div>
                  <div class="intent-name">${escHtml(intent)}</div>
                  <div class="intent-desc">${escHtml(meta.desc)}</div>
              </div>
              <div class="risk-badge risk-${meta.risk}">${riskLabel}</div>
          </div>`;
    }).join('');
  }

  const limits = Array.isArray(data.tokenLimits) ? data.tokenLimits : [];
  if (limits.length > 0) {
    document.getElementById('token-limits-section').style.display = 'block';
    document.getElementById('token-limits').innerHTML = limits.map(lim => `
      <div class="token-limit-row">
          <div class="token-limit-header">${escHtml(lim.tokenSymbol || lim.tokenId)}</div>
          <div class="token-limit-detail">Max per tx: ${escHtml(lim.maxAmountPerTx)} &nbsp;|&nbsp; Max daily: ${escHtml(lim.maxDailyAmount)}</div>
      </div>`
    ).join('');
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

document.getElementById('approve-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'permissions-approval', approved: true, windowId: currentWindowId }, () => {
    if (chrome.runtime.lastError) console.warn('[permissions] approve sendMessage:', chrome.runtime.lastError.message);
  });
  window.close();
});

document.getElementById('reject-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'permissions-approval', approved: false, windowId: currentWindowId }, () => {
    if (chrome.runtime.lastError) console.warn('[permissions] reject sendMessage:', chrome.runtime.lastError.message);
  });
  window.close();
});
