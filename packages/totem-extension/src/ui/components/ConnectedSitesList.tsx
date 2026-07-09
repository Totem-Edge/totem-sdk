/**
 * Connected Sites List
 * Shows active dApp connections with disconnect/revoke permission controls
 */

import React, { useEffect, useState } from 'react';

export interface ConnectedSite {
  origin: string;
  name: string;
  icon?: string;
  permissions: string[];
  connectedAt: number;
  lastUsed: number;
}

export function ConnectedSitesList() {
  const [sites, setSites] = useState<ConnectedSite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnectedSites();
  }, []);

  const loadConnectedSites = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'dapp:getConnected'
      });

      if (response.result) {
        setSites(response.result || []);
      }
    } catch (error) {
      console.error('Failed to load connected sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (origin: string) => {
    try {
      await chrome.runtime.sendMessage({
        method: 'dapp:disconnect',
        params: [origin]
      });

      setSites(prev => prev.filter(s => s.origin !== origin));
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
        Loading connected sites...
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
          No connected sites
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
          dApps you connect to will appear here
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px' }}>
      {sites.map((site) => (
        <div
          key={site.origin}
          style={{
            padding: '12px',
            background: 'var(--panel)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            marginBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
            {site.icon && (
              <img
                src={site.icon}
                alt={site.name}
                style={{ width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0 }}
              />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>
                {site.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {site.origin}
              </div>
            </div>

            <button
              onClick={() => handleDisconnect(site.origin)}
              style={{
                padding: '6px 12px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '4px',
                color: '#ef4444',
                fontSize: '11px',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              Disconnect
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {site.permissions.map((perm) => (
              <span
                key={perm}
                style={{
                  padding: '2px 8px',
                  background: 'rgba(79, 70, 229, 0.2)',
                  border: '1px solid rgba(79, 70, 229, 0.3)',
                  borderRadius: '12px',
                  fontSize: '10px',
                  color: '#6366f1'
                }}
              >
                {perm}
              </span>
            ))}
          </div>

          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
            Last used: {formatTime(site.lastUsed)}
          </div>
        </div>
      ))}
    </div>
  );
}
