import React, { useState, useEffect, useMemo } from 'react';
import type { Account } from '../../core/wallet';

interface AddressPickerProps {
  accounts: Account[];
  selectedIndex: number | null;
  onSelect: (account: Account) => void;
  onCancel: () => void;
  siteDomain?: string;
  showBalances?: boolean;
  title?: string;
  subtitle?: string;
}

export function AddressPicker({
  accounts,
  selectedIndex,
  onSelect,
  onCancel,
  siteDomain,
  showBalances = true,
  title = 'Select Address',
  subtitle
}: AddressPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    const term = searchTerm.toLowerCase();
    return accounts.filter(account => 
      account.address.toLowerCase().includes(term) ||
      account.name.toLowerCase().includes(term) ||
      account.index.toString().includes(term)
    );
  }, [accounts, searchTerm]);

  const formatBalance = (balance: string): string => {
    const num = parseFloat(balance);
    if (isNaN(num) || num === 0) return '0';
    if (num < 0.0001) return '<0.0001';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(4);
  };

  const truncateAddress = (address: string): string => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
  };

  return (
    <div className="address-picker">
      <style>{`
        .address-picker {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          background: #000;
          border: 2px solid #fff;
          padding: 16px;
          max-height: 480px;
          display: flex;
          flex-direction: column;
        }
        .address-picker-header {
          margin-bottom: 12px;
        }
        .address-picker-title {
          color: #fff;
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin: 0 0 4px 0;
        }
        .address-picker-subtitle {
          color: #888;
          font-size: 11px;
          margin: 0;
        }
        .address-picker-domain {
          color: #0f0;
          font-size: 12px;
          margin: 8px 0;
          padding: 8px;
          background: rgba(0, 255, 0, 0.1);
          border: 1px solid #0f0;
        }
        .address-picker-search {
          width: 100%;
          padding: 8px 12px;
          background: #111;
          border: 1px solid #333;
          color: #fff;
          font-family: inherit;
          font-size: 12px;
          margin-bottom: 12px;
          outline: none;
        }
        .address-picker-search:focus {
          border-color: #fff;
        }
        .address-picker-search::placeholder {
          color: #666;
        }
        .address-picker-list {
          flex: 1;
          overflow-y: auto;
          border: 1px solid #333;
        }
        .address-picker-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          border-bottom: 1px solid #222;
          cursor: pointer;
          transition: background 0.1s;
        }
        .address-picker-item:hover {
          background: #1a1a1a;
        }
        .address-picker-item.selected {
          background: #0f0;
          color: #000;
        }
        .address-picker-item.selected .address-picker-balance {
          color: #000;
        }
        .address-picker-index {
          width: 32px;
          font-size: 10px;
          color: #666;
          flex-shrink: 0;
        }
        .address-picker-item.selected .address-picker-index {
          color: #000;
        }
        .address-picker-address {
          flex: 1;
          font-size: 11px;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .address-picker-item.selected .address-picker-address {
          color: #000;
        }
        .address-picker-balance {
          font-size: 10px;
          color: #888;
          margin-left: 8px;
          flex-shrink: 0;
        }
        .address-picker-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .address-picker-btn {
          flex: 1;
          padding: 10px;
          font-family: inherit;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          cursor: pointer;
          border: 2px solid #fff;
          transition: all 0.1s;
        }
        .address-picker-btn-cancel {
          background: transparent;
          color: #fff;
        }
        .address-picker-btn-cancel:hover {
          background: #333;
        }
        .address-picker-btn-select {
          background: #fff;
          color: #000;
        }
        .address-picker-btn-select:hover {
          background: #0f0;
          border-color: #0f0;
        }
        .address-picker-btn-select:disabled {
          background: #333;
          border-color: #333;
          color: #666;
          cursor: not-allowed;
        }
        .address-picker-empty {
          padding: 24px;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
        .address-picker-count {
          font-size: 10px;
          color: #666;
          margin-top: 8px;
          text-align: right;
        }
      `}</style>

      <div className="address-picker-header">
        <h3 className="address-picker-title">{title}</h3>
        {subtitle && <p className="address-picker-subtitle">{subtitle}</p>}
      </div>

      {siteDomain && (
        <div className="address-picker-domain">
          Connecting to: {siteDomain}
        </div>
      )}

      <input
        type="text"
        className="address-picker-search"
        placeholder="Search by address, name, or index..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="address-picker-list">
        {filteredAccounts.length === 0 ? (
          <div className="address-picker-empty">
            {searchTerm ? 'No addresses match your search' : 'No addresses available'}
          </div>
        ) : (
          filteredAccounts.map((account) => (
            <div
              key={account.index}
              className={`address-picker-item ${selectedIndex === account.index ? 'selected' : ''}`}
              onClick={() => onSelect(account)}
              onMouseEnter={() => setHoveredIndex(account.index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span className="address-picker-index">#{account.index}</span>
              <span className="address-picker-address">
                {hoveredIndex === account.index ? account.address : truncateAddress(account.address)}
              </span>
              {showBalances && (
                <span className="address-picker-balance">
                  {formatBalance(account.balance)} MIN
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="address-picker-count">
        {filteredAccounts.length} of {accounts.length} addresses
      </div>

      <div className="address-picker-actions">
        <button className="address-picker-btn address-picker-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button 
          className="address-picker-btn address-picker-btn-select"
          disabled={selectedIndex === null}
          onClick={() => {
            const account = accounts.find(a => a.index === selectedIndex);
            if (account) onSelect(account);
          }}
        >
          Connect
        </button>
      </div>
    </div>
  );
}

export default AddressPicker;
