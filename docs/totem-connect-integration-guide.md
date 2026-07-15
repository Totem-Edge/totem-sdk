# Totem Connect Integration Guide

A guide for web developers integrating the Totem wallet into decentralized applications (dApps) on the Minima network.

## Overview

Totem Connect enables websites to:
1. Connect to user wallets and obtain their address
2. Verify wallet ownership through signed messages (Sign-In With Wallet)
3. Request transaction signatures for on-chain operations (with user approval)

## Quick Start

### 1. Detect the Totem Wallet

Totem announces itself via the `totem:announce` CustomEvent — there is no `window.totem` global. Use `WalletDiscovery` from `@totemsdk/connect`, or listen for the event directly:

```javascript
// Option A — using @totemsdk/connect (recommended)
import { WalletDiscovery } from '@totemsdk/connect';

const discovery = new WalletDiscovery();
const unsubscribe = discovery.onChange((wallets) => {
  if (wallets.length >= 1) {
    const provider = wallets[0].provider;
    onWalletReady(provider);
  }
});

// Option B — raw event (no SDK dependency)
const TOTEM_ANNOUNCE = 'totem:announce';
const TOTEM_REQUEST_ANNOUNCE = 'totem:requestAnnounce';

let provider = null;
window.addEventListener(TOTEM_ANNOUNCE, (event) => {
  provider = event.detail.provider;
});
window.dispatchEvent(new CustomEvent(TOTEM_REQUEST_ANNOUNCE));
```

### 2. Connect to the Wallet

```javascript
async function connectWallet(provider) {
  const response = await provider.request({
    method: 'TOTEM_CONNECT',
    params: {
      origin: window.location.origin
    }
  });
  
  if (response.connected) {
    console.log('Connected address:', response.address);
    console.log('Address index:', response.addressIndex);
    console.log('Public key:', response.publicKey);
    return response;
  }
  
  throw new Error('Connection failed');
}
```

## Wallet Ownership Verification (Sign-In With Wallet)

Verify that a user owns the connected wallet by requesting a signed challenge message. This is the primary authentication mechanism for dApps.

### Request Verification

```javascript
async function verifyWalletOwnership(provider, customStatement) {
  const response = await provider.request({
    method: 'TOTEM_VERIFY',
    params: {
      origin: window.location.origin,
      challenge: {
        statement: customStatement || 'Sign this message to verify wallet ownership',
        // Optional: specify resources the signature grants access to
        resources: ['https://your-app.com/api']
      }
    }
  });
  
  if (response.verified) {
    return {
      address: response.address,
      message: response.message,
      signature: response.signature,
      publicKey: response.publicKey
    };
  }
  
  throw new Error('Verification failed');
}
```

### Verification Response Structure

```javascript
{
  verified: true,
  address: "MxG0...",                    // User's Minima address
  message: "https://your-app.com wants you to sign in...",
  signature: "0x...",                    // WOTS signature (hex)
  publicKey: "0x..."                     // Spend address's root public key (hex)
}
```

### Challenge Message Format

The signed message follows an EIP-4361-inspired format:

```
https://your-app.com wants you to sign in with your Minima account:
MxG0A1B2C3D4E5F6...

Sign this message to verify wallet ownership

URI: https://your-app.com
Chain ID: minima:mainnet
Nonce: abc123def456...
Issued At: 2024-01-01T00:00:00.000Z
Expiration Time: 2024-01-01T00:05:00.000Z
Resources:
- https://your-app.com/api
```

## Complete Integration Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Minima dApp</title>
</head>
<body>
  <div id="app">
    <button id="connectBtn">Connect Wallet</button>
    <button id="verifyBtn" disabled>Verify Ownership</button>
    <button id="sendBtn" disabled>Send 1 Minima</button>
    <div id="status"></div>
    <div id="addressDisplay"></div>
    <input type="text" id="recipientInput" placeholder="Recipient address" />
  </div>

  <script>
    let connectedAddress = null;
    
    // Discover wallet via totem:announce
    let provider = null;
    window.addEventListener('totem:announce', (event) => {
      if (!provider) provider = event.detail.provider;
    });
    window.dispatchEvent(new CustomEvent('totem:requestAnnounce'));

    function getProvider() {
      if (!provider) throw new Error('No Totem-compatible wallet detected');
      return provider;
    }

    // Connect button
    document.getElementById('connectBtn').onclick = async () => {
      try {
        const totem = getProvider();
        const response = await totem.request({
          method: 'TOTEM_CONNECT',
          params: { origin: window.location.origin }
        });
        
        if (response.connected) {
          connectedAddress = response.address;
          document.getElementById('status').textContent = 'Connected!';
          document.getElementById('addressDisplay').textContent = 
            `Address: ${response.address}`;
          document.getElementById('verifyBtn').disabled = false;
          document.getElementById('sendBtn').disabled = false;
          document.getElementById('connectBtn').textContent = 'Reconnect';
        }
      } catch (err) {
        document.getElementById('status').textContent = `Error: ${err.message}`;
      }
    };
    
    // Verify button
    document.getElementById('verifyBtn').onclick = async () => {
      try {
        const totem = getProvider();
        const response = await totem.request({
          method: 'TOTEM_VERIFY',
          params: {
            origin: window.location.origin,
            challenge: { statement: 'Authenticate to access your dashboard' }
          }
        });
        
        if (response.verified) {
          document.getElementById('status').textContent = 'Verified!';
          
          // Send signature to your backend for verification
          console.log('Verification data:', {
            address: response.address,
            signature: response.signature,
            publicKey: response.publicKey,
            message: response.message
          });
          
          // Example: authenticate with your backend
          // const authResult = await fetch('/api/auth/verify', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({
          //     address: response.address,
          //     signature: response.signature,
          //     publicKey: response.publicKey,
          //     message: response.message
          //   })
          // });
        }
      } catch (err) {
        document.getElementById('status').textContent = `Error: ${err.message}`;
      }
    };
    
    // Send button
    document.getElementById('sendBtn').onclick = async () => {
      const recipient = document.getElementById('recipientInput').value;
      if (!recipient) {
        document.getElementById('status').textContent = 'Enter a recipient address';
        return;
      }
      
      try {
        const totem = getProvider();
        const response = await totem.request({
          method: 'TOTEM_SEND_TRANSACTION',
          params: {
            origin: window.location.origin,
            request: {
              version: 1,
              intent: 'send',
              outputs: [{
                address: recipient,
                amount: '1',
                tokenId: '0x00'
              }],
              memo: 'Demo payment'
            }
          }
        });
        
        if (response.success) {
          document.getElementById('status').textContent = 
            `Sent! TX: ${response.txpowid}`;
        } else {
          document.getElementById('status').textContent = 
            `Error: ${response.error}`;
        }
      } catch (err) {
        document.getElementById('status').textContent = `Error: ${err.message}`;
      }
    };
    
    // Check if already installed
    setTimeout(() => {
      if (provider) {
        document.getElementById('status').textContent = 'Totem wallet detected!';
      } else {
        document.getElementById('status').textContent = 
          'Totem wallet not detected. Please install the extension.';
        document.getElementById('connectBtn').disabled = true;
      }
    }, 300);
  </script>
</body>
</html>
```

## Sending Transactions

To send transactions, your dApp must first connect and be granted spending permission by the user.

> **Security**: Every transaction requires explicit user approval in the Totem wallet popup. This is by design - unlike on-chain allowance patterns, Totem signs transactions with the user's primary custody key, so fresh consent is required for each operation. This protects users from compromised dApp sessions and ensures they are always aware of signature leaf consumption.

### Request Transaction

```javascript
async function sendTransaction(provider, to, amount, tokenId = null) {
  const response = await provider.request({
    method: 'TOTEM_SEND_TRANSACTION',
    params: {
      origin: window.location.origin,
      request: {
        version: 1,
        intent: 'send',
        outputs: [{
          address: to,
          amount: amount,
          tokenId: tokenId || '0x00'
        }],
        memo: 'Payment from MyApp'
      }
    }
  });
  
  if (response.success) {
    console.log('Transaction submitted:', response.txpowid);
    return response;
  }
  
  throw new Error(response.error || 'Transaction failed');
}
```

### Transaction Request Structure

```typescript
interface TransactionRequest {
  version: 1;
  intent: 'send' | 'swap' | 'contract_call' | 'custom';
  outputs: TransactionOutput[];
  burn?: string;
  memo?: string;
}

interface TransactionOutput {
  address: string;
  amount: string;
  tokenId?: string;
  state?: { port: number; value: string }[];
}
```

### Transaction Response

```typescript
interface TransactionResponse {
  success: boolean;
  txpowid?: string;
  status?: 'pending' | 'submitted' | 'confirmed' | 'rejected';
  error?: string;
  errorCode?: 'INVALID_REQUEST';
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request validation failed |

## API Reference

### Provider Methods

| Method | Description |
|--------|-------------|
| `TOTEM_CONNECT` | Initiate wallet connection |
| `TOTEM_VERIFY` | Request signed verification message |
| `TOTEM_SEND_TRANSACTION` | Request transaction signature and broadcast |

### Connection Response

```typescript
interface ConnectResponse {
  connected: boolean;
  address?: string;           // Minima address (if connected)
  addressIndex?: number;      // Account index
  publicKey?: string;         // Public key (if connected)
  isReconnect?: boolean;      // true if previously connected
}
```

### Verification Response

```typescript
interface VerifyResponse {
  verified: boolean;
  address: string;
  message: string;            // The full challenge message
  signature: string;          // WOTS signature (hex)
  publicKey: string;          // WOTS public key (hex)
}
```

## Backend Signature Verification

After receiving a verification response, validate the signature on your backend.

> **v4.1:** `TOTEM_VERIFY` signs from the connected spend address, so `verification.publicKey` is the spend address's root public key and `deriveAddress(publicKey) === verification.address` holds. Backends use the high-level `verifySignatureDetailed(address, message, signature, publicKey)` one-liner from `@totemsdk/core`, which internally re-derives the address from `publicKey`, parses the WOTS `TreeSignature`, and verifies it against `sha3_256(message)`. Reject any proof where the helper returns `valid: false`.

```javascript
// Example Node.js backend verification
import { verifySignatureDetailed } from '@totemsdk/core';

async function verifySignature(verificationData) {
  const { address, signature, publicKey, message } = verificationData;

  // 1. Parse the message to extract domain and verify it matches your origin
  const domainMatch = message.match(/^(.+) wants you to sign in/);
  if (!domainMatch || domainMatch[1] !== 'https://your-app.com') {
    throw new Error('Domain mismatch');
  }

  // 2. Check expiration
  const expiresAtMatch = message.match(/Expiration Time: (.+)$/m);
  if (expiresAtMatch) {
    const expiresAt = new Date(expiresAtMatch[1]).getTime();
    if (Date.now() > expiresAt) {
      throw new Error('Signature expired');
    }
  }

  // 3. Verify nonce hasn't been used before (prevent replay attacks)
  const nonceMatch = message.match(/Nonce: (.+)$/m);
  if (nonceMatch) {
    const nonce = nonceMatch[1];
    // if (await isNonceUsed(nonce)) throw new Error('Nonce already used');
    // await markNonceUsed(nonce);
  }

  // 4. Cryptographically verify the WOTS proof — single call. The helper
  //    re-derives the Minima address from `publicKey` and compares it to
  //    `address` (this binding succeeds in v4.1 because the proof signs from
  //    the spend address), then verifies the TreeSignature against
  //    sha3_256(message).
  const result = verifySignatureDetailed(address, message, signature, publicKey);
  if (!result.valid) {
    throw new Error(`Signature verification failed: ${result.error}`);
  }

  return { valid: true, address };
}
```

## Security Considerations

1. **Always verify on your backend**: Never trust client-side verification alone. Send the signature to your server and verify it there.

2. **Check domain binding**: The signed message includes your domain. Verify it matches your expected origin to prevent phishing.

3. **Respect expiration**: Verification signatures expire (default 5 minutes). Check `expiresAt` before trusting.

4. **Nonce uniqueness**: Each challenge includes a unique nonce. Store and check nonces to prevent replay attacks.

5. **HTTPS required**: Always serve your dApp over HTTPS in production.

## Troubleshooting

### Wallet Not Detected

```javascript
// Check if extension is installed — listen for totem:announce
let provider = null;
window.addEventListener('totem:announce', (e) => { provider = e.detail.provider; });
window.dispatchEvent(new CustomEvent('totem:requestAnnounce'));

setTimeout(() => {
  if (!provider) {
    alert('Please install the Totem wallet extension to continue.');
  }
}, 300);
```

### Connection Rejected

```javascript
try {
  await totem.request({ method: 'TOTEM_CONNECT', params: {...} });
} catch (err) {
  if (err.message.includes('rejected')) {
    // User rejected the connection
    console.log('User declined to connect');
  } else if (err.message.includes('not initialized')) {
    // Wallet needs to be set up first
    console.log('Please set up your Totem wallet first');
  }
}
```

### Site Not Connected Error

```javascript
try {
  await totem.request({ method: 'TOTEM_VERIFY', params: {...} });
} catch (err) {
  if (err.message.includes('not connected')) {
    // Need to call TOTEM_CONNECT first
    await totem.request({ 
      method: 'TOTEM_CONNECT', 
      params: { origin: window.location.origin } 
    });
  }
}
```

## Roadmap

The following features may be added in future releases:

- **Token Balance Queries**: Query wallet balances and token holdings
- **Event Subscriptions**: Subscribe to wallet events (connection changes, balance updates)
- **Multi-Output Transactions**: Send to multiple recipients in a single transaction
- **Contract Interactions**: Call custom KISSVM scripts and covenants

These features will be documented here when available.

## Support

For additional support or to report issues:
- GitHub: https://github.com/MrGheek/totem-sdk
- Documentation: https://totem.ing
