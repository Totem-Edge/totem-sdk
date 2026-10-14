// Totem — Omnia coordination approval page logic (RFC-035 B5).
// Loaded as an external script to satisfy the extension CSP (no inline scripts).

const urlParams = new URLSearchParams(window.location.search);
const kind = urlParams.get('kind') || 'coordination';
const channelId = urlParams.get('channelId') || '';
const factoryId = urlParams.get('factoryId') || '';
const spliceId = urlParams.get('spliceId') || '';
const proposer = urlParams.get('proposer') || '';

const LABELS = {
  'splice-accept': { label: 'Splice Acceptance', caption: 'You are co-signing a channel splice proposed by a peer.' },
  'factory-open': { label: 'Factory Opening', caption: 'You are co-signing the N-of-N opening of a channel factory.' },
  'factory-close': { label: 'Factory Settlement', caption: 'You are co-signing a cooperative factory settlement.' },
  'vc-open': { label: 'Virtual Channel Open', caption: 'You are co-signing a virtual-channel opening within a factory.' },
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

function respond(approved) {
  chrome.runtime.sendMessage({ type: 'omnia-approval', approved }, () => {
    if (chrome.runtime.lastError) console.warn('[omnia] approval sendMessage:', chrome.runtime.lastError.message);
  });
  window.close();
}

document.getElementById('approve-btn').addEventListener('click', () => respond(true));
document.getElementById('reject-btn').addEventListener('click', () => respond(false));
