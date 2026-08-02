// Totem — Transaction approval page logic.
// Loaded as an external script (tx-approval.js) to satisfy the extension's
// Content Security Policy, which forbids inline <script> blocks.

const urlParams = new URLSearchParams(window.location.search);
const toAddress = urlParams.get('to') || 'Unknown';
const amount = urlParams.get('amount') || '0';
const origin = urlParams.get('origin') || 'Unknown Site';
const tokenId = urlParams.get('tokenId') || '0x00';
const intent = urlParams.get('intent') || 'send';

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

if (tokenId !== '0x00' && tokenId) {
  document.getElementById('token-id-display').style.display = 'block';
  document.getElementById('token-id').textContent = tokenId;
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
        const txAmount = parseFloat(amount);
        hasBalance = balance >= (txAmount + 0.001);
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
