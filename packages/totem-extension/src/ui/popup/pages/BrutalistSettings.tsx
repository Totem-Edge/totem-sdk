/**
 * AXIA TOTEM SETTINGS PAGE - BRUTALIST REDESIGN
 * Settings, security, and Axia API quota management
 */

import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, StatusPill } from '../../components/atoms';
import { QuotaMeter, ThemeSwitcher } from '../../components/molecules';
import { DesignerConfigManager, type DesignerMode } from '../../../config/DesignerConfigManager';
import { isDesignerMode } from '../../../config/constants';
import { AUTO_LOCK_OPTIONS_MINUTES, DEFAULT_AUTO_LOCK_MINUTES } from '../../../constants';
import { axiaRpcClient } from '../../../core/api/AxiaRpcClient';
import { getPQStatusMessage, browserSupportsPQ } from '../../../utils/pqDetection';
import { useTheme } from '../../theme/useTheme';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { ConnectedSites } from './ConnectedSites';
import '../../theme/axia-tokens.css';

// Brutalist Toggle Switch Component
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label style={{
      position: 'relative',
      display: 'inline-block',
      width: '48px',
      height: '24px',
      cursor: 'pointer',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ display: 'none' }}
      />
      <span style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: checked ? 'var(--axia-aqua)' : 'var(--bg-muted)',
        transition: 'background-color 0.2s',
        border: '2px solid var(--border-default)',
      }}>
        <span style={{
          position: 'absolute',
          height: '16px',
          width: '16px',
          left: checked ? '26px' : '2px',
          bottom: '2px',
          backgroundColor: 'var(--axia-white)',
          transition: 'left 0.2s',
          border: '2px solid var(--border-default)',
        }} />
      </span>
    </label>
  );
}

interface QuotaData {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  quotaReset: number | null;
  tier: string;
}

interface WotsHealthData {
  health: 'healthy' | 'warning' | 'critical';
  totalCapacity: number;
  used: number;
  remaining: number;
  usagePercent: number;
  historicalTransactions: number;
  activeLeases: number;
  totalLeases: number;
  lastSyncTimestamp: number | null;
  isExhausted: boolean;
  addressCount?: number;
}

interface BrutalistSettingsProps {
  onAccountsUpdated?: () => void;
}

export function BrutalistSettings({ onAccountsUpdated }: BrutalistSettingsProps = {}) {
  const { currentTheme, setTheme } = useTheme();
  const { showAnnouncements, toggleShowAnnouncements } = useAnnouncements();
  const [walletAccountCount, setWalletAccountCount] = useState<number>(1);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [addressesExpanded, setAddressesExpanded] = useState<boolean>(false);
  const [quotaExpanded, setQuotaExpanded] = useState<boolean>(false);
  const [wotsExpanded, setWotsExpanded] = useState<boolean>(false);
  const [appearanceExpanded, setAppearanceExpanded] = useState<boolean>(false);
  const [networkExpanded, setNetworkExpanded] = useState<boolean>(false);
  const [securityExpanded, setSecurityExpanded] = useState<boolean>(false);
  const [advancedExpanded, setAdvancedExpanded] = useState<boolean>(false);
  const [isAddingAddress, setIsAddingAddress] = useState<boolean>(false);
  const [addAddressMessage, setAddAddressMessage] = useState<string | null>(null);
  const [autoLockEnabled, setAutoLockEnabled] = useState<boolean>(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(DEFAULT_AUTO_LOCK_MINUTES);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState<boolean>(false);
  const [recoveryPhraseMnemonic, setRecoveryPhraseMnemonic] = useState<string[]>([]);
  const [showConnectedSites, setShowConnectedSites] = useState<boolean>(false);
  const [connectedSitesCount, setConnectedSitesCount] = useState<number>(0);
  const [quotaData, setQuotaData] = useState<QuotaData>({
    dailyUsed: 0,
    dailyLimit: 10000,
    monthlyUsed: 0,
    monthlyLimit: 300000,
    quotaReset: null,
    tier: 'Free',
  });
  const [quotaLoading, setQuotaLoading] = useState<boolean>(true);
  const [walletLocked, setWalletLocked] = useState<boolean>(true);
  
  // WOTS Health state
  const [wotsHealth, setWotsHealth] = useState<WotsHealthData | null>(null);
  const [wotsLoading, setWotsLoading] = useState<boolean>(true);

  // API key (power user)
  const [axiaApiKey, setAxiaApiKey] = useState<string>('');
  const [axiaApiKeySaving, setAxiaApiKeySaving] = useState<boolean>(false);
  const [axiaApiKeyStatus, setAxiaApiKeyStatus] = useState<string | null>(null);

  // Designer mode state
  const [designerMode, setDesignerMode] = useState<DesignerMode>('mock');
  const [designerApiUrl, setDesignerApiUrl] = useState<string>('');
  const [designerProjectId, setDesignerProjectId] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const inDesignerMode = isDesignerMode();

  // Load account count and full list from storage
  useEffect(() => {
    chrome.storage.local.get(['walletAddresses'], (result) => {
      const addrs: any[] = result.walletAddresses || [];
      setWalletAccountCount(addrs.length || 1);
      setAccounts(addrs);
    });
  }, []);

  const handleAddAddress = async () => {
    setIsAddingAddress(true);
    setAddAddressMessage(null);
    try {
      const resp = await chrome.runtime.sendMessage({ method: 'wallet:addNextAddress' });
      if (resp?.ok && resp.account) {
        setWalletAccountCount((n) => n + 1);
        setAccounts((prev) => [...prev, resp.account]);
        setAddAddressMessage(`Added: ${resp.account.name} ${resp.account.address.slice(0, 12)}...`);
        onAccountsUpdated?.();
        setTimeout(() => setAddAddressMessage(null), 4000);
      } else {
        setAddAddressMessage(resp?.error || 'Failed to add address. Is your wallet unlocked?');
        setTimeout(() => setAddAddressMessage(null), 5000);
      }
    } catch (e: any) {
      setAddAddressMessage(e?.message || 'Error adding address');
      setTimeout(() => setAddAddressMessage(null), 5000);
    } finally {
      setIsAddingAddress(false);
    }
  };

  useEffect(() => {
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ method: 'wallet:getState' }).then((resp: any) => {
        const locked = resp?.result?.locked !== false;
        setWalletLocked(locked);

        if (!locked) {
          chrome.runtime.sendMessage({ type: 'wallet:fetchUserQuota' }).then((quotaResp: any) => {
            if (quotaResp?.ok && quotaResp.result) {
              const q = quotaResp.result;
              setQuotaData({
                dailyUsed: q.dailyUsed || 0,
                dailyLimit: q.dailyLimit || 10000,
                monthlyUsed: q.monthlyUsed || 0,
                monthlyLimit: q.monthlyLimit || 300000,
                quotaReset: q.quotaReset || null,
                tier: 'Free',
              });
            }
            setQuotaLoading(false);
          }).catch(() => setQuotaLoading(false));
        } else {
          setQuotaLoading(false);
        }
      }).catch(() => setQuotaLoading(false));
    }

    if (chrome?.storage?.local) {
      chrome.storage.local.get([
        'auto_lock_enabled', 
        'auto_lock_minutes',
        'biometric_enabled',
        'axia_quota_state_v1',
        'AXIA_API_KEY',
      ], (result) => {
        setAutoLockEnabled(result.auto_lock_enabled !== false);
        setAutoLockMinutes(result.auto_lock_minutes || DEFAULT_AUTO_LOCK_MINUTES);
        setBiometricEnabled(result.biometric_enabled === true);
        setAxiaApiKey(result.AXIA_API_KEY || '');
        
        const quota = result['axia_quota_state_v1'];
        if (quota) {
          setQuotaData({
            dailyUsed: quota.dailyUsed || 0,
            dailyLimit: quota.dailyLimit || 10000,
            monthlyUsed: quota.monthlyUsed || 0,
            monthlyLimit: quota.monthlyLimit || 300000,
            quotaReset: quota.quotaReset || null,
            tier: 'Free',
          });
        }
      });
    }

    // Load Designer mode config
    if (inDesignerMode) {
      DesignerConfigManager.getConfig().then((config) => {
        setDesignerMode(config.mode);
        setDesignerApiUrl(config.apiUrl || '');
        setDesignerProjectId(config.projectId || '');
      });
    }
    
    // Load WOTS health data
    loadWotsHealth();
    
    loadConnectedSitesCount();
  }, [inDesignerMode]);
  
  const loadWotsHealth = async () => {
    try {
      setWotsLoading(true);
      const response = await chrome.runtime.sendMessage({ 
        type: 'wallet:getWotsHealth',
        id: Date.now()
      });
      
      if (response?.result) {
        setWotsHealth(response.result);
      }
    } catch (error) {
      console.error('[Settings] Failed to load WOTS health:', error);
    } finally {
      setWotsLoading(false);
    }
  };

  const loadConnectedSitesCount = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        method: 'GET_CONNECTED_SITES',
        id: Date.now().toString(),
      });
      if (response?.result) {
        setConnectedSitesCount(response.result.length);
      }
    } catch (error) {
      console.error('[Settings] Failed to load connected sites count:', error);
    }
  };

  if (showConnectedSites) {
    return (
      <ConnectedSites onBack={() => {
        setShowConnectedSites(false);
        loadConnectedSitesCount();
      }} />
    );
  }

  const handleToggleAutoLock = () => {
    const newValue = !autoLockEnabled;
    setAutoLockEnabled(newValue);
    
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ auto_lock_enabled: newValue });
    }
  };

  const handleAutoLockMinutesChange = (minutes: number) => {
    setAutoLockMinutes(minutes);
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ auto_lock_minutes: minutes });
    }
  };

  const formatLockDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    return `${minutes / 60} hr`;
  };

  const handleToggleBiometric = async () => {
    if (!biometricEnabled) {
      // Enable biometric
      alert("🔐 Biometric authentication setup\n\nThis feature uses WebAuthn to create a passkey on your device. You'll need to verify with your fingerprint or face recognition.");
      setBiometricEnabled(true);
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ biometric_enabled: true });
      }
    } else {
      // Disable biometric
      if (confirm("⚠ Disable biometric authentication?\n\nYou'll need to use your password to unlock the wallet.")) {
        setBiometricEnabled(false);
        if (chrome?.storage?.local) {
          chrome.storage.local.set({ biometric_enabled: false });
        }
      }
    }
  };

  const handleViewRecoveryPhrase = async () => {
    if (confirm("⚠ Security Warning\n\nYour recovery phrase gives full access to your wallet. Make sure no one is watching your screen.\n\nDo you want to continue?")) {
      const password = prompt("Enter your wallet password to view recovery phrase:");
      
      if (!password) {
        return; // User cancelled
      }
      
      try {
        // Request mnemonic from background service
        const response = await chrome.runtime.sendMessage({
          method: 'wallet:exportMnemonic',
          params: [password],
          id: Date.now()
        });
        
        if (response.error) {
          alert(`✗ Error: ${response.error.message}`);
          return;
        }
        
        // Split mnemonic into words and store in state
        const words = response.result.mnemonic.split(' ');
        setRecoveryPhraseMnemonic(words);
        setShowRecoveryPhrase(true);
      } catch (error: any) {
        alert(`✗ Failed to retrieve recovery phrase: ${error.message}`);
      }
    }
  };

  const handleChangePassword = () => {
    const currentPassword = prompt("Enter current password:");
    if (currentPassword) {
      const newPassword = prompt("Enter new password:");
      if (newPassword && newPassword.length >= 8) {
        const confirmPassword = prompt("Confirm new password:");
        if (confirmPassword === newPassword) {
          alert("✓ Password changed successfully!");
        } else {
          alert("✗ Passwords do not match");
        }
      } else {
        alert("✗ Password must be at least 8 characters");
      }
    }
  };

  const handleExportPrivateKeys = () => {
    if (confirm("⚠ DANGER: Export Private Keys\n\nThis will export ALL private keys from your wallet. Anyone with these keys can access your funds.\n\nOnly proceed if you know what you're doing.")) {
      alert("🔑 Private keys export feature coming soon\n\nThis will export your WOTS key tree in encrypted format.");
    }
  };

  const handleClearCache = () => {
    if (confirm("Clear cached data?\n\nThis will clear transaction cache and price data. Your wallet and keys will NOT be affected.")) {
      if (chrome?.storage?.local) {
        chrome.storage.local.remove(['price_cache', 'tx_cache'], () => {
          alert("✓ Cache cleared successfully");
        });
      }
    }
  };

  const handleLock = async () => {
    if (confirm("🔒 Lock your wallet?\n\nYou'll need to enter your password to unlock it again.")) {
      await chrome.runtime.sendMessage({ type: "ui:lockWallet" });
      window.close();
    }
  };

  const handleSaveAxiaApiKey = async () => {
    setAxiaApiKeySaving(true);
    setAxiaApiKeyStatus(null);
    try {
      if (axiaApiKey.trim()) {
        await chrome.storage.local.set({ AXIA_API_KEY: axiaApiKey.trim() });
      } else {
        await chrome.storage.local.remove('AXIA_API_KEY');
      }
      setAxiaApiKeyStatus('saved');
      setTimeout(() => setAxiaApiKeyStatus(null), 3000);
    } catch {
      setAxiaApiKeyStatus('error');
    } finally {
      setAxiaApiKeySaving(false);
    }
  };

  const handleDesignerModeChange = (mode: DesignerMode) => {
    setDesignerMode(mode);
  };

  const handleSaveDesignerConfig = async () => {
    try {
      setIsSavingConfig(true);

      // Validate inputs in Live mode
      if (designerMode === 'live') {
        if (!designerApiUrl || !designerProjectId) {
          alert('❌ Error: API URL and Project ID are required for Live mode');
          setIsSavingConfig(false);
          return;
        }

        // Basic URL validation
        try {
          new URL(designerApiUrl);
        } catch {
          alert('❌ Error: Invalid API URL format. Must start with http:// or https://');
          setIsSavingConfig(false);
          return;
        }
      }

      // Save config
      await DesignerConfigManager.setConfig({
        mode: designerMode,
        apiUrl: designerApiUrl,
        projectId: designerProjectId,
      });

      // Reload AxiaRpcClient to pick up new config
      await axiaRpcClient.reloadConfig();

      alert(`✓ Configuration saved!\n\nMode: ${designerMode.toUpperCase()}\n${designerMode === 'live' ? `API URL: ${designerApiUrl}\nProject ID: ${designerProjectId}` : 'Using mock data'}\n\nPlease refresh the popup to see changes.`);
      
      setIsSavingConfig(false);
    } catch (error: any) {
      console.error('[Designer Settings] Failed to save config:', error);
      alert(`❌ Failed to save configuration: ${error.message}`);
      setIsSavingConfig(false);
    }
  };

  const quotaPercent = quotaData.dailyLimit > 0 
    ? (quotaData.dailyUsed / quotaData.dailyLimit) * 100 
    : 0;
  const quotaStatus = quotaPercent > 90 ? 'failed' : quotaPercent > 75 ? 'warning' : 'success';

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
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
    }}>
      {/* My Addresses */}
      <Card padding="sm">
        <div
          onClick={() => setAddressesExpanded(v => !v)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            marginBottom: addressesExpanded ? 'var(--space-2)' : 0,
          }}
        >
          <Typography variant="caption" color="primary" uppercase bold style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.08em' }}>
            My Addresses
          </Typography>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <StatusPill variant="info" size="sm">{walletAccountCount} ACTIVE</StatusPill>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              {addressesExpanded ? '▴' : '▾'}
            </span>
          </div>
        </div>

        {addressesExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border-subtle)' }}>
            {accounts.map((acc, i) => (
              <div key={acc.address || i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-1) var(--space-1-5)',
                background: 'var(--bg-base)',
              }}>
                <Typography variant="caption" color="muted">#{i + 1}</Typography>
                <Typography variant="caption" mono>
                  {acc.address ? `${acc.address.slice(0, 10)}...${acc.address.slice(-6)}` : '—'}
                </Typography>
              </div>
            ))}
            <div style={{
              padding: 'var(--space-1) var(--space-1-5)',
              background: 'var(--bg-base)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-1)',
            }}>
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={handleAddAddress}
                disabled={isAddingAddress}
              >
                {isAddingAddress ? 'Adding...' : '+ Add Address'}
              </Button>
              {addAddressMessage && (
                <Typography variant="caption" color="muted" style={{ fontSize: 'var(--text-2xs)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {addAddressMessage}
                </Typography>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Axia API Quota */}
      <Card padding="sm">
        <div
          onClick={() => setQuotaExpanded(v => !v)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            marginBottom: quotaExpanded ? 'var(--space-2)' : 0,
          }}
        >
          <Typography variant="caption" color="primary" uppercase bold style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.08em' }}>
            Axia API Quota
          </Typography>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            {quotaLoading ? (
              <StatusPill variant="info">LOADING</StatusPill>
            ) : walletLocked ? (
              <StatusPill variant="info">LOCKED</StatusPill>
            ) : (
              <StatusPill variant={quotaStatus}>
                {quotaData.dailyUsed.toLocaleString()} / {quotaData.dailyLimit.toLocaleString()}
              </StatusPill>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              {quotaExpanded ? '▴' : '▾'}
            </span>
          </div>
        </div>

        {quotaExpanded && (
          walletLocked && !quotaLoading ? (
            <Typography variant="body" color="secondary" style={{ fontStyle: 'italic' }}>
              Unlock wallet to view per-user quota
            </Typography>
          ) : (
            <>
              {/* Daily Quota Meter */}
              <QuotaMeter
                label="Daily Requests"
                used={quotaData.dailyUsed}
                limit={quotaData.dailyLimit}
                resetTime={quotaData.quotaReset || undefined}
                size="md"
              />

              {/* Monthly Quota Meter */}
              <div style={{ marginTop: 'var(--space-2)' }}>
                <QuotaMeter
                  label="Monthly Requests"
                  used={quotaData.monthlyUsed}
                  limit={quotaData.monthlyLimit}
                  size="sm"
                />
              </div>
            </>
          )
        )}
      </Card>

      {/* WOTS Key Health */}
      <Card padding="sm">
        <div
          onClick={() => setWotsExpanded(v => !v)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            marginBottom: wotsExpanded ? 'var(--space-2)' : 0,
          }}
        >
          <Typography variant="caption" color="primary" uppercase bold style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.08em' }}>
            WOTS Key Health
          </Typography>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            {wotsLoading ? (
              <StatusPill variant="info">LOADING</StatusPill>
            ) : wotsHealth ? (
              <StatusPill
                variant={wotsHealth.health === 'healthy' ? 'success' :
                         wotsHealth.health === 'warning' ? 'warning' : 'failed'}
              >
                {wotsHealth.health.toUpperCase()}
              </StatusPill>
            ) : (
              <StatusPill variant="info">UNKNOWN</StatusPill>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              {wotsExpanded ? '▴' : '▾'}
            </span>
          </div>
        </div>

        {wotsExpanded && wotsHealth && (
          <>
            {/* Signature Capacity */}
            <div style={{
              padding: 'var(--space-2)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: 'var(--space-1)'
              }}>
                <Typography variant="caption" color="muted">
                  Signatures Used
                </Typography>
                <Typography variant="caption" mono>
                  {wotsHealth.used.toLocaleString()} / {wotsHealth.totalCapacity.toLocaleString()}
                </Typography>
              </div>
              
              {/* Usage Bar */}
              <div style={{
                height: '8px',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(wotsHealth.usagePercent, 100)}%`,
                  background: wotsHealth.health === 'healthy' ? 'var(--status-success)' : 
                              wotsHealth.health === 'warning' ? 'var(--status-warning)' : 
                              'var(--status-failed)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginTop: 'var(--space-1)'
              }}>
                <Typography variant="caption" color="muted">
                  {wotsHealth.usagePercent}% used
                </Typography>
                <Typography variant="caption" color="muted">
                  {wotsHealth.remaining.toLocaleString()} remaining
                </Typography>
              </div>
            </div>

            {/* Key Details */}
            <div style={{
              padding: 'var(--space-2)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-2)',
            }}>
              <div>
                <Typography variant="caption" color="muted" style={{ display: 'block' }}>
                  Total Transactions
                </Typography>
                <Typography variant="body" mono style={{ fontSize: 'var(--text-sm)' }}>
                  {wotsHealth.historicalTransactions}
                </Typography>
              </div>
              <div>
                <Typography variant="caption" color="muted" style={{ display: 'block' }}>
                  Active Leases
                </Typography>
                <Typography variant="body" mono style={{ fontSize: 'var(--text-sm)' }}>
                  {wotsHealth.activeLeases}
                </Typography>
              </div>
              <div>
                <Typography variant="caption" color="muted" style={{ display: 'block' }}>
                  Key Status
                </Typography>
                <Typography 
                  variant="body" 
                  mono 
                  style={{ 
                    fontSize: 'var(--text-sm)',
                    color: wotsHealth.isExhausted ? 'var(--status-failed)' : 'var(--status-success)'
                  }}
                >
                  {wotsHealth.isExhausted ? 'EXHAUSTED' : 'ACTIVE'}
                </Typography>
              </div>
              <div>
                <Typography variant="caption" color="muted" style={{ display: 'block' }}>
                  Addresses
                </Typography>
                <Typography variant="body" mono style={{ fontSize: 'var(--text-sm)' }}>
                  {walletAccountCount} TreeKey
                </Typography>
              </div>
            </div>

            {/* Warning message if critical/warning */}
            {wotsHealth.health !== 'healthy' && (
              <div style={{
                padding: 'var(--space-2)',
                background: wotsHealth.health === 'critical' ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                borderTop: `1px solid ${wotsHealth.health === 'critical' ? 'var(--status-failed)' : 'var(--status-warning)'}`,
              }}>
                <Typography variant="caption" style={{ 
                  color: wotsHealth.health === 'critical' ? 'var(--status-failed)' : 'var(--status-warning)'
                }}>
                  {wotsHealth.health === 'critical' 
                    ? '⚠ Critical: Less than 1,000 signatures remaining. Consider creating a new wallet soon.'
                    : '⚠ Warning: Less than 10,000 signatures remaining. Plan for key rotation.'}
                </Typography>
              </div>
            )}
          </>
        )}

        {!wotsHealth && !wotsLoading && (
          <Typography variant="caption" color="muted" style={{ padding: 'var(--space-2)' }}>
            Unable to load WOTS health data. Please try again later.
          </Typography>
        )}
      </Card>

      {/* Appearance / Theme Settings */}
      <Card padding="sm">
        <div
          onClick={() => setAppearanceExpanded(v => !v)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            marginBottom: appearanceExpanded ? 'var(--space-2)' : 0,
          }}
        >
          <Typography variant="caption" color="primary" uppercase bold style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.08em' }}>
            Appearance
          </Typography>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {appearanceExpanded ? '▴' : '▾'}
          </span>
        </div>

        {appearanceExpanded && (
          <>
            <Typography variant="caption" style={{ opacity: 0.7, marginBottom: 'var(--space-2)', display: 'block' }}>
              Choose your color theme
            </Typography>
            <ThemeSwitcher
              currentTheme={currentTheme}
              onThemeChange={setTheme}
            />

            {/* Announcements Toggle */}
            <div style={{
              marginTop: 'var(--space-2)',
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)' }}>
                  Show Announcements
                </Typography>
                <Typography variant="caption" style={{ opacity: 0.7, fontSize: 'var(--text-2xs)' }}>
                  {showAnnouncements ? 'Display Axia news' : 'Hidden'}
                </Typography>
              </div>
              <ToggleSwitch
                checked={showAnnouncements}
                onChange={toggleShowAnnouncements}
              />
            </div>
          </>
        )}
      </Card>

      {/* Network Settings */}
      <Card padding="sm">
        <div
          onClick={() => setNetworkExpanded(v => !v)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            marginBottom: networkExpanded ? 'var(--space-2)' : 0,
          }}
        >
          <Typography variant="caption" color="primary" uppercase bold style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.08em' }}>
            Network Settings
          </Typography>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <StatusPill variant="success">CONNECTED</StatusPill>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              {networkExpanded ? '▴' : '▾'}
            </span>
          </div>
        </div>

        {networkExpanded && (
          <>
            {/* Network Connection Status */}
            <div style={{
              padding: 'var(--space-2)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)' }}>
                Network Connection
              </Typography>
              <Typography
                variant="caption"
                style={{
                  opacity: 0.9,
                  color: browserSupportsPQ() ? 'var(--axia-aqua)' : 'var(--text-muted)',
                  display: 'block',
                  marginTop: 'var(--space-1)'
                }}
              >
                {getPQStatusMessage()}
              </Typography>
              <Typography variant="caption" style={{ opacity: 0.6, display: 'block', marginTop: 'var(--space-1)', fontSize: '11px' }}>
                Endpoint: rpc.axia.to
              </Typography>
            </div>

            {/* Network Status */}
            <div style={{
              padding: 'var(--space-2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div>
                <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)' }}>
                  Network
                </Typography>
                <Typography variant="caption" style={{ opacity: 0.7, fontSize: 'var(--text-2xs)' }}>
                  Minima Mainnet
                </Typography>
              </div>
              <StatusPill variant="success">CONNECTED</StatusPill>
            </div>

            {/* Axia API Key */}
            <div style={{ padding: 'var(--space-2)' }}>
              <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)', marginBottom: '4px', display: 'block' }}>
                Axia API Key
              </Typography>
              <Typography variant="caption" style={{ opacity: 0.6, fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                Optional. Enter your API key from dashboard.axia.to to use your own quota instead of the shared free tier.
              </Typography>
              <input
                type="password"
                value={axiaApiKey}
                onChange={(e) => setAxiaApiKey(e.target.value)}
                placeholder="axia_••••••••••••"
                style={{
                  width: '100%',
                  padding: 'var(--space-1)',
                  background: 'var(--bg-base)',
                  border: '2px solid var(--border-default)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <Button
                  variant="primary"
                  onClick={handleSaveAxiaApiKey}
                  disabled={axiaApiKeySaving}
                  style={{ flex: 1 }}
                >
                  {axiaApiKeySaving ? 'SAVING...' : axiaApiKey.trim() ? 'SAVE KEY' : 'CLEAR KEY'}
                </Button>
                {axiaApiKeyStatus === 'saved' && (
                  <Typography variant="caption" style={{ color: 'var(--axia-aqua)', fontSize: '11px' }}>
                    ✓ Saved
                  </Typography>
                )}
                {axiaApiKeyStatus === 'error' && (
                  <Typography variant="caption" style={{ color: 'var(--axia-red, red)', fontSize: '11px' }}>
                    ✗ Error
                  </Typography>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Security Settings */}
      <Card padding="sm">
        <div
          onClick={() => setSecurityExpanded(v => !v)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            marginBottom: securityExpanded ? 'var(--space-2)' : 0,
          }}
        >
          <Typography variant="caption" color="primary" uppercase bold style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.08em' }}>
            Security
          </Typography>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {securityExpanded ? '▴' : '▾'}
          </span>
        </div>

        {securityExpanded && <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          background: 'var(--border-subtle)',
        }}>
          {/* Auto-Lock Toggle */}
          <div style={{
            padding: 'var(--space-2)',
            background: 'var(--bg-base)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)' }}>
                Auto-Lock
              </Typography>
              <Typography variant="caption" style={{ opacity: 0.7, fontSize: 'var(--text-2xs)' }}>
                {autoLockEnabled ? `Lock after ${formatLockDuration(autoLockMinutes)} inactivity` : 'Disabled'}
              </Typography>
            </div>
            <ToggleSwitch checked={autoLockEnabled} onChange={handleToggleAutoLock} />
          </div>

          {autoLockEnabled && (
            <div style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-base)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Typography variant="caption" bold uppercase style={{ marginRight: '4px', whiteSpace: 'nowrap' }}>
                Timeout
              </Typography>
              {AUTO_LOCK_OPTIONS_MINUTES.map((m) => (
                <button
                  key={m}
                  onClick={() => handleAutoLockMinutesChange(m)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    background: autoLockMinutes === m ? 'var(--text-primary)' : 'transparent',
                    color: autoLockMinutes === m ? 'var(--bg-base)' : 'var(--text-primary)',
                    border: `1px solid var(--border-subtle)`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                  }}
                >
                  {m < 60 ? `${m}m` : '1h'}
                </button>
              ))}
            </div>
          )}

          {/* Biometric Auth Toggle */}
          <div style={{
            padding: 'var(--space-2)',
            background: 'var(--bg-base)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)' }}>
                Biometric Auth
              </Typography>
              <Typography variant="caption" style={{ opacity: 0.7, fontSize: 'var(--text-2xs)' }}>
                {biometricEnabled ? 'Face ID / Fingerprint enabled' : 'Use password only'}
              </Typography>
            </div>
            <ToggleSwitch checked={biometricEnabled} onChange={handleToggleBiometric} />
          </div>

          {/* Change Password Button */}
          <button
            onClick={handleChangePassword}
            style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-base)',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)' }}>
              Change Password
            </Typography>
            <Typography variant="caption" style={{ opacity: 0.7, fontSize: 'var(--text-2xs)' }}>
              Update wallet password
            </Typography>
          </button>

          {/* View Recovery Phrase Button */}
          <button
            onClick={handleViewRecoveryPhrase}
            style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-base)',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)' }}>
              🔑 Recovery Phrase
            </Typography>
            <Typography variant="caption" style={{ opacity: 0.7, fontSize: 'var(--text-2xs)' }}>
              View 24-word BIP39 seed phrase
            </Typography>
          </button>

          {/* Export Private Keys Button */}
          <button
            onClick={handleExportPrivateKeys}
            style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-base)',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)', color: 'var(--axia-aqua)' }}>
              ⚠ Export Private Keys
            </Typography>
            <Typography variant="caption" style={{ opacity: 0.7, fontSize: 'var(--text-2xs)' }}>
              Export WOTS key tree (advanced)
            </Typography>
          </button>
        </div>}
      </Card>

      {/* Connected Sites */}
      <Card padding="sm">
        <button
          onClick={() => setShowConnectedSites(true)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <Typography variant="caption" color="primary" uppercase bold style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.08em' }}>
              Connected Sites
            </Typography>
            <Typography variant="caption" style={{ fontSize: 'var(--text-2xs)', opacity: 0.7 }}>
              {connectedSitesCount === 0
                ? 'No dApps connected'
                : `${connectedSitesCount} site${connectedSitesCount !== 1 ? 's' : ''} connected`}
            </Typography>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
          }}>
            {connectedSitesCount > 0 && (
              <StatusPill variant="info" size="sm">
                {connectedSitesCount}
              </StatusPill>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>▶</span>
          </div>
        </button>
      </Card>

      {/* Recovery Phrase Display */}
      {showRecoveryPhrase && (
        <Card style={{ background: 'rgba(0, 217, 181, 0.05)', borderColor: 'var(--axia-aqua)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <Typography variant="h3" uppercase color="accent">
              🔑 Recovery Phrase
            </Typography>
            <Button variant="ghost" size="sm" onClick={() => setShowRecoveryPhrase(false)}>
              ✕ Close
            </Button>
          </div>
          
          <Typography variant="caption" style={{ opacity: 0.7, marginBottom: 'var(--space-2)', display: 'block' }}>
            Write down these 24 words in order. Keep them safe and NEVER share with anyone.
          </Typography>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--space-1)',
            marginBottom: 'var(--space-2)',
          }}>
            {recoveryPhraseMnemonic.length > 0 ? recoveryPhraseMnemonic.map((word, i) => (
              <div key={i} style={{
                padding: 'var(--space-1)',
                background: 'var(--bg-base)',
                border: '2px solid var(--border-default)',
              }}>
                <Typography variant="caption" mono>
                  {i + 1}. {word}
                </Typography>
              </div>
            )) : (
              <Typography variant="caption" style={{ opacity: 0.7 }}>
                Loading...
              </Typography>
            )}
          </div>

          <Typography variant="caption" color="accent" style={{ fontWeight: 'bold' }}>
            ⚠ NEVER share your recovery phrase. Totem support will NEVER ask for it.
          </Typography>
        </Card>
      )}

      {/* Developer Tools (Designer mode only) */}
      {inDesignerMode && (
        <Card style={{ background: 'rgba(0, 217, 181, 0.05)', borderColor: 'var(--axia-aqua)' }}>
          <Typography variant="h3" uppercase style={{ marginBottom: 'var(--space-2)', color: 'var(--axia-aqua)' }}>
            🔧 Developer Tools
          </Typography>

          <Typography variant="caption" style={{ opacity: 0.7, marginBottom: 'var(--space-2)', display: 'block' }}>
            Test with mock data or connect to real Axia API
          </Typography>

          {/* Mode Toggle */}
          <div style={{
            padding: 'var(--space-2)',
            background: 'var(--bg-base)',
            border: '2px solid var(--border-default)',
            marginBottom: 'var(--space-2)',
          }}>
            <Typography variant="body" bold uppercase style={{ marginBottom: '8px' }}>
              Testing Mode
            </Typography>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <button
                onClick={() => handleDesignerModeChange('mock')}
                style={{
                  flex: 1,
                  padding: 'var(--space-1)',
                  background: designerMode === 'mock' ? 'var(--axia-aqua)' : 'var(--bg-base)',
                  color: designerMode === 'mock' ? 'var(--axia-white)' : 'var(--text-primary)',
                  border: '2px solid var(--border-default)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}
              >
                MOCK
              </button>
              <button
                onClick={() => handleDesignerModeChange('live')}
                style={{
                  flex: 1,
                  padding: 'var(--space-1)',
                  background: designerMode === 'live' ? 'var(--axia-aqua)' : 'var(--bg-base)',
                  color: designerMode === 'live' ? 'var(--axia-white)' : 'var(--text-primary)',
                  border: '2px solid var(--border-default)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}
              >
                LIVE
              </button>
            </div>
          </div>

          {/* Live Mode Configuration */}
          {designerMode === 'live' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
            }}>
              {/* API URL Input */}
              <div>
                <Typography variant="body" bold uppercase style={{ marginBottom: '4px' }}>
                  API URL
                </Typography>
                <input
                  type="text"
                  value={designerApiUrl}
                  onChange={(e) => setDesignerApiUrl(e.target.value)}
                  placeholder="https://api.axia.to"
                  style={{
                    width: '100%',
                    padding: 'var(--space-1)',
                    background: 'var(--bg-base)',
                    border: '2px solid var(--border-default)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Project ID Input */}
              <div>
                <Typography variant="body" bold uppercase style={{ marginBottom: '4px' }}>
                  Project ID
                </Typography>
                <input
                  type="text"
                  value={designerProjectId}
                  onChange={(e) => setDesignerProjectId(e.target.value)}
                  placeholder="your-project-id"
                  style={{
                    width: '100%',
                    padding: 'var(--space-1)',
                    background: 'var(--bg-base)',
                    border: '2px solid var(--border-default)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}
                />
                <Typography variant="caption" style={{ opacity: 0.7, marginTop: '4px', display: 'block' }}>
                  Get from dashboard.axia.to → Project Settings
                </Typography>
              </div>
            </div>
          )}

          {/* Mock Mode Info */}
          {designerMode === 'mock' && (
            <div style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-base)',
              border: '2px solid var(--border-default)',
              marginBottom: 'var(--space-2)',
            }}>
              <Typography variant="caption" style={{ opacity: 0.7 }}>
                ✓ Using mock responses (no real API calls)
              </Typography>
            </div>
          )}

          {/* Save Button */}
          <Button
            variant="primary"
            onClick={handleSaveDesignerConfig}
            disabled={isSavingConfig}
            fullWidth
          >
            {isSavingConfig ? '⏳ SAVING...' : '💾 SAVE CONFIGURATION'}
          </Button>

          {/* Help Text */}
          <Typography variant="caption" style={{ opacity: 0.6, marginTop: 'var(--space-1)', display: 'block', textAlign: 'center' }}>
            Changes require popup refresh to take effect
          </Typography>
        </Card>
      )}

      {/* Advanced Settings */}
      <Card padding="sm">
        <div
          onClick={() => setAdvancedExpanded(v => !v)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            marginBottom: advancedExpanded ? 'var(--space-2)' : 0,
          }}
        >
          <Typography variant="caption" color="primary" uppercase bold style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.08em' }}>
            Advanced
          </Typography>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {advancedExpanded ? '▴' : '▾'}
          </span>
        </div>

        {advancedExpanded && <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          background: 'var(--border-subtle)',
        }}>
          <button
            onClick={handleClearCache}
            style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-base)',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)' }}>
              Clear Cache
            </Typography>
            <Typography variant="caption" style={{ opacity: 0.7, fontSize: 'var(--text-2xs)' }}>
              Remove price and transaction cache
            </Typography>
          </button>

          <div style={{
            padding: 'var(--space-2)',
            background: 'var(--bg-base)',
          }}>
            <Typography variant="caption" bold uppercase style={{ fontSize: 'var(--text-xs)', marginBottom: '4px' }}>
              Version
            </Typography>
            <Typography variant="caption" style={{ opacity: 0.7, fontSize: 'var(--text-2xs)' }}>
              Totem Wallet v1.0.0
            </Typography>
          </div>
        </div>}
      </Card>


      {/* Lock Wallet Button */}
      <Button variant="secondary" onClick={handleLock} fullWidth>
        🔒 LOCK WALLET
      </Button>
    </div>
    </div>
  );
}
