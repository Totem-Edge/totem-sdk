// Totem — Omnia coordination approval page logic (RFC-035 B5).
// Loaded as an external script to satisfy the extension CSP (no inline scripts).

const urlParams = new URLSearchParams(window.location.search);
const kind = urlParams.get('kind') || 'coordination';
const channelId = urlParams.get('channelId') || '';
const factoryId = urlParams.get('factoryId') || '';
const spliceId = urlParams.get('spliceId') || '';
const proposer = urlParams.get('proposer') || '';
const custodyRaw = urlParams.get('custody') || '';
let custody = null;
try { custody = custodyRaw ? JSON.parse(custodyRaw) : null; } catch (e) { custody = null; }
const requiresCustody = custody && (custody.mode === 'hosted' || custody.mode === 'trust-minimised');

const LABELS = {
  'splice-accept': { label: 'Splice Acceptance', caption: 'You are co-signing a channel splice proposed by a peer.' },
  'factory-open': { label: 'Factory Opening', caption: 'You are co-signing the N-of-N opening of a channel factory.' },
  'factory-close': { label: 'Factory Settlement', caption: 'You are co-signing a cooperative factory settlement.' },
  'vc-open': { label: 'Virtual Channel Open', caption: 'You are co-signing a virtual-channel opening within a factory.' },
  'custody-disclosure': { label: 'Custody Disclosure', caption: 'Review the hosted-custody disclosure before signing.' },
};

const info = LABELS[kind] || { label: kind, caption: 'You are co-signing a peer-initiated channel operation.' };
document.getElementById('kind-label').textContent = info.label;
document.getElementById('kind-caption').textContent = info.caption;

function show(id, value) {
  if (!value) return;
  const row = document.getElementById(id);
  row.style.display = 'flex';
  row.querySelector('.value').textContent = value;
}
show('row-channel', channelId);
show('row-factory', factoryId);
show('row-splice', spliceId);
show('row-proposer', proposer);

function addWarning(text) {
  const el = document.createElement('div');
  el.style.cssText = 'font-size:12px;color:var(--warning);';
  el.textContent = text;
  document.getElementById('custody-warnings').appendChild(el);
}

if (requiresCustody) {
  document.getElementById('custody-card').style.display = 'block';
  document.getElementById('custody-operator').textContent = custody.legalEntity || custody.operatorId || 'Unknown operator';
  if (custody.jurisdiction) {
    document.getElementById('row-custody-jurisdiction').style.display = 'flex';
    document.getElementById('custody-jurisdiction').textContent = custody.jurisdiction;
  }
  if (custody.license) {
    document.getElementById('row-custody-license').style.display = 'flex';
    document.getElementById('custody-license').textContent = custody.license;
  }
  if (custody.policySummary) {
    document.getElementById('row-custody-policy').style.display = 'flex';
    document.getElementById('custody-policy').textContent = custody.policySummary;
  }
  if (custody.disclosureHash) {
    document.getElementById('row-custody-disclosure').style.display = 'flex';
    document.getElementById('custody-disclosure').textContent =
      (custody.disclosureVersion ? custody.disclosureVersion + ': ' : '') + custody.disclosureHash;
  }
  addWarning('This is a hosted-custody commitment: an operator controls signing and may hold or move funds.');
  if (custody.canMoveFunds) addWarning('The operator can move funds without your participation.');
  if (custody.canFreeze) addWarning('The operator can freeze or delay withdrawals.');
  if (custody.operatorDiscretion) addWarning('The operator has discretion over operations or payouts.');
  addWarning('No yield, return or investment performance is promised.');
  if (custody.withdrawalTerms) addWarning('Withdrawal terms: ' + custody.withdrawalTerms);
} else {
  document.getElementById('approve-btn').disabled = false;
}

const custodyCheckbox = document.getElementById('custody-checkbox');
const approveBtn = document.getElementById('approve-btn');
if (requiresCustody) {
  custodyCheckbox.addEventListener('change', () => { approveBtn.disabled = !custodyCheckbox.checked; });
}

function respond(approved) {
  if (approved && requiresCustody && !custodyCheckbox.checked) return;
  chrome.runtime.sendMessage({
    type: 'omnia-approval',
    approved,
    custodyAcknowledged: requiresCustody ? custodyCheckbox.checked : undefined,
  }, () => {
    if (chrome.runtime.lastError) console.warn('[omnia] approval sendMessage:', chrome.runtime.lastError.message);
  });
  window.close();
}

approveBtn.addEventListener('click', () => respond(true));
document.getElementById('reject-btn').addEventListener('click', () => respond(false));
