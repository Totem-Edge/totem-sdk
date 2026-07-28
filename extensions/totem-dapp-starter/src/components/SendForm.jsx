import { useState } from 'react';
import { useTotem } from '../totem-context.jsx';
import styles from './SendForm.module.css';

/**
 * SendForm — simple TOTEM_SEND_TRANSACTION form.
 *
 * Calls provider.request({ method: 'TOTEM_SEND_TRANSACTION', ... }) via
 * the active wallet provider from TotemContext, which opens the Totem
 * extension approval popup. The wallet handles coin selection, signing,
 * and broadcast — the dApp only provides intent.
 */
export function SendForm() {
  const { activeProvider } = useTotem();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    if (!recipient.trim() || !amount.trim()) return;

    setSending(true);
    setStatus(null);

    try {
      const result = await activeProvider.request({
        method: 'TOTEM_SEND_TRANSACTION',
        params: {
          origin: location.origin,
          request: {
            version: 1,
            intent: 'send',
            outputs: [
              {
                address: recipient.trim(),
                amount: amount.trim(),
                tokenId: '0x00',
              },
            ],
          },
        },
      });

      if (result.success) {
        setStatus({ type: 'success', message: `Sent! TxID: ${result.txpowid}` });
        setRecipient('');
        setAmount('');
      } else {
        setStatus({ type: 'error', message: result.error ?? 'Transaction failed' });
      }
    } catch (err) {
      if (err.message === 'User rejected') {
        setStatus({ type: 'info', message: 'Transaction cancelled by user.' });
      } else {
        setStatus({ type: 'error', message: err.message });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Send MINIMA</h3>
      <form className={styles.form} onSubmit={handleSend}>
        <label className={styles.label}>
          Recipient address
          <input
            className={styles.input}
            type="text"
            placeholder="Mx…"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            required
          />
        </label>

        <label className={styles.label}>
          Amount
          <input
            className={styles.input}
            type="number"
            placeholder="0.0"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>

        <button
          className={styles.sendBtn}
          type="submit"
          disabled={sending || !recipient.trim() || !amount.trim()}
        >
          {sending ? 'Awaiting approval…' : 'Send'}
        </button>
      </form>

      {status && (
        <div className={`${styles.status} ${styles[status.type]}`}>
          {status.message}
        </div>
      )}

      <p className={styles.note}>
        The Totem extension handles coin selection, signing, and broadcast.
        A confirmation popup will appear before any funds move.
      </p>
    </div>
  );
}
