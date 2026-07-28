/**
 * Post-Quantum TLS Browser Detection
 * 
 * Detects if the current browser supports PQ-TLS (X25519+Kyber768)
 * Based on Cloudflare PQ-TLS rollout timeline (2024-2025)
 */

export interface BrowserInfo {
  name: string;
  version: number;
  supportsPQ: boolean;
  displayMessage: string;
}

/**
 * Detect browser and PQ-TLS support
 */
export function detectPQSupport(): BrowserInfo {
  const ua = navigator.userAgent;
  
  // Firefox detection
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    const version = match ? parseInt(match[1], 10) : 0;
    
    // Firefox Android requires 145+, Desktop requires 132+
    const isAndroid = ua.includes('Android');
    const requiredVersion = isAndroid ? 145 : 132;
    const supportsPQ = version >= requiredVersion;
    
    return {
      name: isAndroid ? 'Firefox (Android)' : 'Firefox',
      version,
      supportsPQ,
      displayMessage: supportsPQ
        ? `✓ Quantum-resistant connection active (Firefox ${version})`
        : `Standard connection (Firefox ${version}). Upgrade to Firefox ${requiredVersion}+ for PQ-TLS.`
    };
  }
  
  // Edge detection (Chromium-based)
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    const version = match ? parseInt(match[1], 10) : 0;
    const supportsPQ = version >= 131;
    
    return {
      name: 'Microsoft Edge',
      version,
      supportsPQ,
      displayMessage: supportsPQ
        ? `✓ Quantum-resistant connection active (Edge ${version})`
        : `Standard connection (Edge ${version}). Upgrade to Edge 131+ for PQ-TLS.`
    };
  }
  
  // Brave detection (Chromium-based)
  if (ua.includes('Brave/') || (navigator as any).brave) {
    // Brave doesn't always expose version in UA, use Chrome version as proxy
    const match = ua.match(/Chrome\/(\d+)/);
    const version = match ? parseInt(match[1], 10) : 0;
    const supportsPQ = version >= 131;
    
    return {
      name: 'Brave',
      version,
      supportsPQ,
      displayMessage: supportsPQ
        ? `✓ Quantum-resistant connection active (Brave)`
        : `Standard connection (Brave). Update to latest version for PQ-TLS.`
    };
  }
  
  // Opera detection (Chromium-based)
  if (ua.includes('OPR/') || ua.includes('Opera/')) {
    const match = ua.match(/(?:OPR|Opera)\/(\d+)/);
    const version = match ? parseInt(match[1], 10) : 0;
    // Opera 117+ uses Chromium 131+ (approximate mapping)
    const supportsPQ = version >= 117;
    
    return {
      name: 'Opera',
      version,
      supportsPQ,
      displayMessage: supportsPQ
        ? `✓ Quantum-resistant connection active (Opera ${version})`
        : `Standard connection (Opera ${version}). Upgrade to Opera 117+ for PQ-TLS.`
    };
  }
  
  // Chrome/Chromium detection (catch-all for Chromium-based browsers)
  if (ua.includes('Chrome/') || ua.includes('Chromium/')) {
    const match = ua.match(/(?:Chrome|Chromium)\/(\d+)/);
    const version = match ? parseInt(match[1], 10) : 0;
    const supportsPQ = version >= 131;
    
    const browserName = ua.includes('Chromium/') ? 'Chromium' : 'Chrome';
    
    return {
      name: browserName,
      version,
      supportsPQ,
      displayMessage: supportsPQ
        ? `✓ Quantum-resistant connection active (${browserName} ${version})`
        : `Standard connection (${browserName} ${version}). Upgrade to ${browserName} 131+ for PQ-TLS.`
    };
  }
  
  // Safari detection (PQ-TLS not yet supported as of 2025)
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    const version = match ? parseInt(match[1], 10) : 0;
    
    return {
      name: 'Safari',
      version,
      supportsPQ: false,
      displayMessage: `Standard connection (Safari ${version}). PQ-TLS support coming soon.`
    };
  }
  
  // Unknown browser
  return {
    name: 'Unknown Browser',
    version: 0,
    supportsPQ: false,
    displayMessage: 'Standard connection. Update to Chrome 131+, Firefox 132+, or Edge 131+ for PQ-TLS.'
  };
}

/**
 * Get a simple boolean for whether current browser supports PQ
 */
export function browserSupportsPQ(): boolean {
  return detectPQSupport().supportsPQ;
}

/**
 * Get display message for current browser's PQ status
 */
export function getPQStatusMessage(): string {
  return detectPQSupport().displayMessage;
}
