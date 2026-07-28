/**
 * Connect dApp Modal
 * Approval modal for dApp connection requests with permission selection
 */

import React, { useState } from 'react';

export interface DAppConnectionRequest {
  origin: string;
  name: string;
  icon?: string;
  permissions: string[];
}

export interface ConnectDAppModalProps {
  isOpen: boolean;
  request: DAppConnectionRequest | null;
  onApprove: (permissions: string[]) => void;
  onReject: () => void;
}

export function ConnectDAppModal({ isOpen, request, onApprove, onReject }: ConnectDAppModalProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  if (!isOpen || !request) return null;

  const availablePermissions = [
    { id: 'accounts', label: 'View Accounts', description: 'View your wallet addresses' },
    { id: 'balance', label: 'View Balance', description: 'View your token balances' },
    { id: 'sign', label: 'Request Signatures', description: 'Request transaction signatures' },
    { id: 'send', label: 'Send Transactions', description: 'Propose transactions' }
  ];

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleApprove = () => {
    onApprove(selectedPermissions);
    setSelectedPermissions([]);
  };

  const handleReject = () => {
    onReject();
    setSelectedPermissions([]);
  };

  return (
    <div className="quota-modal-overlay" style={{ zIndex: 1000 }}>
      <div className="quota-modal" style={{ maxWidth: '420px' }}>
        <div className="quota-modal-header">
          <h2 style={{ fontSize: '16px' }}>Connect to dApp</h2>
        </div>

        <div className="quota-modal-body">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            {request.icon && (
              <img
                src={request.icon}
                alt={request.name}
                style={{ width: '48px', height: '48px', borderRadius: '8px', marginBottom: '12px' }}
              />
            )}
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
              {request.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace' }}>
              {request.origin}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '12px' }}>
              Select Permissions:
            </div>

            {availablePermissions.map((permission) => (
              <div
                key={permission.id}
                onClick={() => togglePermission(permission.id)}
                style={{
                  padding: '10px',
                  background: selectedPermissions.includes(permission.id)
                    ? 'rgba(79, 70, 229, 0.2)'
                    : 'var(--panel)',
                  border: `1px solid ${selectedPermissions.includes(permission.id)
                    ? 'rgba(79, 70, 229, 0.4)'
                    : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '6px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  background: selectedPermissions.includes(permission.id)
                    ? '#6366f1'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {selectedPermissions.includes(permission.id) && (
                    <div style={{ color: 'white', fontSize: '10px' }}>✓</div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '500' }}>
                    {permission.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {permission.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleReject}
              style={{
                flex: 1,
                padding: '10px',
                background: 'var(--panel)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={selectedPermissions.length === 0}
              className="quota-upgrade-button"
              style={{ flex: 1, opacity: selectedPermissions.length === 0 ? 0.5 : 1 }}
            >
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
