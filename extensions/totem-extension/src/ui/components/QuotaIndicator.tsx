/**
 * Quota Indicator Component
 * Displays daily/monthly quota usage with visual progress bar
 */

import React, { useEffect, useState } from 'react';
import { quotaManager, QuotaInfo } from '../../core/quota/manager';

export function QuotaIndicator() {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    // Subscribe to quota updates
    const unsubscribe = quotaManager.subscribe((info) => {
      setQuota(info);
    });

    // Load initial quota
    const initialQuota = quotaManager.getQuota();
    if (initialQuota) {
      setQuota(initialQuota);
    }

    return unsubscribe;
  }, []);

  if (!quota) {
    return null;
  }

  const isWarning = quota.daily.percentUsed >= 80 && !quota.isExceeded;
  const isDanger = quota.isExceeded;

  return (
    <div className="quota-indicator">
      <div className="quota-header">
        <span className="quota-title">Daily Usage</span>
        <span className="quota-count">
          {quota.daily.remaining} / {quota.daily.limit} requests
        </span>
      </div>
      
      <div className="quota-bar-container">
        <div 
          className={`quota-bar ${isWarning ? 'warning' : ''} ${isDanger ? 'danger' : ''}`}
          style={{ width: `${Math.min(quota.daily.percentUsed, 100)}%` }}
        />
      </div>

      {isWarning && !isDanger && (
        <div className="quota-warning">
          ⚠️ {quota.daily.percentUsed.toFixed(0)}% of daily quota used
        </div>
      )}

      {isDanger && (
        <div className="quota-exceeded">
          ❌ Daily quota exceeded. Resets in {quotaManager.getTimeUntilReset()}
        </div>
      )}

      {quota.monthly && (
        <div className="quota-monthly">
          <span className="quota-monthly-label">Monthly:</span>
          <span className="quota-monthly-count">
            {quota.monthly.remaining.toLocaleString()} / {quota.monthly.limit.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

export function QuotaExceededModal() {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState({
    title: 'Extend your access',
    description: 'Your daily quota has been exceeded.',
    cta_text: 'Create Project',
    cta_url: 'https://app.axia.to/projects/create'
  });

  useEffect(() => {
    const unsubscribe = quotaManager.subscribe((info) => {
      setQuota(info);
    });

    // Load upgrade message from bootstrap config
    chrome.storage.local.get('totem_config', (result) => {
      const config = result.totem_config;
      if (config?.config?.upgrade_messaging) {
        setUpgradeMessage(config.config.upgrade_messaging);
      }
    });

    return unsubscribe;
  }, []);

  if (!quota?.isExceeded) {
    return null;
  }

  const handleUpgrade = () => {
    chrome.tabs.create({ url: upgradeMessage.cta_url });
  };

  const quotaType = quota.exceededType === 'daily' ? 'daily' : 'monthly';
  const resetTime = quotaManager.getTimeUntilReset();

  return (
    <div className="quota-modal-overlay">
      <div className="quota-modal">
        <div className="quota-modal-header">
          <h2>{upgradeMessage.title}</h2>
        </div>
        
        <div className="quota-modal-body">
          <p className="quota-modal-message">
            {upgradeMessage.description}
          </p>
          
          <div className="quota-modal-info">
            <p>
              Your <strong>{quotaType}</strong> quota has been exceeded.
            </p>
            <p>
              Quota resets in <strong>{resetTime}</strong>
            </p>
          </div>

          <div className="quota-modal-stats">
            <div className="quota-stat">
              <span className="quota-stat-label">Daily Limit:</span>
              <span className="quota-stat-value">{quota.daily.limit} requests</span>
            </div>
            {quota.monthly && (
              <div className="quota-stat">
                <span className="quota-stat-label">Monthly Limit:</span>
                <span className="quota-stat-value">{quota.monthly.limit.toLocaleString()} requests</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="quota-modal-footer">
          <button 
            className="quota-upgrade-button"
            onClick={handleUpgrade}
          >
            {upgradeMessage.cta_text}
          </button>
          <p className="quota-modal-note">
            Create a free project in the dashboard for extended access
          </p>
        </div>
      </div>
    </div>
  );
}
