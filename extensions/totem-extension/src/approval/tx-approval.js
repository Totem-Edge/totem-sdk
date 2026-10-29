// Totem — Transaction approval page logic.
// Loaded as an external script (tx-approval.js) to satisfy the extension's
// Content Security Policy, which forbids inline <script> blocks.

const urlParams = new URLSearchParams(window.location.search);
const toAddress = urlParams.get('to') || 'Unknown';
const amount = urlParams.get('amount') || '0';
const origin = urlParams.get('origin') || 'Unknown Site';
const tokenId = urlParams.get('tokenId') || '0x00';
const intent = urlParams.get('intent') || 'send';
const metaKey = urlParams.get('metaKey') || '';
const isTokenCreate = intent === 'tokencreate';

let tokenCreate = null;
const tokenCreateRaw = urlParams.get('tokenCreate');
if (tokenCreateRaw) {
  try {
    const parsed = JSON.parse(tokenCreateRaw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) tokenCreate = parsed;
  } catch (e) {
    // Ignore malformed supply details; the intent warning still applies.
  }
}

function formatAmount(amt) {
  const num = parseFloat(amt);
  if (isNaN(num)) return amt;
  if (num === 0) return '0';
  if (num < 0.0001) return num.toExponential(4);
  if (num >= 1000000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return num.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function truncateAddress(addr) {
  if (addr.length <= 20) return addr;
  return addr.slice(0, 12) + '...' + addr.slice(-8);
}

function getTokenName(tid) {
  if (tid === '0x00' || !tid) return 'MINIMA';
  return truncateAddress(tid);
}

const INTENT_WARNINGS = {
  send:             { label: 'Token Send',            risk: 'medium', text: 'This will send tokens from your wallet to the recipient. Transactions on Minima are irreversible.' },
  token_send:       { label: 'Custom Token Send',     risk: 'medium', text: 'This will send a custom token from your wallet to the recipient. Transactions on Minima are irreversible.' },
  swap:             { label: 'Token Swap',            risk: 'high',   text: 'This will swap your tokens via a DEX. The swap rate is determined by the current pool price and cannot be undone.' },
  liquidity_add:    { label: 'Add Liquidity',         risk: 'high',   text: 'Your funds will be locked into a liquidity pool. You can withdraw later but may receive a different token ratio.' },
  liquidity_remove: { label: 'Remove Liquidity',      risk: 'high',   text: 'This will remove your liquidity from the pool and return tokens to your wallet. The amounts may differ from what you deposited.' },
  contract_call:    { label: 'Smart Contract',        risk: 'high',   text: 'This executes a custom MAST smart contract. It will spend your coins according to rules defined in the contract script.' },
  multisig:         { label: 'Multisig',              risk: 'high',   text: 'This participates in a multi-party transaction requiring multiple signatures. Ensure you trust all other signing parties.' },
  timelock:         { label: 'Timelock',              risk: 'high',   text: 'Your coins will be locked until a future block height or timestamp. They cannot be spent until the timelock expires.' },
  htlc:             { label: 'Atomic Swap (HTLC)',    risk: 'high',   text: 'This creates a Hash Time-Locked Contract for an atomic swap. If not claimed in time, funds return to you automatically.' },
  complex_send:     { label: 'Complex Send',          risk: 'high',   text: 'This transaction has multiple inputs or outputs. Carefully verify the amounts and addresses before approving.' },
  sign_data:        { label: 'Sign Data',             risk: 'signing', text: 'This uses your private WOTS key to produce a cryptographic signature. No funds move, but the signature proves your identity.' },
  broadcast_tx:     { label: 'Broadcast Transaction', risk: 'signing', text: 'This submits a pre-built raw transaction to the Minima network. Ensure you fully trust the site that constructed it.' },
  custom:           { label: 'Custom Transaction',    risk: 'high',   text: 'This is a custom transaction type. Review all details carefully — you are approving an operation the requesting site defined.' },
  tokencreate:      { label: 'Mint Token',            risk: 'high',   text: 'This creates a new token or NFT on Minima. Minting is irreversible and consumes a one-time WOTS signature.' },
};

function getIntentWarning(intentKey) {
  return INTENT_WARNINGS[intentKey] || { label: intentKey, risk: 'high', text: 'This transaction cannot be undone. Verify all details before approving.' };
}

const iw0 = getIntentWarning(intent);
document.getElementById('origin').textContent = origin;
document.getElementById('to-address').textContent = toAddress;
document.getElementById('amount').textContent = formatAmount(amount);
document.getElementById('intent-label').textContent = iw0.label.toUpperCase();
document.getElementById('intent-caption').textContent = iw0.text;

const tokenName = getTokenName(tokenId);
document.getElementById('token-name').textContent = tokenName;

if (isTokenCreate) {
  document.getElementById('header-title').textContent = 'MINT TOKEN';
  document.getElementById('header-subtitle').textContent = 'Review the token you are about to create';
  document.getElementById('amount-label').textContent = 'TOTAL SUPPLY';
  document.getElementById('token-name').textContent = 'NEW TOKEN';

  const burn = tokenCreate && typeof tokenCreate.burn === 'string' ? tokenCreate.burn : '';
  if (burn && burn !== '0') {
    document.getElementById('burn-row').style.display = 'flex';
    document.getElementById('burn-value').textContent = formatAmount(burn) + ' MINIMA';
  }
}

if (tokenId !== '0x00' && tokenId) {
  document.getElementById('token-id-display').style.display = 'block';
  document.getElementById('token-id').textContent = tokenId;
}

// RFC-005 #10: multi-output transactions show every output, not just the first.
const outputsRaw = urlParams.get('outputs');
if (outputsRaw) {
  try {
    const outputs = JSON.parse(outputsRaw);
    if (Array.isArray(outputs) && outputs.length > 1) {
      const amountEl = document.getElementById('amount');
      const card = amountEl && (amountEl.closest('.card') || amountEl.parentElement);
      if (card) {
        const wrap = document.createElement('div');
        wrap.style.marginTop = '8px';

        const heading = document.createElement('div');
        heading.style.cssText = 'font-size:12px;color:var(--text-muted);margin-bottom:4px;';
        heading.textContent = 'Outputs (' + outputs.length + ')';
        wrap.appendChild(heading);

        outputs.forEach((o, i) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;font-size:12px;gap:8px;';

          const left = document.createElement('span');
          left.textContent = '#' + i + ' ' + truncateAddress(String((o && o.address) || ''));

          const right = document.createElement('span');
          right.textContent =
            formatAmount(String((o && o.amount) || '0')) +
            ' ' +
            getTokenName((o && o.tokenId) || '0x00');

          row.appendChild(left);
          row.appendChild(right);
          wrap.appendChild(row);
        });

        card.appendChild(wrap);
      }
    }
  } catch (e) {
    // Ignore malformed outputs — fall back to the single-output display.
  }
}

function clipText(value, max) {
  const str = typeof value === 'string' ? value : value == null ? '' : String(value);
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function safeImageUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^data:image\//i.test(trimmed)) {
    return trimmed.length <= 512 * 1024 ? trimmed : null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') return parsed.toString();
  } catch (e) {
    // Relative or non-URL values are not rendered.
  }
  return null;
}

function renderTokenMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return;
  const card = document.getElementById('token-meta-card');
  if (!card) return;

  const imageUrl =
    safeImageUrl(metadata.image) || safeImageUrl(metadata.icon) || safeImageUrl(metadata.imageData);
  if (imageUrl) {
    const img = document.getElementById('token-meta-image');
    img.src = imageUrl;
    img.alt = clipText(metadata.name || 'Token artwork', 120);
    img.style.display = 'block';
    img.addEventListener('error', () => { img.style.display = 'none'; });
  }

  const name = clipText(metadata.name, 120);
  if (name) document.getElementById('token-meta-name').textContent = name;

  const description = clipText(metadata.description, 500);
  if (description) document.getElementById('token-meta-description').textContent = description;

  const traits = document.getElementById('token-meta-traits');
  if (Array.isArray(metadata.attributes)) {
    metadata.attributes.slice(0, 20).forEach((attr) => {
      if (!attr || typeof attr !== 'object') return;
      const label = clipText(attr.trait_type, 32);
      const value = clipText(attr.value, 48);
      if (!label || !value) return;
      const chip = document.createElement('span');
      chip.className = 'token-meta-trait';
      chip.textContent = label + ': ' + value;
      traits.appendChild(chip);
    });
  }

  card.style.display = 'block';
}

if (metaKey) {
  chrome.storage.session.get(metaKey, (result) => {
    if (chrome.runtime.lastError) return;
    renderTokenMetadata(result && result[metaKey]);
  });
}

let isValid = true;
let hasBalance = true;

function updateUI() {
  const approveBtn = document.getElementById('approve-btn');
  const statusDiv = document.getElementById('validation-status');
  const iw = getIntentWarning(intent);

  if (!isValid) {
    statusDiv.innerHTML = '<div class="error-box">❌ Invalid recipient address</div>';
    approveBtn.disabled = true;
  } else if (!hasBalance) {
    statusDiv.innerHTML = '<div class="error-box">❌ Insufficient balance for this transaction</div>';
    approveBtn.disabled = true;
  } else if (iw.risk === 'signing') {
    statusDiv.innerHTML = `<div class="error-box">🔴 SIGNING OPERATION — ${escHtml(iw.text)}</div>`;
    approveBtn.disabled = false;
  } else if (iw.risk === 'high') {
    statusDiv.innerHTML = `<div class="error-box">🔴 HIGH RISK — ${escHtml(iw.text)}</div>`;
    approveBtn.disabled = false;
  } else {
    statusDiv.innerHTML = `<div class="warning-box">⚠️ ${escHtml(iw.text)}</div>`;
    approveBtn.disabled = false;
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function lastErrorMsg(prefix) {
  const err = chrome.runtime.lastError;
  return err ? prefix + ': ' + err.message : null;
}

chrome.runtime.sendMessage({
  method: 'validateAddress',
  params: [toAddress],
  id: Date.now().toString()
}, (response) => {
  if (lastErrorMsg('validateAddress')) {
    updateUI();
    return;
  }
  if (response && response.result) {
    isValid = response.result.ok || response.result.response?.valid;
    updateUI();
  }
});

chrome.runtime.sendMessage({
  method: 'getDefaultReceiveAddress',
  id: Date.now().toString()
}, (addressResponse) => {
  if (lastErrorMsg('getDefaultReceiveAddress')) return;
  if (addressResponse && addressResponse.result) {
    const userAddress = addressResponse.result.address;

    chrome.runtime.sendMessage({
      method: 'getBalance',
      params: [userAddress],
      id: Date.now().toString()
    }, (balanceResponse) => {
      if (lastErrorMsg('getBalance')) return;
      if (balanceResponse && balanceResponse.result) {
        const balance = parseFloat(balanceResponse.result.confirmed || '0');
        // Token creation spends only the optional burn; `amount` is the token supply.
        const spend = isTokenCreate
          ? parseFloat(tokenCreate && typeof tokenCreate.burn === 'string' ? tokenCreate.burn : '0') || 0
          : parseFloat(amount) || 0;
        hasBalance = balance >= (spend + 0.001);
        updateUI();
      }
    });
  }
});

let currentWindowId = null;
chrome.windows.getCurrent((win) => {
  if (chrome.runtime.lastError) return;
  currentWindowId = win.id;
});

document.getElementById('approve-btn').addEventListener('click', () => {
  if (!isValid || !hasBalance) return;

  chrome.runtime.sendMessage({
    type: 'tx-approval',
    approved: true,
    windowId: currentWindowId
  }, () => { if (chrome.runtime.lastError) console.warn('[tx] approve sendMessage:', chrome.runtime.lastError.message); });
  window.close();
});

document.getElementById('reject-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({
    type: 'tx-approval',
    approved: false,
    windowId: currentWindowId
  }, () => { if (chrome.runtime.lastError) console.warn('[tx] reject sendMessage:', chrome.runtime.lastError.message); });
  window.close();
});
