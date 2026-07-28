import React, { useState, useEffect } from 'react';
import { Card, Typography, Button } from '../../components/atoms';
import { QRCodeSVG as _QRCodeSVG } from 'qrcode.react';
// qrcode.react types compiled against @types/react@18 but root workspace resolves @types/react@19;
// `any` cast avoids the JSXElementConstructor constraint check that triggers TS2786.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QRCodeSVG = _QRCodeSVG as any;

interface WalletAccount {
  address: string;
}

interface BrutalistReceiveProps {
  accountAddress?: string;
  accounts: WalletAccount[];
}

export function BrutalistReceive({ accountAddress, accounts }: BrutalistReceiveProps) {
  const [selectedAddress, setSelectedAddress] = useState<string>(accountAddress || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selectedAddress && accountAddress) {
      setSelectedAddress(accountAddress);
    }
  }, [accountAddress]);

  const handleCopy = async () => {
    if (!selectedAddress) return;
    try {
      await navigator.clipboard.writeText(selectedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[BrutalistReceive] Failed to copy address:', error);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAddress(e.target.value);
    setCopied(false);
  };

  const isValidAddress = selectedAddress && selectedAddress.length > 0 && selectedAddress !== 'Loading...';

  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}…${addr.slice(-8)}`;
  };

  const selectedIndex = accounts.findIndex(a => a.address === selectedAddress);

  return (
    <div style={{
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        flex: 1,
        minHeight: 0,
        padding: 'var(--space-2)',
        paddingBottom: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}>
        <Typography variant="h2" color="accent">
          Receive
        </Typography>

        {accounts.length > 1 && (
          <Card padding="md">
            <select
              value={selectedAddress}
              onChange={handleAddressChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-base)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'auto',
              }}
            >
              {accounts.map((account, index) => (
                <option key={account.address} value={account.address}>
                  Address #{index + 1} — {truncateAddress(account.address)}
                </option>
              ))}
            </select>
          </Card>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 'var(--space-2)',
          backgroundColor: 'white',
          borderRadius: 'var(--radius-md)',
          minHeight: '232px',
        }}>
          {!isValidAddress ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
              <Typography variant="body" color="muted">
                Loading address...
              </Typography>
            </div>
          ) : (
            <QRCodeSVG
              value={selectedAddress}
              size={200}
              level="M"
              includeMargin={true}
            />
          )}
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleCopy}
          fullWidth
          disabled={!isValidAddress}
        >
          {copied ? '✓ Copied!' : 'Copy Address'}
        </Button>
      </div>
    </div>
  );
}
