/**
 * Totem Background Service Worker
 * Handles extension lifecycle and message passing
 * 
 * SDK Migration: Uses SdkMigrationManager feature flags to choose
 * between SDK and legacy initialization code paths.
 */

import { walletManager } from '../core/wallet';
import { initializeBootstrap } from '../core/config/bootstrap';
import { performStartupRecovery, saveRecoveryStatus } from '../core/recovery/startup';
import { leaseMonitor } from '../core/monitoring/lease';
import { SdkMigrationManager } from '../config/SdkMigrationManager';
import { sdkTelemetry } from '../config/SdkTelemetry';
import { initSdkWallet, createExtensionAdapters } from '../core/sdk/SdkWalletInit';
import { portfolioStreamManager } from '../core/portfolio';
import type { PortfolioStreamListener } from '@totemsdk/realtime';
import { transactionReceiptStore } from '../core/stores/TransactionReceiptStore';
import { watermarkStore } from '../core/stores/WatermarkStore';
import { leaseStore } from '../core/stores/LeaseStore';
import { coinSelectionService, CoinSelectionError } from '../core/transaction/CoinSelectionService';
import { formatMinimaAmount, MINIMA_DECIMALS, TOTEM_CHAIN_ID } from '../constants';
import { sha3_256 } from '@noble/hashes/sha3';
import { parseTxInputs } from '../core/transaction/txParser';
import { setWasmUrl } from '../../../totem-sdk/packages/txpow/src/mine-wasm';
import { validateSignData, computeManifestBlobHash, normalizeAddrToHex as normalizeSignAddr } from '../core/signing/signDataValidator';
import { buildTransaction, type BuildTransactionParams, type SpendableCoinInput, type CoinProofData, parseDecimalToBaseUnits, extractAmountBytesFromCoinProof, extractCoinDataFromCoinProof } from '../core/transaction/MinimaTransactionBuilder';
import { mxToHex, hexToMx } from '../core/utils/minima-base32';
import { connectedSitesStore } from '../core/stores/ConnectedSitesStore';
import { ChallengeBuilder, type VerifyChallenge } from '../core/verify/ChallengeBuilder';
import { serializeTreeSignature, getRootPublicKey, type TreeSignature } from '../../../totem-sdk/packages/core/src/treekey';
import { serializeMMRProof } from '../../../totem-sdk/packages/core/src/mmr';
import { startAnnouncementSubscription } from '../core/announcements/wsSubscriber';
import { scriptFromWotsPk } from '../../../totem-sdk/packages/core/src/script';
import { scriptToAddress } from '../../../totem-sdk/packages/core/src/derive';
import { makeMinimaAddress } from '../../../totem-sdk/packages/core/src/minima32';
import { TxSendLogger, TxSignLogger, generateTxCorrelationId } from '../core/transaction/TxLogger';
import { quotaTracker } from '../core/api/QuotaTracker';

const TX_POLL_INTERVAL = 2000; // 2 seconds
const TX_POLL_TIMEOUT = 120000; // 2 minutes

// =========================================================================
// Local TxPoW Mining Setup
// Set the WASM URL so the miner can fetch it via chrome.runtime.getURL.
// This is a no-op if the extension is not an extension context.
// =========================================================================
try {
  setWasmUrl(chrome.runtime.getURL('miner.wasm'));
} catch { /* non-extension context (tests) – ignore */ }

// Session-level cache for txnDifficulty (5 min TTL)
let cachedTxPowDifficulty: { value: Uint8Array; fetchedAt: number } | null = null;
const TXPOW_DIFFICULTY_CACHE_MS = 300_000;

// =========================================================================
// TOTEM_VERIFY v4.1: signs from the connected spend address (site.addressIndex)
// using its per-address TreeKey, so the proof's publicKey is the spend
// address's root public key — `deriveAddress(publicKey) === address` holds
// and backends can verify via the high-level
// `verifySignatureDetailed(address, message, signature, publicKey)` one-liner.
// The pre-v4.1 reserved auth-address slot (index 63) is gone; no address
// indices are reserved.
// =========================================================================

// =========================================================================
// Singleflight Guard for Service Worker Startup
// Prevents duplicate initialization when multiple events fire concurrently
// (install + startup + rehydration can all trigger in MV3)
// =========================================================================
let startupPromise: Promise<void> | null = null;
let startupCompleted = false;

function ensureStartup(): Promise<void> {
  // Already completed this SW lifetime - skip
  if (startupCompleted) {
    console.log('[Background] Startup already completed, skipping duplicate call');
    return Promise.resolve();
  }
  
  // Already running - return existing promise
  if (startupPromise) {
    console.log('[Background] Startup already in progress, returning existing promise');
    return startupPromise;
  }
  
  // First call - start the sequence
  startupPromise = startupSequenceImpl()
    .then(() => {
      startupCompleted = true;
    })
    .catch((error) => {
      console.error('[Background] Startup sequence failed:', error);
      // Don't mark as completed on failure - allow retry
      startupPromise = null;
      throw error;
    });
  
  return startupPromise;
}

// Price cache for immediate availability
interface PriceCache {
  usd: number;
  change24h: number;
  lastUpdated: number;
}
let cachedPrice: PriceCache | null = null;
const PRICE_CACHE_DURATION = 60000; // 1 minute

// =========================================================================
// Multi-Step Init Session Storage
// Keeps sensitive intermediate data (baseSeedHex) in background only
// UI only receives/sends sessionId, never the actual seed material
// =========================================================================
interface InitSession {
  sessionId: string;
  mnemonic: string;
  baseSeedHex?: string;
  createdAt: number;
}
const initSessions = new Map<string, InitSession>();
const INIT_SESSION_TTL = 300000; // 5 minutes

function generateSessionId(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  return `init_${Date.now()}_${hex}`;
}

function cleanupStaleSessions(): void {
  const now = Date.now();
  for (const [id, session] of initSessions.entries()) {
    if (now - session.createdAt > INIT_SESSION_TTL) {
      console.log('[Background] Cleaning up stale init session:', id);
      initSessions.delete(id);
    }
  }
}

async function prefetchMinimaPrice(): Promise<PriceCache | null> {
  try {
    // Return cached if fresh
    if (cachedPrice && Date.now() - cachedPrice.lastUpdated < PRICE_CACHE_DURATION) {
      console.log('[Background] Using cached price:', cachedPrice.usd);
      return cachedPrice;
    }
    
    console.log('[Background] Pre-fetching MINIMA price from CoinGecko...');
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=minima&vs_currencies=usd&include_24hr_change=true';
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data.minima && typeof data.minima.usd === 'number') {
        cachedPrice = {
          usd: data.minima.usd,
          change24h: data.minima.usd_24h_change || 0,
          lastUpdated: Date.now()
        };
        console.log('[Background] Price pre-fetched:', cachedPrice.usd);
        return cachedPrice;
      }
    }
    
    // Fallback price
    cachedPrice = { usd: 0.0234, change24h: 0, lastUpdated: Date.now() };
    return cachedPrice;
  } catch (error) {
    console.error('[Background] Price prefetch failed:', error);
    if (!cachedPrice) {
      cachedPrice = { usd: 0.0234, change24h: 0, lastUpdated: Date.now() };
    }
    return cachedPrice;
  }
}

/**
 * Background polling for transaction confirmation
 * Updates TransactionReceiptStore when transaction is confirmed
 */
async function pollTransactionConfirmation(txpowid: string): Promise<void> {
  const startTime = Date.now();
  
  console.log('[Background] Starting confirmation poll for:', txpowid);
  
  const poll = async () => {
    if (Date.now() - startTime > TX_POLL_TIMEOUT) {
      console.log('[Background] Polling timeout for:', txpowid);
      return;
    }
    
    try {
      const storage = await chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID']);
      const baseUrl = storage.AXIA_BASE || 'https://api.axia.to';
      const projectId = storage.AXIA_PROJECT_ID || 'totem-shared';
      
      const rpcRequest = {
        jsonrpc: '2.0',
        method: 'txpow',
        params: { txpowid },
        id: Date.now()
      };
      
      const response = await fetch(`${baseUrl}/v1/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': projectId
        },
        body: JSON.stringify(rpcRequest)
      });
      
      const data = await response.json();
      
      if (data.result && !data.error) {
        const txpowData = data.result;
        console.log('[Background] Transaction found by node:', txpowid, 'isblock:', txpowData.isblock, 'istransaction:', txpowData.istransaction);
        
        await transactionReceiptStore.markConfirmed(
          txpowid,
          txpowData.header?.block,
          1
        );
        
        chrome.runtime.sendMessage({
          type: 'TX_CONFIRMED',
          txpowid,
          blockHeight: txpowData.header?.block
        }).catch(() => {});
        
        return;
      }
      
      // Continue polling
      setTimeout(poll, TX_POLL_INTERVAL);
      
    } catch (error) {
      console.warn('[Background] Poll error for', txpowid, error);
      setTimeout(poll, TX_POLL_INTERVAL);
    }
  };
  
  // Start polling after a short delay
  setTimeout(poll, TX_POLL_INTERVAL);
}

interface TxApprovalParams {
  origin: string;
  to: string;
  amount: string;
  tokenId: string;
  intent?: string;
  mode?: 'build' | 'submit' | 'broadcast';
}

const pendingApprovalCallbacks = new Map<number, (approved: boolean) => void>();

const pendingPermissionCallbacks = new Map<number, (approved: boolean) => void>();

const windowRemoveListeners = new Map<number, () => void>();

interface PendingPermissionRequest {
  origin: string;
  allowedIntents: string[];
  expiresInDays: number;
  tokenLimits?: Array<{ tokenId: string; tokenSymbol: string; maxAmountPerTx: string; maxDailyAmount: string }>;
}

let pendingPermissionRequest: PendingPermissionRequest | null = null;

interface PendingVerification {
  challenge: VerifyChallenge;
  rawMessage: string;
  addressIndex: number;
  minimaAddress: string;
  origin: string;
  wotsIndices?: { l1: number; l2: number };
  capacity?: {
    used: number;
    total: number;
    remaining: number;
    percentage: number;
    level: 'ok' | 'warning' | 'critical' | 'exhausted';
  };
  resolveCallback?: (approved: boolean) => void;
}

let pendingVerifyChallenge: PendingVerification | null = null;

const pendingVerifyCallbacks = new Map<number, (approved: boolean) => void>();

interface PendingProveOwnershipRequest {
  origin: string;
  rootAddress: string;
  childAddresses: string[];
  childIndices: number[];
  resolveCallback?: (approved: boolean) => void;
}

let pendingProveOwnershipRequest: PendingProveOwnershipRequest | null = null;
const pendingProveOwnershipCallbacks = new Map<number, (approved: boolean) => void>();

interface PendingConnection {
  origin: string;
  accounts: Array<{ index: number; address: string; balance: string; name?: string }>;
  resolveCallback?: (selectedIndex: number | null) => void;
}

let pendingConnectRequest: PendingConnection | null = null;

const pendingConnectCallbacks = new Map<number, (selectedIndex: number | null) => void>();

let pendingUnlockRequest: { reason: string; resolveCallback: (unlocked: boolean) => void } | null = null;
const pendingUnlockCallbacks = new Map<number, (unlocked: boolean) => void>();

async function showConnectApprovalPopup(pendingConnect: PendingConnection): Promise<number | null> {
  return new Promise((resolve) => {
    pendingConnectRequest = { ...pendingConnect, resolveCallback: resolve };
    
    const approvalUrl = chrome.runtime.getURL('connect.html');
    
    chrome.windows.create({
      url: approvalUrl,
      type: 'popup',
      width: 400,
      height: 600,
      focused: true
    }, (window) => {
      if (window?.id) {
        console.log('[Background] Opened connect approval popup, windowId:', window.id);
        pendingConnectCallbacks.set(window.id, resolve);
        
        const removedListener = (windowId: number) => {
          if (windowId === window.id) {
            if (pendingConnectCallbacks.has(windowId)) {
              console.log('[Background] Connect approval window closed without response');
              pendingConnectCallbacks.delete(windowId);
              pendingConnectRequest = null;
              resolve(null);
            }
            chrome.windows.onRemoved.removeListener(removedListener);
            windowRemoveListeners.delete(windowId);
          }
        };
        windowRemoveListeners.set(window.id, () => {
          chrome.windows.onRemoved.removeListener(removedListener);
        });
        chrome.windows.onRemoved.addListener(removedListener);
      } else {
        console.error('[Background] Failed to open connect approval popup');
        pendingConnectRequest = null;
        resolve(null);
      }
    });
  });
}

async function showProveOwnershipPopup(req: PendingProveOwnershipRequest): Promise<boolean> {
  return new Promise((resolve) => {
    pendingProveOwnershipRequest = { ...req, resolveCallback: resolve };

    const approvalUrl = chrome.runtime.getURL('prove-ownership.html');

    chrome.windows.create({
      url: approvalUrl,
      type: 'popup',
      width: 400,
      height: 580,
      focused: true,
    }, (window) => {
      if (window?.id) {
        console.log('[Background] Opened prove-ownership popup, windowId:', window.id);
        pendingProveOwnershipCallbacks.set(window.id, resolve);

        const removedListener = (windowId: number) => {
          if (windowId === window.id) {
            if (pendingProveOwnershipCallbacks.has(windowId)) {
              console.log('[Background] Prove-ownership window closed without response');
              pendingProveOwnershipCallbacks.delete(windowId);
              pendingProveOwnershipRequest = null;
              resolve(false);
            }
            chrome.windows.onRemoved.removeListener(removedListener);
            windowRemoveListeners.delete(windowId);
          }
        };
        windowRemoveListeners.set(window.id, () => {
          chrome.windows.onRemoved.removeListener(removedListener);
        });
        chrome.windows.onRemoved.addListener(removedListener);
      } else {
        console.error('[Background] Failed to open prove-ownership popup');
        pendingProveOwnershipRequest = null;
        resolve(false);
      }
    });
  });
}

async function showVerifyApprovalPopup(pendingVerify: PendingVerification): Promise<boolean> {
  return new Promise((resolve) => {
    pendingVerifyChallenge = { ...pendingVerify, resolveCallback: resolve };
    
    const approvalUrl = chrome.runtime.getURL('verify.html');
    
    chrome.windows.create({
      url: approvalUrl,
      type: 'popup',
      width: 400,
      height: 650,
      focused: true
    }, (window) => {
      if (window?.id) {
        console.log('[Background] Opened verify approval popup, windowId:', window.id);
        pendingVerifyCallbacks.set(window.id, resolve);
        
        const removedListener = (windowId: number) => {
          if (windowId === window.id) {
            if (pendingVerifyCallbacks.has(windowId)) {
              console.log('[Background] Verify approval window closed without response');
              pendingVerifyCallbacks.delete(windowId);
              pendingVerifyChallenge = null;
              resolve(false);
            }
            chrome.windows.onRemoved.removeListener(removedListener);
            windowRemoveListeners.delete(windowId);
          }
        };
        windowRemoveListeners.set(window.id, () => {
          chrome.windows.onRemoved.removeListener(removedListener);
        });
        chrome.windows.onRemoved.addListener(removedListener);
      } else {
        console.error('[Background] Failed to open verify approval popup');
        pendingVerifyChallenge = null;
        resolve(false);
      }
    });
  });
}

async function showUnlockPopup(reason: string): Promise<boolean> {
  return new Promise((resolve) => {
    pendingUnlockRequest = { reason, resolveCallback: resolve };

    const approvalUrl = chrome.runtime.getURL('unlock.html');

    chrome.windows.create({
      url: approvalUrl,
      type: 'popup',
      width: 400,
      height: 400,
      focused: true
    }, (window) => {
      if (window?.id) {
        console.log('[Background] Opened unlock popup, windowId:', window.id);
        pendingUnlockCallbacks.set(window.id, resolve);

        const removedListener = (windowId: number) => {
          if (windowId === window.id) {
            if (pendingUnlockCallbacks.has(windowId)) {
              console.log('[Background] Unlock popup window closed without response');
              pendingUnlockCallbacks.delete(windowId);
              pendingUnlockRequest = null;
              resolve(false);
            }
            chrome.windows.onRemoved.removeListener(removedListener);
            windowRemoveListeners.delete(windowId);
          }
        };
        windowRemoveListeners.set(window.id, () => {
          chrome.windows.onRemoved.removeListener(removedListener);
        });
        chrome.windows.onRemoved.addListener(removedListener);
      } else {
        console.error('[Background] Failed to open unlock popup');
        pendingUnlockRequest = null;
        resolve(false);
      }
    });
  });
}

let pendingUnlockPromise: Promise<boolean> | null = null;

async function ensureUnlocked(reason: string): Promise<boolean> {
  const walletState = walletManager.getState();
  if (!walletState.locked) {
    return true;
  }
  if (pendingUnlockPromise) {
    return pendingUnlockPromise;
  }
  const displayReason = walletManager.isSessionExpired()
    ? `Session expired (extension was idle) — please re-enter your password to continue. ${reason}`
    : reason;
  pendingUnlockPromise = showUnlockPopup(displayReason).finally(() => {
    pendingUnlockPromise = null;
  });
  return pendingUnlockPromise;
}

async function showTransactionApprovalPopup(params: TxApprovalParams): Promise<boolean> {
  return new Promise((resolve) => {
    const approvalUrl = chrome.runtime.getURL('approval/tx.html');
    const urlParams = new URLSearchParams({
      to: params.to,
      amount: params.amount,
      origin: params.origin,
      tokenId: params.tokenId,
      intent: params.intent || 'send',
      mode: params.mode || 'submit'
    });
    
    chrome.windows.create({
      url: `${approvalUrl}?${urlParams.toString()}`,
      type: 'popup',
      width: 400,
      height: 600,
      focused: true
    }, (window) => {
      if (window?.id) {
        console.log('[Background] Opened tx approval popup, windowId:', window.id);
        pendingApprovalCallbacks.set(window.id, resolve);
        
        const removedListener = (windowId: number) => {
          if (windowId === window.id) {
            if (pendingApprovalCallbacks.has(windowId)) {
              console.log('[Background] Tx approval window closed without response');
              pendingApprovalCallbacks.delete(windowId);
              resolve(false);
            }
            chrome.windows.onRemoved.removeListener(removedListener);
            windowRemoveListeners.delete(windowId);
          }
        };
        windowRemoveListeners.set(window.id, () => {
          chrome.windows.onRemoved.removeListener(removedListener);
        });
        chrome.windows.onRemoved.addListener(removedListener);
      } else {
        console.error('[Background] Failed to open tx approval popup');
        resolve(false);
      }
    });
  });
}

async function showPermissionApprovalPopup(req: PendingPermissionRequest): Promise<boolean> {
  return new Promise((resolve) => {
    pendingPermissionRequest = req;
    const approvalUrl = chrome.runtime.getURL('approval/permissions.html');
    chrome.windows.create({
      url: approvalUrl,
      type: 'popup',
      width: 400,
      height: 640,
      focused: true
    }, (window) => {
      if (window?.id) {
        console.log('[Background] Opened permission approval popup, windowId:', window.id);
        pendingPermissionCallbacks.set(window.id, resolve);
        const removedListener = (windowId: number) => {
          if (windowId === window.id) {
            if (pendingPermissionCallbacks.has(windowId)) {
              console.log('[Background] Permission approval window closed without response');
              pendingPermissionCallbacks.delete(windowId);
              resolve(false);
            }
            chrome.windows.onRemoved.removeListener(removedListener);
            windowRemoveListeners.delete(windowId);
          }
        };
        windowRemoveListeners.set(window.id, () => {
          chrome.windows.onRemoved.removeListener(removedListener);
        });
        chrome.windows.onRemoved.addListener(removedListener);
      } else {
        console.error('[Background] Failed to open permission approval popup');
        pendingPermissionRequest = null;
        resolve(false);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'permissions-approval') {
    const windowId = sender.tab?.windowId || message.windowId;
    console.log('[Background] Received permissions-approval response:', { approved: message.approved, windowId });
    const callback = pendingPermissionCallbacks.get(windowId);
    if (callback) {
      pendingPermissionCallbacks.delete(windowId);
      const cleanupListener = windowRemoveListeners.get(windowId);
      if (cleanupListener) {
        cleanupListener();
        windowRemoveListeners.delete(windowId);
      }
      callback(message.approved === true);
    }
    pendingPermissionRequest = null;
  }

  if (message.method === 'permissions:getPending') {
    sendResponse({ result: pendingPermissionRequest });
    return true;
  }

  if (message.type === 'tx-approval') {
    const windowId = sender.tab?.windowId || message.windowId;
    console.log('[Background] Received tx-approval response:', { approved: message.approved, windowId });
    
    const callback = pendingApprovalCallbacks.get(windowId);
    if (callback) {
      pendingApprovalCallbacks.delete(windowId);
      
      const cleanupListener = windowRemoveListeners.get(windowId);
      if (cleanupListener) {
        cleanupListener();
        windowRemoveListeners.delete(windowId);
      }
      
      callback(message.approved === true);
    }
  }
  
  if (message.type === 'prove-ownership-approval') {
    const windowId = sender.tab?.windowId || message.windowId;
    console.log('[Background] Received prove-ownership-approval response:', { approved: message.approved, windowId });

    const callback = pendingProveOwnershipCallbacks.get(windowId);
    if (callback) {
      pendingProveOwnershipCallbacks.delete(windowId);

      const cleanupListener = windowRemoveListeners.get(windowId);
      if (cleanupListener) {
        cleanupListener();
        windowRemoveListeners.delete(windowId);
      }

      callback(message.approved === true);
    }
    pendingProveOwnershipRequest = null;
  }

  if (message.method === 'proveOwnership:getPending') {
    console.log('[Background] proveOwnership:getPending called, pending:', !!pendingProveOwnershipRequest);
    if (pendingProveOwnershipRequest) {
      sendResponse({
        ok: true,
        result: {
          origin: pendingProveOwnershipRequest.origin,
          rootAddress: pendingProveOwnershipRequest.rootAddress,
          childAddresses: pendingProveOwnershipRequest.childAddresses,
          childIndices: pendingProveOwnershipRequest.childIndices,
        },
      });
    } else {
      sendResponse({ ok: false, error: 'No pending prove-ownership request' });
    }
    return true;
  }

  if (message.type === 'verify-approval') {
    const windowId = sender.tab?.windowId || message.windowId;
    console.log('[Background] Received verify-approval response:', { approved: message.approved, windowId });
    
    const callback = pendingVerifyCallbacks.get(windowId);
    if (callback) {
      pendingVerifyCallbacks.delete(windowId);
      
      const cleanupListener = windowRemoveListeners.get(windowId);
      if (cleanupListener) {
        cleanupListener();
        windowRemoveListeners.delete(windowId);
      }
      
      callback(message.approved === true);
    }
    pendingVerifyChallenge = null;
  }
  
  if (message.method === 'verify:getChallenge') {
    console.log('[Background] verify:getChallenge called, pending:', !!pendingVerifyChallenge);
    if (pendingVerifyChallenge) {
      sendResponse({
        ok: true,
        result: {
          challenge: pendingVerifyChallenge.challenge,
          rawMessage: pendingVerifyChallenge.rawMessage,
          addressIndex: pendingVerifyChallenge.addressIndex,
          minimaAddress: pendingVerifyChallenge.minimaAddress,
          origin: pendingVerifyChallenge.origin,
          wotsIndices: pendingVerifyChallenge.wotsIndices,
          capacity: pendingVerifyChallenge.capacity
        }
      });
    } else {
      sendResponse({ ok: false, error: 'No pending verification request' });
    }
    return true;
  }

  if (message.type === 'unlock-approval') {
    const windowId = sender.tab?.windowId || message.windowId;
    console.log('[Background] Received unlock-approval response:', { approved: message.approved, windowId });

    const callback = pendingUnlockCallbacks.get(windowId);
    if (callback) {
      pendingUnlockCallbacks.delete(windowId);

      const cleanupListener = windowRemoveListeners.get(windowId);
      if (cleanupListener) {
        cleanupListener();
        windowRemoveListeners.delete(windowId);
      }

      callback(message.approved === true);
    }
    pendingUnlockRequest = null;
  }

  if (message.method === 'unlock:getPending') {
    console.log('[Background] unlock:getPending called, pending:', !!pendingUnlockRequest);
    if (pendingUnlockRequest) {
      sendResponse({
        ok: true,
        result: {
          reason: pendingUnlockRequest.reason
        }
      });
    } else {
      sendResponse({ ok: false, error: 'No pending unlock request' });
    }
    return true;
  }

  if (message.type === 'connect-approval') {
    const windowId = sender.tab?.windowId || message.windowId;
    console.log('[Background] Received connect-approval response:', { approved: message.approved, addressIndex: message.addressIndex, windowId });
    
    const callback = pendingConnectCallbacks.get(windowId);
    if (callback) {
      pendingConnectCallbacks.delete(windowId);
      
      const cleanupListener = windowRemoveListeners.get(windowId);
      if (cleanupListener) {
        cleanupListener();
        windowRemoveListeners.delete(windowId);
      }
      
      callback(message.approved ? message.addressIndex : null);
    }
    pendingConnectRequest = null;
  }

  if (message.method === 'connect:getPending') {
    console.log('[Background] connect:getPending called, pending:', !!pendingConnectRequest);
    if (pendingConnectRequest) {
      sendResponse({
        ok: true,
        result: {
          origin: pendingConnectRequest.origin,
          accounts: pendingConnectRequest.accounts
        }
      });
    } else {
      sendResponse({ ok: false, error: 'No pending connection request' });
    }
    return true;
  }
});

async function bootstrapInit() {
  try {
    const config = await initializeBootstrap();
    console.log('✅ Bootstrap initialized:', {
      project_id: config.AXIA_PROJECT_ID,
      base: config.AXIA_BASE
    });
    return config;
  } catch (error) {
    console.error('❌ Failed to initialize bootstrap:', error);
  }
}

async function legacyStartupRecovery() {
  const recoveryReport = await performStartupRecovery();
  await saveRecoveryStatus(recoveryReport);

  leaseMonitor.start();
  
  leaseMonitor.onExpiry((event) => {
    console.warn('[Background] ⚠ Lease expiring soon:', {
      leaseId: event.leaseId,
      remainingSeconds: Math.round(event.remainingMs / 1000)
    });
  });
  
  return recoveryReport;
}

async function sdkStartupRecovery(projectId: string) {
  const adapters = createExtensionAdapters(projectId);
  
  const result = await initSdkWallet({
    publicKey: '',
    projectId,
    adapters,
  });
  
  await saveRecoveryStatus({
    watermarkLoaded: result.recoveryReport.watermarkLoaded,
    leasesRehydrated: result.recoveryReport.leasesRehydrated,
    expiredLeasesClean: result.recoveryReport.expiredLeasesCleaned,
    activeLeasesRecovered: result.recoveryReport.activeLeasesRecovered,
    timestamp: Date.now(),
    errors: [],
  });
  
  return result.recoveryReport;
}

/**
 * Internal startup sequence implementation
 * Called via ensureStartup() singleflight guard
 */
async function startupSequenceImpl() {
  const config = await bootstrapInit();
  const projectId = config?.AXIA_PROJECT_ID || 'totem-shared';
  
  // Restore session state after service worker restart (MV3)
  // This detects if wallet was unlocked when service worker died
  const sessionState = await walletManager.restoreSession();
  console.log(`[Background] Session restore result: ${sessionState}`);
  
  // Auto-resume interrupted address generation
  // This runs on every SW start to catch interrupted generation from previous session
  try {
    await walletManager.autoResumeGenerationOnStartup();
  } catch (resumeError) {
    console.error('[Background] Auto-resume generation failed:', resumeError);
  }
  
  const effectiveMode = await SdkMigrationManager.getEffectiveMode();
  
  console.log(`[Background] Starting with mode: ${effectiveMode}`);
  
  await sdkTelemetry.startInit(effectiveMode);
  
  try {
    if (effectiveMode === 'sdk') {
      await sdkStartupRecovery(projectId);
    } else {
      await legacyStartupRecovery();
    }
    
    await sdkTelemetry.endInit(true);
    console.log(`[Background] ✅ Startup complete (${effectiveMode} mode)`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await sdkTelemetry.endInit(false, errorMessage);
    
    if (effectiveMode === 'sdk') {
      console.warn('[Background] SDK init failed, falling back to legacy mode');
      
      try {
        await sdkTelemetry.startInit('legacy');
        await legacyStartupRecovery();
        await sdkTelemetry.endInit(true);
        console.log('[Background] ✅ Legacy fallback successful');
      } catch (legacyError) {
        const legacyErrorMsg = legacyError instanceof Error ? legacyError.message : String(legacyError);
        await sdkTelemetry.endInit(false, legacyErrorMsg);
        console.error('[Background] ❌ Both SDK and legacy init failed:', legacyError);
      }
    } else {
      console.error('[Background] ❌ Legacy init failed:', error);
    }
  }
}

// Top-level startup initialization
// This runs on EVERY service worker start: install, browser restart, AND MV3 rehydration
// Uses ensureStartup() singleflight guard to prevent duplicate concurrent runs
void ensureStartup();

// Start announcement subscription on every service worker load
// This ensures real-time updates for existing sessions after extension updates
// Uses internal idempotency guard to prevent duplicate subscriptions
startAnnouncementSubscription();

// Extension installation - clear storage on fresh install to ensure clean state
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`Totem Extension ${details.reason}:`, details);
  
  if (details.reason === 'install') {
    console.log('[Fresh Install] Clearing all local storage for clean wallet state');
    await chrome.storage.local.clear();
    console.log('[Fresh Install] Storage cleared - wallet will be created fresh');
  }
  
  await connectedSitesStore.initialize();
  console.log('[ConnectedSites] Store initialized on install');
  // PortfolioStreamManager initializes lazily from chrome.storage.local on demand.
  chrome.alarms.create('totem-balance-keepalive', { periodInMinutes: 1 });
  console.log('[BalanceKeepalive] Alarm created on install');
});

// Extension startup (browser restart)
chrome.runtime.onStartup.addListener(async () => {
  console.log('Totem Extension starting up');
  await connectedSitesStore.initialize();
  console.log('[ConnectedSites] Store initialized on startup');
  // PortfolioStreamManager initializes lazily from chrome.storage.local on demand.
  chrome.alarms.create('totem-balance-keepalive', { periodInMinutes: 1 });
  console.log('[BalanceKeepalive] Alarm created on startup');
});

// Chrome alarms listener - handles keep-alive for background address generation and balance refresh
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'totem-address-generation-keepalive') {
    await walletManager.handleGenerationKeepaliveAlarm();
  } else if (alarm.name === 'totem-balance-keepalive') {
    if (portfolioStreamManager.isCurrentlyStreaming()) {
      portfolioStreamManager.forceRefresh().catch(() => {});
    }
  }
});

// v4.0.0: dApp-facing balanceChanged events are suppressed.
// Totem Wallet is a consent and signing provider — not a balance oracle.
// DApps must use Axia API (/v1/balance/:address, /v1/portfolio/:address, or
// the WebSocket stream at /v1/wallet/balance/ws) for live balance updates.
// The BalanceStreamManager still runs internally to keep the extension popup
// accurate; it is only the broadcast to external dApp page tabs that is removed.
//
// window.totem.on('balanceChanged', handler) may register harmlessly on the dApp side
// but the handler will never fire because no events are emitted to dApp tabs.

function normalizeToHex(addr: string): string {
  if (!addr) return '';
  if (addr.startsWith('Mx') || addr.startsWith('mx')) return mxToHex(addr).toLowerCase();
  return addr.toLowerCase();
}

function ensureMx(addr: string): string {
  if (!addr) return '';
  if (addr.startsWith('Mx') || addr.startsWith('mx')) return addr;
  if (addr.startsWith('0x') || addr.startsWith('0X')) return hexToMx(addr);
  return addr;
}

const DAPP_ALLOWED_METHODS = new Set([
  'TOTEM_CONNECT',
  // TOTEM_CONNECT_APPROVE is intentionally excluded — internal extension-only.
  'TOTEM_VERIFY',
  'TOTEM_GET_ACCOUNTS',
  'TOTEM_DISCONNECT',
  'TOTEM_SEND_TRANSACTION',
  'TOTEM_GRANT_TX_PERMISSION',
  'TOTEM_REVOKE_TX_PERMISSION',
  'TOTEM_GET_TX_PERMISSIONS',
  'TOTEM_GET_COINS',
  'TOTEM_SEND_COMPLEX',
  'TOTEM_SIGN_DATA',
  'TOTEM_BROADCAST_HEX',
  /**
   * TOTEM_PROVE_OWNERSHIP — requests a cross-address Root Identity ownership proof.
   * Available for all wallets using the unified hierarchical key derivation scheme.
   * Params: { childIndices: number[] }
   * Returns: OwnershipProof
   */
  'TOTEM_PROVE_OWNERSHIP',
]);

function isDAppSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
  return sender?.tab !== undefined && sender?.tab !== null;
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse);
  return true; // Indicates async response
});

async function handleMessage(request: any, sender: chrome.runtime.MessageSender) {
  const { method, params, id, type } = request;
  const messageType = type || method; // Support both 'type' and 'method' for compatibility

  if (isDAppSender(sender) && !DAPP_ALLOWED_METHODS.has(messageType)) {
    console.warn('[Background] Blocked DApp message:', messageType, 'from tab:', sender.tab?.url);
    return { ok: false, error: 'Method not allowed for DApp callers', id };
  }
  
  switch (messageType) {
    case 'balance:replay':
      await portfolioStreamManager.triggerReplay();
      return { ok: true, id };

    case 'ui:isInitialized':
      // Check for actual encrypted seed, not just walletSetup flag
      const hasWallet = await walletManager.hasEncryptedSeed();
      return { ok: true, result: { ok: hasWallet }, id };
    
    case 'wallet:getState':
      try {
        const state = await walletManager.getStateAsync();
        return { ok: true, result: state, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:getGenerationStatus':
      // Always complete — on-demand model
      return { ok: true, result: { isComplete: true, addressCount: walletManager.getAvailableAddressCount(), isActive: false }, id };

    case 'wallet:addNextAddress':
      try {
        const newAccount = await walletManager.addNextAddress();
        return { ok: true, account: newAccount, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }

    case 'wallet:setActiveAccount':
      try {
        await chrome.storage.local.set({ selectedAccountIndex: request.index ?? 0 });
        return { ok: true, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }

    case 'wallet:getActiveAccount':
      try {
        const s = await chrome.storage.local.get(['selectedAccountIndex', 'walletAddresses']);
        const idx = (s.selectedAccountIndex as number) ?? 0;
        const accs = (s.walletAddresses as any[]) || [];
        return { ok: true, account: accs[idx] ?? accs[0] ?? null, index: idx, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }

    case 'activity:getTransactions':
      try {
        const txStorage = await chrome.storage.local.get(['walletAddresses', 'AXIA_PROJECT_ID', 'AXIA_API_BASE_URL']);
        const txAddresses: string[] = ((txStorage.walletAddresses as any[]) || []).map((a: any) => a.address);
        const txProjectId = (txStorage.AXIA_PROJECT_ID as string) || 'totem-shared';
        const txBaseUrl = (txStorage.AXIA_API_BASE_URL as string) || 'https://api.axia.to';
        const txLimit = (request.limit as number) || 50;
        if (txAddresses.length === 0) return { ok: true, events: [], id };
        const txResults = await Promise.all(
          txAddresses.map(async (addr: string) => {
            try {
              const res = await fetch(`${txBaseUrl}/v1/wallet/transactions/${addr}?limit=${txLimit}`, {
                headers: { 'x-api-key': txProjectId },
              });
              if (!res.ok) return [];
              const data = await res.json();
              return ((data.events || []) as any[]).map((e: any) => ({ ...e, localAddress: addr }));
            } catch { return []; }
          })
        );
        const seen = new Set<string>();
        const merged = txResults.flat().filter((e: any) => {
          const key = `${e.txpowid}:${e.coinid}:${e.event_type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        merged.sort((a: any, b: any) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
        return { ok: true, events: merged.slice(0, txLimit), id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:generateMnemonic':
      try {
        const mnemonic = walletManager.generateNewMnemonic();
        return { ok: true, result: { mnemonic }, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:exportMnemonic':
      try {
        const password = params[0];
        const mnemonic = await walletManager.exportMnemonic(password);
        return { ok: true, result: { mnemonic }, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:create':
      try {
        const result = await walletManager.createWallet(params[0]);
        // Mark wallet as initialized
        await chrome.storage.local.set({ walletSetup: true });
        console.log('[Background] Wallet created and walletSetup flag stored');
        // Pre-fetch price in background (don't await - let it run async)
        prefetchMinimaPrice().catch(e => console.warn('[Background] Price prefetch failed:', e));
        return { ok: true, result, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:import':
      try {
        console.log('[Background] wallet:import called with params:', params.length);
        const result = await walletManager.importWallet(params[0], params[1]);
        // Mark wallet as initialized
        await chrome.storage.local.set({ walletSetup: true });
        console.log('[Background] ✓ Wallet imported successfully, walletSetup flag stored');
        console.log('[Background] First address:', result.address);
        // Pre-fetch price in background (don't await - let it run async)
        prefetchMinimaPrice().catch(e => console.warn('[Background] Price prefetch failed:', e));
        return { ok: true, result, id };
      } catch (error: any) {
        // Log full error details for debugging
        console.error('[Background] ✗ wallet:import failed:', error.message);
        console.error('[Background] Error stack:', error.stack);
        
        return { ok: false, error: error.message, id };
      }
    
    // =========================================================================
    // Multi-Step Wallet Initialization
    // These handlers break wallet creation into smaller steps to avoid
    // Chrome extension message channel timeouts.
    // SECURITY: Sensitive data (mnemonic, baseSeedHex) stays in background.
    // UI only receives/sends sessionId as a reference.
    // =========================================================================
    
    case 'wallet:init:step1':
      try {
        cleanupStaleSessions();
        console.log('[Background] wallet:init:step1 - Validating mnemonic...');
        const validationResult = walletManager.initStep1_ValidateMnemonic(params?.mnemonic);
        if (!validationResult.valid) {
          return { ok: true, result: { valid: false, error: validationResult.error }, id };
        }
        const sessionId = generateSessionId();
        initSessions.set(sessionId, {
          sessionId,
          mnemonic: validationResult.mnemonic,
          createdAt: Date.now()
        });
        console.log('[Background] Step 1 complete, sessionId:', sessionId);
        return { ok: true, result: { valid: true, sessionId }, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:init:step2':
      try {
        console.log('[Background] wallet:init:step2 - Deriving key (PBKDF2)...');
        const session2 = initSessions.get(params.sessionId);
        if (!session2) {
          return { ok: false, error: 'Invalid or expired session', id };
        }
        await walletManager.initStep2_DeriveKey(params.password);
        console.log('[Background] Step 2 complete');
        return { ok: true, result: { ok: true }, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:init:step3':
      try {
        console.log('[Background] wallet:init:step3 - Deriving seed...');
        const session3 = initSessions.get(params.sessionId);
        if (!session3) {
          return { ok: false, error: 'Invalid or expired session', id };
        }
        const seedResult = await walletManager.initStep3_DeriveSeed(session3.mnemonic);
        session3.baseSeedHex = seedResult.baseSeedHex;
        console.log('[Background] Step 3 complete, baseSeed stored in session');
        return { ok: true, result: { ok: true }, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:init:step4':
      try {
        const session4 = initSessions.get(params.sessionId);
        if (!session4 || !session4.baseSeedHex) {
          return { ok: false, error: 'Invalid session or missing seed', id };
        }
        console.log('[Background] wallet:init:step4 - Generating addresses...');
        const treeResult = await walletManager.initStep4_GenerateTreeKey(session4.baseSeedHex);
        console.log('[Background] Step 4 complete, addresses generated:', treeResult.addressCount);
        return { ok: true, result: { ok: true, addressCount: treeResult.addressCount }, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:init:step5':
      try {
        console.log('[Background] wallet:init:step5 - Finalizing wallet...');
        const session5 = initSessions.get(params.sessionId);
        if (!session5 || !session5.baseSeedHex) {
          return { ok: false, error: 'Invalid session or missing seed', id };
        }
        const finalResult = await walletManager.initStep5_Finalize(
          session5.mnemonic,
          params.password,
          session5.baseSeedHex
        );
        initSessions.delete(params.sessionId);
        console.log('[Background] Step 5 complete, session cleaned up');
        prefetchMinimaPrice().catch(e => console.warn('[Background] Price prefetch failed:', e));
        return { ok: true, result: finalResult, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:unlock':
      try {
        const success = await walletManager.unlock(params[0]);
        // Pre-fetch price in background after unlock
        prefetchMinimaPrice().catch(e => console.warn('[Background] Price prefetch failed:', e));
        return { ok: true, result: success, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'price:get':
      try {
        // Return cached price immediately, or fetch if not available
        if (cachedPrice && Date.now() - cachedPrice.lastUpdated < PRICE_CACHE_DURATION) {
          return { ok: true, result: cachedPrice, id };
        }
        // Fetch fresh price
        const price = await prefetchMinimaPrice();
        return { ok: true, result: price, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:getRootIdentityInfo':
      return { ok: true, result: walletManager.getRootIdentityInfo(), id };

    case 'wallet:generateOwnershipProof':
      try {
        const proofResult = await walletManager.generateOwnershipProof(params?.message || '', params?.childIndices || []);
        return { ok: true, result: proofResult, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }

    case 'wallet:lock':
      walletManager.lock();
      return { ok: true, result: true, id };
    
    case 'wallet:requestLease':
      try {
        const leaseResult = await walletManager.requestLease(params);
        return { ok: true, result: leaseResult, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:signTransaction':
      try {
        const signResult = await walletManager.signTransaction(params);
        return { ok: true, result: signResult, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:finalizeTransaction':
      try {
        const finalizeResult = await walletManager.finalizeTransaction(params);
        return { ok: true, result: finalizeResult, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'wallet:getWotsHealth':
      try {
        // Load watermark state to calculate WOTS health
        // Updated 2026-02-05 for Per-Address TreeKey Architecture
        await watermarkStore.initialize();
        const leases = leaseStore.getAll();
        const activeLeases = leaseStore.getActive();
        
        // Per-address architecture: 64 addresses × 4,096 signatures each = 262,144 total
        let usage = watermarkStore.getTotalUsage();

        // If local usage is zero and we have an active session, try to recover from server.
        // This handles the reinstall case where chrome.storage.local was wiped but the
        // Axia server still holds the true watermark for this root public key.
        if (usage.used === 0) {
          try {
            const serverWatermark = await walletManager.fetchServerWatermark();
            if (serverWatermark) {
              const { l1, l2, l3 } = serverWatermark;
              if (l1 > 0 || l2 > 0 || l3 > 0) {
                console.log(`[Background] Restoring WOTS watermark from server: (l1=${l1}, l2=${l2}, l3=${l3})`);
                await watermarkStore.restoreFromServer(l1, l2, l3);
                usage = watermarkStore.getTotalUsage();
              }
            }
          } catch (serverErr: any) {
            console.warn('[Background] Could not restore WOTS watermark from server (using local state):', serverErr.message);
          }
        }

        const watermarkState = watermarkStore.getCurrent();
        
        // Determine health status based on usage
        let health: 'healthy' | 'warning' | 'critical' = 'healthy';
        const remaining = usage.total - usage.used;
        if (usage.percentage >= 90 || remaining < 1000) {
          health = 'critical';
        } else if (usage.percentage >= 75 || remaining < 10000) {
          health = 'warning';
        }
        
        return { 
          ok: true,
          result: { 
            health,
            totalCapacity: usage.total,
            used: usage.used,
            remaining,
            usagePercent: parseFloat(usage.percentage.toFixed(2)),
            historicalTransactions: usage.used,
            isExhausted: !watermarkStore.hasAvailableIndices(),
            architecture: 'per-address',
            addressCount: 64,
            signaturesPerAddress: 4096,
            activeLeases: activeLeases.length,
            totalLeases: leases.length,
            lastSyncTimestamp: watermarkState?.lastSyncTimestamp || null,
            hasAvailableIndices: watermarkStore.hasAvailableIndices()
          }, 
          id 
        };
      } catch (error: any) {
        console.error('[Background] Failed to get WOTS health:', error);
        return { ok: false, error: error.message, id };
      }

    case 'wallet:fetchUserQuota':
      try {
        const identityHash = walletManager.getUserIdentityHash() 
          || (params as any)?.userIdentityHash;
        if (!identityHash) {
          return { ok: true, result: null, id };
        }
        const quotaResult = await quotaTracker.fetchFromServer(identityHash);
        return { ok: true, result: quotaResult, id };
      } catch (error: any) {
        console.error('[Background] Failed to fetch user quota:', error);
        return { ok: false, error: error.message, id };
      }
    
    case 'WOTS_SEND': {
      // Helper: convert a display token amount to its Minima backing decimal string.
      // Every Minima token has a creator-defined scale. The relationship is:
      //   minimaAmount = displayAmount × 10^(-tokenScale)
      // This must be used instead of Minima's 44-decimal system for custom tokens.
      const displayAmountToMinimaDecimal = (displayAmt: string, scale: number): string => {
        const dotIdx = displayAmt.indexOf('.');
        const intPart = dotIdx >= 0 ? displayAmt.slice(0, dotIdx) : displayAmt;
        const fracPart = dotIdx >= 0 ? displayAmt.slice(dotIdx + 1) : '';
        const digits = (intPart + fracPart).replace(/^0+/, '') || '0';
        if (digits === '0') return '0';
        const fracDigits = fracPart.length;
        const totalScale = fracDigits + scale;
        const digitLen = digits.length;
        if (totalScale >= digitLen) {
          return '0.' + '0'.repeat(totalScale - digitLen) + digits;
        }
        const beforeDot = digits.slice(0, digitLen - totalScale);
        const afterDot = digits.slice(digitLen - totalScale);
        return beforeDot + (afterDot ? '.' + afterDot : '');
      };

      // Orchestrated WOTS transaction: prepare → sign → finalize in one call
      // This keeps all sensitive material (seed) in the background service
      const txCorrelationId = generateTxCorrelationId();
      const txLog = TxSendLogger.child(txCorrelationId);
      
      try {
        const { 
          to, 
          amount, 
          tokenid = '0x00', 
          tokenSymbol, 
          sourceAddress,
          sendMode = 'global',
          excludedAddresses
        } = params || {};
        
        if (!to || !amount) {
          return { 
            ok: false, 
            error: 'Missing required parameters: to, amount',
            stage: 'validation',
            id 
          };
        }
        
        txLog.info('Starting transaction', { to: to.substring(0, 16), amount, tokenid, sendMode });
        
        // Initialize receipt store if needed
        await transactionReceiptStore.initialize();
        
        // Step 0: Coin Selection (new - uses MegaMMR for chain-wide UTXO queries)
        txLog.info('Step 0: Selecting coins from MegaMMR...');
        
        const allAddresses = walletManager.getAllAddresses();
        if (allAddresses.length === 0) {
          return {
            ok: false,
            error: 'No addresses in wallet - import or create wallet first',
            stage: 'coin_selection',
            id
          };
        }
        
        await coinSelectionService.loadExcludedAddresses();
        
        // Convert base units (44 decimals) to decimal format for coin selection
        // MegaMMR returns amounts in decimal format (e.g., "0.01"), so we need to match
        const amountDecimal = formatMinimaAmount(amount, MINIMA_DECIMALS);
        txLog.info(' Amount conversion:', { baseUnits: amount, decimal: amountDecimal });
        
        const selectionResult = await coinSelectionService.selectCoinsForSend(allAddresses, {
          mode: sendMode as 'global' | 'focused',
          targetAmount: amountDecimal,
          tokenId: tokenid,
          focusedAddress: sendMode === 'focused' ? sourceAddress : undefined,
          excludedAddresses: excludedAddresses
        });
        
        if (selectionResult.insufficientFunds) {
          return {
            ok: false,
            error: `Insufficient funds: need ${amountDecimal}, have ${selectionResult.totalSelected}`,
            stage: 'coin_selection',
            available: selectionResult.totalSelected,
            id
          };
        }
        
        const coinInputs = coinSelectionService.formatCoinInputs(selectionResult.selectedCoins);
        txLog.info(' Coin selection complete:', {
          coinsSelected: coinInputs.length,
          totalSelected: selectionResult.totalSelected,
          change: selectionResult.change,
          fromAddresses: selectionResult.fromAddresses
        });
        
        // For native Minima: amountDecimal ("888") maps directly to coin amounts.
        // For custom tokens: we'll resolve the correct Minima backing after fetching CoinProofs
        // (which carry the token scale). A preliminary value is set here using totalSelected
        // and refined below once tokenScale is extracted.
        const isCustomToken = !!(tokenid && tokenid !== '0x00');
        let sendAmountBaseUnits = isCustomToken
          ? selectionResult.totalSelected   // preliminary — refined after CoinProof fetch
          : amountDecimal;                  // display decimal, e.g. "888"
        txLog.info(' Amount resolved (preliminary):', {
          isCustomToken,
          amountDecimal,
          totalSelected: selectionResult.totalSelected,
          sendAmountBaseUnits
        });
        
        // Step 1: Request WOTS lease (allocates watermark indices)
        // CRITICAL: The lease must allocate indices for the input coin's address
        // Per-address TreeKey: addressIndex selects which per-address TreeKey to use
        txLog.info(' Step 1: Requesting WOTS lease...');
        const txBuf = new Uint8Array(16);
        crypto.getRandomValues(txBuf);
        const txId = `tx-${Date.now()}-${Array.from(txBuf).map(b => b.toString(16).padStart(2, '0')).join('')}`;
        
        // Get the address index of the first input coin
        const firstCoinAddress = selectionResult.selectedCoins[0]?.address;
        const addressIndex = firstCoinAddress ? walletManager.getAddressIndex(firstCoinAddress) : null;
        txLog.info(` First input address: ${firstCoinAddress?.slice(0, 16)}..., addressIndex: ${addressIndex}`);
        
        const prepareResult = await walletManager.requestLease({
          txId,
          addressIndex  // Request specific address index for the lease
        });
        
        if (!prepareResult || !prepareResult.leaseToken) {
          throw new Error('Failed to acquire WOTS lease');
        }
        
        if (typeof prepareResult.addressIndex !== 'number' || isNaN(prepareResult.addressIndex)) {
          const rawKeys = Object.keys(prepareResult).join(', ');
          const rawAI = JSON.stringify(prepareResult.addressIndex);
          txLog.error(`CRITICAL: prepareResult.addressIndex is ${rawAI} (type: ${typeof prepareResult.addressIndex}). Response keys: [${rawKeys}]. Full prepareResult: ${JSON.stringify(prepareResult)}`);
          throw new Error(`Lease response missing addressIndex (got ${rawAI}). This may indicate an API mapping issue between the backend and extension.`);
        }
        
        const validatedAddressIndex = Number(prepareResult.addressIndex);
        const validatedL1 = Number(prepareResult.l1);
        const validatedL2 = Number(prepareResult.l2);

        
        txLog.info(' Step 1 complete: Lease acquired', {
          leaseId: prepareResult.leaseId,
          addressIndex: validatedAddressIndex,
          l1: validatedL1,
          l2: validatedL2
        });
        
        // Step 1.5: Fetch CoinProofs BEFORE building transaction (for byte-exact amount serialization)
        txLog.info(' Step 1.5: Fetching CoinProofs for byte-exact serialization...');
        const { TransactionService } = await import('../core/transaction/service');
        
        const coinIds = selectionResult.selectedCoins.map(coin => coin.coinId);
        txLog.info(`Fetching CoinProofs for ${coinIds.length} coins`);
        
        const coinProofsHex = await TransactionService.fetchCoinProofs(
          prepareResult.leaseToken,
          coinIds
        );
        
        // Extract COMPLETE coin data from each CoinProof for byte-exact serialization
        // This is CRITICAL for matching Java's transaction ID computation
        const coinDataMap = new Map<string, CoinProofData>();
        const amountBytesMap = new Map<string, Uint8Array>();  // Fallback for legacy compatibility
        
        for (let i = 0; i < coinIds.length; i++) {
          const coinId = coinIds[i];
          const proofHex = coinProofsHex[i];
          if (proofHex) {
            // Try to extract complete coin data first
            const coinData = extractCoinDataFromCoinProof(proofHex);
            if (coinData) {
              coinDataMap.set(coinId, coinData);
              amountBytesMap.set(coinId, coinData.rawAmountBytes);
              const rawTokenDataLen = coinData.rawTokenData?.length ?? 0;
              txLog.info(` Extracted COMPLETE coin data for ${coinId.slice(0, 16)}...`, {
                mmrEntry: coinData.mmrEntryNumber.toString(),
                blockCreated: coinData.blockCreated.toString(),
                storeState: coinData.storeState,
                stateCount: coinData.state.length,
                rawTokenDataLen
              });
              console.log(`[TOKEN-EXTRACT] coinId=${coinId.slice(0, 16)}... rawTokenDataLen=${rawTokenDataLen === 0 ? 'MISSING' : rawTokenDataLen} hasToken=${coinData.rawTokenData ? '1' : '0'}`);
            } else {
              // Fallback to just amount bytes
              const amountBytes = extractAmountBytesFromCoinProof(proofHex);
              if (amountBytes) {
                amountBytesMap.set(coinId, amountBytes);
                txLog.warn(` Only extracted amount bytes for ${coinId.slice(0, 16)}... (may cause txnid mismatch)`);
              }
              console.log(`[TOKEN-EXTRACT] coinId=${coinId.slice(0, 16)}... FULL EXTRACTION FAILED (proofHex len=${proofHex.length})`);
            }
          }
        }
        
        txLog.info(' Step 1.5 complete: CoinProofs fetched and coin data extracted', {
          count: coinProofsHex.length,
          completeCoinData: coinDataMap.size,
          amountBytesOnly: amountBytesMap.size - coinDataMap.size
        });

        // Refine sendAmountBaseUnits using the token's actual scale extracted from the CoinProof.
        // Each token creator sets their own scale. The correct Minima backing for a display amount X
        // with token scale S is: minimaAmount = X × 10^(-S)
        // This replaces the preliminary totalSelected value and works for partial spends too.
        if (isCustomToken) {
          const firstCoinData = [...coinDataMap.values()][0];
          const extractedScale = firstCoinData?.tokenScale;
          if (extractedScale !== undefined && amountDecimal && amountDecimal !== '0') {
            const refinedAmount = displayAmountToMinimaDecimal(amountDecimal, extractedScale);
            txLog.info(' Send amount refined using token scale', {
              amountDecimal,
              tokenScale: extractedScale,
              preliminary: sendAmountBaseUnits,
              refined: refinedAmount
            });
            sendAmountBaseUnits = refinedAmount;
          }
        }

        // Pre-flight check: for custom token sends, ensure token metadata was extracted.
        // If all CoinProof extractions fail, hasCoinProofData=false in buildTransaction
        // suppresses the safety throw, producing hasToken=0 output coins → Java NPE.
        // This check catches that case and surfaces a clean error before signing begins.
        if (isCustomToken) {
          const hasTokenData = [...coinDataMap.values()].some(cpd => cpd.rawTokenData && cpd.rawTokenData.length > 0);
          if (!hasTokenData) {
            txLog.error('CRITICAL: No rawTokenData extracted from any CoinProof for custom token send. Cannot proceed.', {
              coinCount: coinIds.length,
              proofsFetched: coinProofsHex.filter(Boolean).length,
              completeParsed: coinDataMap.size
            });
            console.log('[TOKEN-EXTRACT] CRITICAL: rawTokenData missing for ALL coins — custom token send blocked to prevent Java NPE');
            return { ok: false, error: 'Cannot send token: failed to extract token metadata from CoinProof. Please try again or check node connectivity.', stage: 'coin_proof_extraction', id };
          }
          const sampleLen = [...coinDataMap.values()].find(cpd => cpd.rawTokenData)?.rawTokenData?.length;
          txLog.info('Token metadata pre-flight PASSED', { rawTokenDataLen: sampleLen });
          console.log(`[TOKEN-EXTRACT] Pre-flight PASSED: rawTokenData ${sampleLen}B extracted for custom token send`);
        }
        
        // Step 2: Build transaction locally (client-side custody)
        txLog.info(' Step 2: Building transaction locally...');
        
        // Convert coins to builder format WITH complete coin data from CoinProof
        // This ensures byte-exact serialization matching the blockchain's original encoding
        const builderInputs: SpendableCoinInput[] = selectionResult.selectedCoins.map(coin => ({
          coinId: coin.coinId,
          address: coin.address,
          amount: coin.amount,  // Decimal string for fallback parsing
          tokenId: coin.tokenid || '0x00',
          rawAmountBytes: amountBytesMap.get(coin.coinId),  // Exact bytes from CoinProof
          coinProofData: coinDataMap.get(coin.coinId)  // Complete coin data for byte-exact match
        }));
        
        txLog.info(' Input coins with complete coin data:', {
          inputCount: builderInputs.length,
          firstInputAmount: builderInputs[0]?.amount,
          firstHasRawBytes: !!builderInputs[0]?.rawAmountBytes,
          firstHasCoinProofData: !!builderInputs[0]?.coinProofData
        });
        
        // Convert recipient address if Mx format
        const recipientHex = mxToHex(to);
        
        // Build transaction and compute digest locally
        // All amounts are INTEGER UNITS with scale=0 (matching Java serialization)
        const buildResult = buildTransaction({
          inputs: builderInputs,
          recipientAddress: recipientHex,
          amount: sendAmountBaseUnits,  // Integer units with scale=0
          tokenId: tokenid,
          changeAddress: builderInputs[0]?.address
        });
        
        txLog.info(' Step 2 complete: Transaction built locally', {
          digestTxHex: buildResult.digestTxHex.slice(0, 20) + '...',
          serializedLength: buildResult.serialized.length,
          inputCount: builderInputs.length
        });
        
        // DIAGNOSTIC: Dump serialized transaction for debugging txnid mismatch
        txLog.trace('DEBUG: ═══════════════════════════════════════════════════════════════');
        txLog.trace('DEBUG: FULL SERIALIZED TRANSACTION (what we hash for txnid):');
        txLog.trace(` Length: ${buildResult.serialized.length} bytes`);
        txLog.trace(` Full Hex: ${buildResult.serializedHex}`);
        txLog.trace(` Digest (SHA3 of above): ${buildResult.digestTxHex}`);
        txLog.trace('DEBUG: ═══════════════════════════════════════════════════════════════');
        
        // ENHANCED DIAGNOSTIC: Byte-level breakdown for Java parity verification
        const { diagnosticTransactionDump } = await import('../core/transaction/MinimaTransactionBuilder');
        const diagnostic = diagnosticTransactionDump(buildResult.transaction);
        txLog.info('BYTE-LEVEL DIAGNOSTIC BREAKDOWN:');
        txLog.info(` Summary: ${diagnostic.summary}`);
        txLog.info(` Digest: ${diagnostic.digest}`);
        txLog.info(' Field-by-field breakdown (compare with Java txnexport):');
        for (const field of diagnostic.breakdown) {
          txLog.trace(`   @${field.offset.toString().padStart(4)} [${field.length.toString().padStart(3)}B] ${field.field}: ${field.bytes}`);
        }
        
        // Step 3: Sign transaction locally with WOTS using local digest
        txLog.info(' ═══════════════════════════════════════════════════════════════');
        txLog.info(' Step 3: Signing transaction with hierarchical TreeKey...');
        txLog.info(' ═══════════════════════════════════════════════════════════════');
        txLog.info(` TreeKey path: addressIndex=${validatedAddressIndex}, l1=${validatedL1}, l2=${validatedL2}`);
        txLog.info(` Transaction digest: ${buildResult.digestTxHex.slice(0, 32)}...`);
        
        const signStartTime = performance.now();
        const signResult = await walletManager.signTransactionPerAddress({
          addressIndex: validatedAddressIndex,
          l1: validatedL1,
          l2: validatedL2,
          digestTx: buildResult.digestTxHex
        });
        const signTime = performance.now() - signStartTime;
        
        if (!signResult || !signResult.witnessBundle) {
          throw new Error('Failed to sign transaction');
        }
        
        // Determine if hierarchical signature was used (for logging)
        const usedHierarchical = signResult.witnessBundle.proofs && Array.isArray(signResult.witnessBundle.proofs);
        
        txLog.info(` Step 3 complete: Transaction signed (${signTime.toFixed(0)}ms)`);
        txLog.info(`   Signature format: ${usedHierarchical ? 'HIERARCHICAL (TreeKey)' : 'LEGACY (flat)'}`);
        txLog.info(`   Path: addressIndex=${signResult.witnessBundle.addressIndex}, l1=${signResult.witnessBundle.l1}, l2=${signResult.witnessBundle.l2}`);
        if (usedHierarchical) {
          txLog.info(`   Proofs: ${signResult.witnessBundle.proofs.length} hierarchical SignatureProofs`);
          txLog.info(`   Root PK: ${signResult.witnessBundle.rootPublicKey?.slice(0, 24)}...`);
          
          // DIAGNOSTIC: Log actual byte sizes
          // Helper to calculate bytes from hex string (handles both with and without 0x prefix)
          const hexToBytes = (hex: string | undefined): number => {
            if (!hex) return 0;
            const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
            return clean.length / 2;
          };
          
          txLog.info(' ╔══════════════════════════════════════════════════════════════╗');
          txLog.info(' ║           SIGNATURE PROOF BYTE SIZES (DIAGNOSTIC)           ║');
          txLog.info(' ╠══════════════════════════════════════════════════════════════╣');
          let totalWitnessBytes = 0;
          for (let i = 0; i < signResult.witnessBundle.proofs.length; i++) {
            const proof = signResult.witnessBundle.proofs[i];
            const sigBytes = hexToBytes(proof.signature);
            const leafPkBytes = hexToBytes(proof.leafPubkey);
            const mmrBytes = hexToBytes(proof.mmrProof);
            const proofTotalBytes = sigBytes + leafPkBytes + mmrBytes + 8; // +8 for length prefixes
            totalWitnessBytes += proofTotalBytes;
            
            txLog.info(` ║ Proof[${i}]: sig=${sigBytes}B, leafPk=${leafPkBytes}B, mmr=${mmrBytes}B (total: ${proofTotalBytes}B)`);
            txLog.info(` ║   Expected: sig=1088B, leafPk=32B (digest)`);
            if (sigBytes !== 1088) {
              txLog.error(` ║ ❌ SIGNATURE SIZE MISMATCH! Got ${sigBytes}B, expected 1088B`);
            }
            if (leafPkBytes !== 32) {
              txLog.error(` ║ ❌ LEAF PUBKEY SIZE MISMATCH! Got ${leafPkBytes}B, expected 32B (digest)`);
            }
          }
          txLog.info(' ╠══════════════════════════════════════════════════════════════╣');
          txLog.info(` ║ Total witness estimate: ~${totalWitnessBytes}B (expected ~6501B for 3 proofs)`);
          txLog.info(' ╚══════════════════════════════════════════════════════════════╝');
        }
        txLog.info(' ═══════════════════════════════════════════════════════════════');
        
        // Note: CoinProofs were already fetched in Step 1.5 (before building transaction)
        // for byte-exact amount serialization
        
        // Step 4: Build txnimport-compatible format (ID + Transaction + Witness)
        txLog.info(' Step 4: Assembling transaction for txnimport...');
        const { serializeForTxnImport, bytesToHex: toHex } = await import('../core/transaction/MinimaTransactionBuilder');
        
        // Per-address TreeKey architecture (2026-02):
        // - Each address has its own TreeKey with independent public key (TreeKey MMR root)
        // - witnessBundle.rootPublicKey = per-address TreeKey root (matches SIGNEDBY in address script)
        // - witnessBundle.proofs = 2 SignatureProofs (Root→L1, L1→DATA)
        // - No more flat treeIndex derivation - all values come from witnessBundle
        const addrIdx = validatedAddressIndex;
        const l1 = validatedL1;
        const l2 = validatedL2;
        txLog.info(` Per-address signing indices: addressIndex=${addrIdx}, l1=${l1}, l2=${l2}`);
        
        // Assemble WOTS signature data for witness serialization
        // Check if using new hierarchical format (proofs) or legacy format (signatures)
        const witnessBundle = signResult.witnessBundle;
        const isHierarchical = 'proofs' in witnessBundle && Array.isArray(witnessBundle.proofs);
        
        // CRITICAL FIX: ScriptProof must use each ADDRESS's level-1 public key, NOT the TreeKey root!
        // 
        // The coin's address was created from: SHA3(RETURN SIGNEDBY(addressPublicKey))
        // where addressPublicKey = treeKey.getAddressPublicKey(addressIndex) = level-1 node's MMR root
        //
        // The TreeKey root (level-0) is DIFFERENT from each address's public key (level-1).
        // Using TreeKey root causes script hash mismatch → NullPointerException
        //
        // We need to look up each input coin's address in the wallet accounts to get its 
        // address-specific public key.
        
        const inputScripts: Array<{ address: string; rootPublicKey: string }> = [];
        const accounts = walletManager.getAllAccounts();
        
        // DIAGNOSTIC: Collect values for pre-send summary
        const diagSummary: {
          addressSpendingFrom: string;
          accountIndex: number | null;
          treeKeyDerivedPubkey: string;
          storedAccountPubkey: string;
          keysMatch: boolean;
        }[] = [];
        
        // ═══════════════════════════════════════════════════════════════════════
        // DIAGNOSTIC: Wallet manager for per-address TreeKey verification
        // ═══════════════════════════════════════════════════════════════════════
        // Note: We use getPerAddressTreeKey(index).getPublicKey() for correct per-address derivation
        // NOT the old diagTreeKey.getAddressPublicKey(index) which used master TreeKey L1 children
        
        // Debug: Log all wallet accounts for address matching diagnosis
        txLog.info(` Wallet has ${accounts.length} accounts for address matching:`);
        accounts.slice(0, 5).forEach((acc, i) => {
          // Convert Mx address to hex for comparison
          const accHex = acc.address.startsWith('Mx') ? mxToHex(acc.address) : acc.address;
          txLog.info(`   account[${i}]: ${acc.address.slice(0, 16)}... → hex: ${accHex.slice(0, 16)}...`);
        });
        
        for (const coin of selectionResult.selectedCoins) {
          // Normalize coin address to hex (lowercase, no 0x prefix)
          let coinHex = coin.address;
          if (coinHex.startsWith('Mx')) {
            coinHex = mxToHex(coinHex);
          }
          coinHex = coinHex.replace(/^0x/i, '').toLowerCase();
          
          txLog.info(` Looking for coin address: ${coin.address.slice(0, 16)}... (hex: ${coinHex.slice(0, 16)}...)`);
          
          // Find matching account by converting BOTH addresses to hex for comparison
          const matchingAccount = accounts.find(acc => {
            // Convert wallet address (Mx format) to hex
            let accHex = acc.address;
            if (accHex.startsWith('Mx')) {
              accHex = mxToHex(accHex);
            }
            accHex = accHex.replace(/^0x/i, '').toLowerCase();
            
            const matches = accHex === coinHex;
            if (matches) {
              txLog.info(`   ✓ Match found: account[${acc.index}]`);
            }
            return matches;
          });
          
          if (matchingAccount && matchingAccount.publicKey) {
            // ═══════════════════════════════════════════════════════════════════════
            // DIAGNOSTIC TASK #1 & #2: Compare stored vs freshly-derived public key
            // Per-address TreeKey architecture: each address has its own TreeKey
            // ═══════════════════════════════════════════════════════════════════════
            const perAddressTreeKeyForDiag = walletManager.getPerAddressTreeKey(matchingAccount.index);
            if (perAddressTreeKeyForDiag) {
              const storedPubkey = matchingAccount.publicKey;
              const derivedPubkeyBytes = perAddressTreeKeyForDiag.getPublicKey();
              const derivedPubkeyHex = `0x${Array.from(derivedPubkeyBytes).map((b: number) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
              
              // Normalize for comparison (uppercase, with 0x prefix)
              const storedNorm = storedPubkey.toUpperCase().replace(/^0X/, '0x');
              const derivedNorm = derivedPubkeyHex.toUpperCase().replace(/^0X/, '0x');
              const keysMatch = storedNorm === derivedNorm;
              
              txLog.trace('DIAG: ╔══════════════════════════════════════════════════════════════╗');
              txLog.trace('DIAG: ║           PUBLIC KEY VERIFICATION (Task #1)                 ║');
              txLog.trace('DIAG: ╠══════════════════════════════════════════════════════════════╣');
              txLog.trace(`DIAG: ║ Account index: ${matchingAccount.index}`);
              txLog.trace(`DIAG: ║ Stored pubkey:  ${storedPubkey.slice(0, 24)}...${storedPubkey.slice(-8)}`);
              txLog.trace(`DIAG: ║ Derived pubkey: ${derivedPubkeyHex.slice(0, 24)}...${derivedPubkeyHex.slice(-8)}`);
              txLog.trace(`DIAG: ║ Keys match: ${keysMatch ? '✅ YES' : '❌ NO - MISMATCH DETECTED!'}`);
              
              if (!keysMatch) {
                txLog.error(`DIAG: ║ ❌ CRITICAL: Stored account.publicKey differs from TreeKey derivation!`);
                txLog.error(`DIAG: ║ ❌ Full stored:  ${storedPubkey}`);
                txLog.error(`DIAG: ║ ❌ Full derived: ${derivedPubkeyHex}`);
              }
              
              // DIAGNOSTIC TASK #2: Compute addresses from both pubkeys
              txLog.trace('DIAG: ╠══════════════════════════════════════════════════════════════╣');
              txLog.trace('DIAG: ║           ADDRESS CROSS-CHECK (Task #2)                     ║');
              txLog.trace('DIAG: ╠══════════════════════════════════════════════════════════════╣');
              
              try {
                // Compute address from stored pubkey
                const storedPubkeyBytes = new Uint8Array(
                  (storedPubkey.replace(/^0x/i, '').match(/.{2}/g) || []).map(h => parseInt(h, 16))
                );
                const scriptFromStored = scriptFromWotsPk(storedPubkeyBytes);
                const addressFromStored = scriptToAddress(scriptFromStored);
                
                // Compute address from derived pubkey
                const scriptFromDerived = scriptFromWotsPk(derivedPubkeyBytes);
                const addressFromDerived = scriptToAddress(scriptFromDerived);
                
                // Convert coin hex address to Mx format for proper comparison
                // (scriptToAddress returns Mx format, coin.address is hex)
                const coinHexClean = coinHex.startsWith('0x') ? coinHex.slice(2) : coinHex;
                const coinAsMx = makeMinimaAddress(coinHexClean);
                
                const storedMatchesCoin = coinAsMx === addressFromStored;
                const derivedMatchesCoin = coinAsMx === addressFromDerived;
                
                txLog.trace(`DIAG: ║ Coin address (hex):   ${coin.address.slice(0, 24)}...`);
                txLog.trace(`DIAG: ║ Coin address (Mx):    ${coinAsMx.slice(0, 24)}...`);
                txLog.trace(`DIAG: ║ Address from stored:  ${addressFromStored.slice(0, 24)}... ${storedMatchesCoin ? '✅ MATCH' : '❌ NO MATCH'}`);
                txLog.trace(`DIAG: ║ Address from derived: ${addressFromDerived.slice(0, 24)}... ${derivedMatchesCoin ? '✅ MATCH' : '❌ NO MATCH'}`);
                
                if (!storedMatchesCoin && !derivedMatchesCoin) {
                  txLog.error('DIAG: ║ ❌ CRITICAL: Neither pubkey produces the coin\'s address!');
                } else if (storedMatchesCoin !== derivedMatchesCoin) {
                  txLog.error('DIAG: ║ ⚠️ WARNING: Only one pubkey matches - data inconsistency!');
                }
              } catch (addrErr: any) {
                txLog.error(`DIAG: ║ ❌ Address computation failed: ${addrErr.message}`);
              }
              
              txLog.trace('DIAG: ╚══════════════════════════════════════════════════════════════╝');
            }
            // ═══════════════════════════════════════════════════════════════════════
            
            // Use the address-specific level-1 public key (stored in account.publicKey)
            inputScripts.push({
              address: coin.address,
              rootPublicKey: matchingAccount.publicKey
            });
            
            // DIAGNOSTIC: Capture values for summary (using per-address TreeKey)
            const perAddressTreeKeyForSummary = walletManager.getPerAddressTreeKey(matchingAccount.index);
            const derivedPkForSummary = perAddressTreeKeyForSummary 
              ? `0x${Array.from(perAddressTreeKeyForSummary.getPublicKey()).map((b: number) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`
              : 'N/A';
            const storedNormalized = matchingAccount.publicKey.toUpperCase().replace(/^0X/, '0x');
            const derivedNormalized = derivedPkForSummary.toUpperCase().replace(/^0X/, '0x');
            diagSummary.push({
              addressSpendingFrom: coin.address,
              accountIndex: matchingAccount.index,
              treeKeyDerivedPubkey: derivedPkForSummary,
              storedAccountPubkey: matchingAccount.publicKey,
              keysMatch: storedNormalized === derivedNormalized
            });
            
            txLog.info(` Input ${coin.coinId.slice(0, 10)}... address ${coin.address.slice(0, 12)}... → account[${matchingAccount.index}] pubkey ${matchingAccount.publicKey.slice(0, 16)}...`);
          } else {
            // Per-address TreeKey architecture: witnessBundle.rootPublicKey is REQUIRED
            // This is the per-address TreeKey root that matches the SIGNEDBY in the address script
            if (!isHierarchical || !witnessBundle.rootPublicKey) {
              throw new Error(`No matching account for coin address ${coin.address.slice(0, 16)}... and no per-address TreeKey pubkey in witnessBundle. Wallet may need re-import.`);
            }
            
            inputScripts.push({
              address: coin.address,
              rootPublicKey: witnessBundle.rootPublicKey
            });
            
            // DIAGNOSTIC: Add fallback case to summary
            diagSummary.push({
              addressSpendingFrom: coin.address,
              accountIndex: null,
              treeKeyDerivedPubkey: 'FROM witnessBundle.rootPublicKey',
              storedAccountPubkey: witnessBundle.rootPublicKey,
              keysMatch: true // Using the correct per-address key from signing
            });
            
            txLog.warn(`No matching account for ${coin.address.slice(0, 12)}... - using witnessBundle.rootPublicKey`, {
              availableAccounts: accounts.slice(0, 3).map(a => {
                let h = a.address.startsWith('Mx') ? mxToHex(a.address) : a.address;
                return h.replace(/^0x/i, '').toLowerCase().slice(0, 16) + '...';
              })
            });
          }
        }
        
        txLog.info(` ScriptProof summary: ${inputScripts.length} input(s) with address-specific level-1 public keys`);
        
        // Per-address TreeKey architecture (2026-02): ONLY hierarchical format is supported
        // Legacy flat format has been removed - all signing must use per-address TreeKeys
        if (!isHierarchical) {
          throw new Error('Legacy flat signature format is no longer supported. Wallet must use per-address TreeKey architecture.');
        }
        
        if (!witnessBundle.rootPublicKey) {
          throw new Error('witnessBundle.rootPublicKey is required for per-address TreeKey architecture');
        }
        
        txLog.info(' Using per-address TreeKey signature format (hierarchical)');
        const wotsData = {
          addressIndex: witnessBundle.addressIndex,
          l1: witnessBundle.l1,
          l2: witnessBundle.l2,
          hierarchical: true,
          proofs: witnessBundle.proofs, // Array of SignatureProofHex (2 proofs: Root→L1, L1→DATA)
          rootPublicKey: witnessBundle.rootPublicKey // Per-address TreeKey root (matches SIGNEDBY in address script)
        };
        txLog.debug(`Per-address TreeKey pubkey: ${witnessBundle.rootPublicKey.slice(0, 24)}...`);
        
        // ═══════════════════════════════════════════════════════════════════════
        // DIAGNOSTIC TASK #3: Compare wotsData.rootPublicKey vs inputScripts
        // ═══════════════════════════════════════════════════════════════════════
        txLog.trace('DIAG: ╔══════════════════════════════════════════════════════════════╗');
        txLog.trace('DIAG: ║     WOTS DATA vs INPUT SCRIPTS COMPARISON (Task #3)        ║');
        txLog.trace('DIAG: ╠══════════════════════════════════════════════════════════════╣');
        txLog.trace(`DIAG: ║ wotsData.rootPublicKey: ${wotsData.rootPublicKey?.slice(0, 24)}...`);
        txLog.trace(`DIAG: ║ wotsData.hierarchical:  ${wotsData.hierarchical}`);
        txLog.trace(`DIAG: ║ wotsData.addressIndex/l1/l2: ${wotsData.addressIndex}/${wotsData.l1}/${wotsData.l2}`);
        
        for (let i = 0; i < inputScripts.length; i++) {
          const is = inputScripts[i];
          const wotsNorm = wotsData.rootPublicKey?.toUpperCase().replace(/^0X/, '0x') || '';
          const scriptNorm = is.rootPublicKey.toUpperCase().replace(/^0X/, '0x');
          const match = wotsNorm === scriptNorm;
          
          txLog.trace(`DIAG: ╠══════════════════════════════════════════════════════════════╣`);
          txLog.trace(`DIAG: ║ inputScripts[${i}].rootPublicKey: ${is.rootPublicKey.slice(0, 24)}...`);
          txLog.trace(`DIAG: ║ inputScripts[${i}].address:       ${is.address.slice(0, 24)}...`);
          txLog.trace(`DIAG: ║ Matches wotsData.rootPublicKey:  ${match ? '✅ YES' : '❌ NO - MISMATCH!'}`);
          
          if (!match) {
            txLog.error(`DIAG: ║ ❌ CRITICAL MISMATCH DETECTED!`);
            txLog.error(`DIAG: ║ ❌ This will cause "not signed by publickey" error!`);
            txLog.error(`DIAG: ║ ❌ wotsData.rootPublicKey (from signing): ${wotsData.rootPublicKey}`);
            txLog.error(`DIAG: ║ ❌ inputScripts[${i}].rootPublicKey (from account): ${is.rootPublicKey}`);
          }
        }
        txLog.trace('DIAG: ╚══════════════════════════════════════════════════════════════╝');
        
        // ═══════════════════════════════════════════════════════════════════════
        // DIAGNOSTIC TASK #4: Transaction digest logging
        // ═══════════════════════════════════════════════════════════════════════
        txLog.trace('DIAG: ╔══════════════════════════════════════════════════════════════╗');
        txLog.trace('DIAG: ║           TRANSACTION DIGEST (Task #4)                      ║');
        txLog.trace('DIAG: ╠══════════════════════════════════════════════════════════════╣');
        txLog.trace(`DIAG: ║ Client-side digest (signed): ${buildResult.digestTxHex}`);
        txLog.trace(`DIAG: ║ Serialized tx length: ${buildResult.serialized.length} bytes`);
        txLog.trace(`DIAG: ║ (Compare with node txnid after submission)`);
        txLog.trace('DIAG: ╚══════════════════════════════════════════════════════════════╝');
        
        // ═══════════════════════════════════════════════════════════════════════
        // DIAGNOSTIC TASK #5: Proof chain verification
        // ═══════════════════════════════════════════════════════════════════════
        if (isHierarchical && wotsData.proofs && Array.isArray(wotsData.proofs)) {
          txLog.trace('DIAG: ╔══════════════════════════════════════════════════════════════╗');
          txLog.trace('DIAG: ║           PROOF CHAIN VERIFICATION (Task #5)                ║');
          txLog.trace('DIAG: ╠══════════════════════════════════════════════════════════════╣');
          txLog.trace(`DIAG: ║ Number of proofs: ${wotsData.proofs.length}`);
          txLog.trace(`DIAG: ║ Expected: 2 (L1→L2 parent-child + L2→DATA signing)`);
          
          for (let i = 0; i < wotsData.proofs.length; i++) {
            const proof = wotsData.proofs[i];
            const leafPk = proof.leafPubkey || '';
            const sig = proof.signature || '';
            const mmr = proof.mmrProof || '';
            
            txLog.trace(`DIAG: ╠══════════════════════════════════════════════════════════════╣`);
            txLog.trace(`DIAG: ║ Proof[${i}]:`);
            txLog.trace(`DIAG: ║   leafPubkey: ${leafPk.slice(0, 24)}... (${(leafPk.replace(/^0x/i, '').length / 2)} bytes)`);
            txLog.trace(`DIAG: ║   signature:  ${sig.slice(0, 24)}... (${(sig.replace(/^0x/i, '').length / 2)} bytes)`);
            txLog.trace(`DIAG: ║   mmrProof:   ${mmr.slice(0, 24)}... (${(mmr.replace(/^0x/i, '').length / 2)} bytes)`);
            
            // Expected sizes: leafPk=32B (SHA3-256 digest of full WOTS key), sig=1088B (34 chains × 32B)
            // Per BouncyCastle WinternitzOTSignature.getPublicKey(): returns SHA3(all chain tops), NOT the full 1088B
            const expectedPkSize = 32;
            const expectedSigSize = 1088;
            const actualPkSize = (leafPk.replace(/^0x/i, '').length / 2);
            const actualSigSize = (sig.replace(/^0x/i, '').length / 2);
            
            if (actualPkSize !== expectedPkSize) {
              txLog.warn(`DIAG: ║   ⚠️ leafPubkey size mismatch: got ${actualPkSize}B, expected ${expectedPkSize}B (32B digest)`);
            }
            if (actualSigSize !== expectedSigSize) {
              txLog.warn(`DIAG: ║   ⚠️ signature size mismatch: got ${actualSigSize}B, expected ${expectedSigSize}B`);
            }
          }
          
          // ACTUAL PROOF CHAIN VALIDATION: Compare getRootPublicKey(proofs[0]) to script pubkey
          txLog.trace(`DIAG: ╠══════════════════════════════════════════════════════════════╣`);
          txLog.trace(`DIAG: ║           PROOF CHAIN ROOT VERIFICATION                      ║`);
          txLog.trace(`DIAG: ╠══════════════════════════════════════════════════════════════╣`);
          
          if (wotsData.proofs.length >= 1 && inputScripts.length >= 1) {
            // Log proof chain data for manual verification
            // Note: Full getRootPublicKey verification requires parsing the complex MMRProof structure
            // For now, we log the key data so the developer can compare:
            const firstProof = wotsData.proofs[0];
            const leafPkHex = firstProof.leafPubkey || '';
            const mmrProofHex = firstProof.mmrProof || '';
            
            // The first proof's MMR should verify back to inputScripts[0].rootPublicKey
            // If the proof chain is correct, the computed root equals the address's level-1 pubkey
            const expectedRoot = inputScripts[0].rootPublicKey;
            
            txLog.trace(`DIAG: ║ First proof leafPubkey (L2 key digest): ${leafPkHex.slice(0, 24)}...`);
            txLog.trace(`DIAG: ║ First proof MMR proof length: ${(mmrProofHex.replace(/^0x/i, '').length / 2)} bytes`);
            txLog.trace(`DIAG: ║ Expected root (inputScripts[0]): ${expectedRoot.slice(0, 24)}...`);
            txLog.trace(`DIAG: ║ (MMR root verification requires parsing chunks - check node error for mismatch)`);
            
            // Log what the last proof should sign (transaction digest)
            if (wotsData.proofs.length >= 2) {
              const lastProof = wotsData.proofs[wotsData.proofs.length - 1];
              const lastLeafPk = lastProof.leafPubkey || '';
              txLog.trace(`DIAG: ║ Last proof leafPubkey (signing key): ${lastLeafPk.slice(0, 24)}...`);
            }
          } else {
            txLog.warn(`DIAG: ║ ⚠️ Cannot verify: proofs=${wotsData.proofs?.length}, inputScripts=${inputScripts.length}`);
          }
          
          // Log digest that final proof should sign
          txLog.trace(`DIAG: ╠══════════════════════════════════════════════════════════════╣`);
          txLog.trace(`DIAG: ║ Final proof should sign digest: ${buildResult.digestTxHex.slice(0, 24)}...`);
          txLog.trace('DIAG: ╚══════════════════════════════════════════════════════════════╝');
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // DIAGNOSTIC SUMMARY (INFO LEVEL) - All critical values before send
        // ═══════════════════════════════════════════════════════════════════════
        txLog.info('╔═══════════════════════════════════════════════════════════════════╗');
        txLog.info('║               PRE-SEND DIAGNOSTIC SUMMARY                        ║');
        txLog.info('╠═══════════════════════════════════════════════════════════════════╣');
        
        // Log per-input diagnostic data
        for (let i = 0; i < diagSummary.length; i++) {
          const d = diagSummary[i];
          txLog.info(`║ INPUT[${i}]:`);
          txLog.info(`║   Address spending from: ${d.addressSpendingFrom}`);
          txLog.info(`║   Account index: ${d.accountIndex}`);
          txLog.info(`║   TreeKey.getAddressPublicKey(${d.accountIndex}): ${d.treeKeyDerivedPubkey}`);
          txLog.info(`║   Stored account.publicKey: ${d.storedAccountPubkey}`);
          txLog.info(`║   Keys match: ${d.keysMatch ? '✅ YES' : '❌ NO MISMATCH'}`);
        }
        
        txLog.info('╠═══════════════════════════════════════════════════════════════════╣');
        txLog.info(`║ wotsData.rootPublicKey: ${wotsData.rootPublicKey || 'N/A'}`);
        txLog.info(`║ inputScripts[0].rootPublicKey: ${inputScripts[0]?.rootPublicKey || 'N/A'}`);
        
        // Check if wotsData.rootPublicKey matches inputScripts[0].rootPublicKey
        const wotsRootNorm = (wotsData.rootPublicKey || '').toUpperCase().replace(/^0X/, '0x');
        const inputScriptRootNorm = (inputScripts[0]?.rootPublicKey || '').toUpperCase().replace(/^0X/, '0x');
        const rootsMatch = wotsRootNorm === inputScriptRootNorm;
        txLog.info(`║ wotsData vs inputScripts[0] match: ${rootsMatch ? '✅ YES' : '❌ NO MISMATCH'}`);
        
        if (!rootsMatch) {
          txLog.error('║ ❌ CRITICAL: wotsData.rootPublicKey !== inputScripts[0].rootPublicKey');
          txLog.error(`║   wotsData:      ${wotsData.rootPublicKey}`);
          txLog.error(`║   inputScripts:  ${inputScripts[0]?.rootPublicKey}`);
        }
        
        txLog.info('╠═══════════════════════════════════════════════════════════════════╣');
        txLog.info(`║ params.digestTx / transactionIdHex: ${buildResult.digestTxHex}`);
        txLog.info('╚═══════════════════════════════════════════════════════════════════╝');
        
        // ═══════════════════════════════════════════════════════════════════════
        // PREFLIGHT VALIDATION: Run txncheck simulator before serialization
        // This performs STRUCTURAL validation to catch issues early.
        // Note: This is NOT full cryptographic verification - the node does that.
        // See txncheck.ts for details on what is/isn't validated.
        // ═══════════════════════════════════════════════════════════════════════
        txLog.info(' Running preflight validation (structural checks)...');
        
        // Toggle verbose logging for debugging (set to false in production)
        const TXNCHECK_VERBOSE = true;
        
        const { runTxnCheck, buildTxnCheckContext } = await import('../core/transaction/txncheck');
        
        // Build context from available data
        // Helper to convert Uint8Array to hex string
        const bytesToHexStr = (bytes: Uint8Array | string): string => {
          if (typeof bytes === 'string') return bytes;
          return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        };
        
        const txnCheckContext = buildTxnCheckContext(
          // Inputs: from builderInputs (already normalized to base units)
          // All amounts are now consistent base-unit strings throughout the pipeline
          builderInputs.map(coin => ({
            coinId: coin.coinId,
            address: coin.address,
            amount: coin.amount,  // Already in base units
            tokenId: coin.tokenId || '0x00'  // Note: uppercase 'tokenId' in SpendableCoinInput
          })),
          // Outputs: from buildResult.transaction (convert Uint8Array to hex strings)
          buildResult.transaction.outputs.map(output => ({
            address: bytesToHexStr(output.address),
            amount: output.amount.toString(),
            tokenId: bytesToHexStr(output.tokenId)
          })),
          // Transaction ID (use a computed hash or placeholder for preflight)
          'preflight-check',
          // WOTS data with proofs
          {
            rootPublicKey: wotsData.rootPublicKey,
            hierarchical: wotsData.hierarchical,
            proofs: wotsData.proofs?.map((p: any) => ({
              publicKeyHex: p.leafPubkey || p.publicKeyHex || '',
              signatureHex: p.signature || p.signatureHex || '',
              mmrProofHex: p.mmrProof || p.mmrProofHex || ''
            })) || []
          },
          // Coin proofs
          coinProofsHex,
          // Input scripts (per-address ScriptProofs)
          inputScripts,
          // Verbose logging (controlled by TXNCHECK_VERBOSE flag above)
          TXNCHECK_VERBOSE
        );
        
        const txnCheckResult = runTxnCheck(txnCheckContext);
        
        if (!txnCheckResult.valid) {
          txLog.error('PREFLIGHT VALIDATION FAILED', { errors: txnCheckResult.errors });
          txLog.error('Continuing anyway to get node error for comparison...');
          // Note: We continue instead of throwing to compare client-side vs node validation
          // In production, you might want to throw here:
          // throw new Error(`Preflight validation failed: ${txnCheckResult.summary}`);
        } else {
          txLog.info(' ✅ Preflight validation passed');
        }
        // ═══════════════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════════════
        // Step 4.1: Attempt browser-side TxPoW mining (WASM, 30 s timeout)
        // Success → submit via /finalize-mined (node relays pre-mined TxPoW)
        // Timeout / any error → fall through to MEG-side mining (txnimport path)
        // ═══════════════════════════════════════════════════════════════════════
        let localMineSucceeded = false;
        try {
          txLog.info(' ═══════════════════════════════════════════════════════════════');
          txLog.info(' Step 4.1: Attempting browser-side TxPoW mining (WASM)...');
          txLog.info(' ═══════════════════════════════════════════════════════════════');

          // Notify UI so it can show "Mining transaction…"
          chrome.runtime.sendMessage({ type: 'TX_STAGE_UPDATE', stage: 'mining' }).catch(() => {});

          // --- 1. Fetch / use cached txnDifficulty ---
          // We fetch directly (not via fetchTxPowTarget which silently falls back
          // to the protocol floor on errors). If the request fails, we throw so
          // the outer catch falls through to MEG-side mining immediately.
          const diffNow = Date.now();
          if (!cachedTxPowDifficulty || diffNow - cachedTxPowDifficulty.fetchedAt > TXPOW_DIFFICULTY_CACHE_MS) {
            const storageVals = await chrome.storage.local.get(['AXIA_BASE']);
            const apiBase = ((storageVals.AXIA_BASE as string | undefined) || 'https://api.axia.to').replace(/\/$/, '');
            const diffCtrl = new AbortController();
            const diffTimer = setTimeout(() => diffCtrl.abort(), 5_000);
            let diffBytes: Uint8Array;
            try {
              const diffResp = await fetch(`${apiBase}/v1/wallet/txpow-params`, { signal: diffCtrl.signal });
              if (!diffResp.ok) throw new Error(`txpow-params HTTP ${diffResp.status}`);
              const diffData = (await diffResp.json()) as { minTxPowWork?: string };
              const diffHex = String(diffData.minTxPowWork ?? '').replace(/^0x/, '');
              if (diffHex.length !== 64) throw new Error(`txpow-params bad length: ${diffHex.length}`);
              diffBytes = new Uint8Array(32);
              for (let i = 0; i < 32; i++) diffBytes[i] = parseInt(diffHex.slice(i * 2, i * 2 + 2), 16);
            } finally {
              clearTimeout(diffTimer);
            }
            cachedTxPowDifficulty = { value: diffBytes, fetchedAt: Date.now() };
            txLog.info(` Step 4.1: txnDifficulty fetched from ${apiBase}/v1/wallet/txpow-params`);
          } else {
            txLog.info(` Step 4.1: Using cached txnDifficulty (age: ${((diffNow - cachedTxPowDifficulty.fetchedAt) / 1000).toFixed(0)}s)`);
          }
          const txnDifficulty: Uint8Array = cachedTxPowDifficulty.value;

          // --- 2. Build witness bytes from already-assembled data ---
          const { buildWitnessBytes } = await import('../core/transaction/MinimaTransactionBuilder');
          const witnessBytes = buildWitnessBytes(wotsData as any, coinProofsHex, inputScripts as any);
          txLog.info(` Step 4.1: witnessBytes = ${witnessBytes.length}B`);

          // --- 3. Serialize TxPoW body with real difficulty target ---
          //    serializeTxBody returns the raw body bytes; we keep them for the
          //    final assembly after mining finds a header with a winning nonce.
          const { serializeTxBody, mineTxPoW } = await import('../../../totem-sdk/packages/txpow/src/index');
          const txBodyBytes: Uint8Array = serializeTxBody(buildResult.serialized, witnessBytes, { txnDifficulty });
          txLog.info(` Step 4.1: txBodyBytes = ${txBodyBytes.length}B`);

          // --- 4. Mine with a 30 s hard timeout ---
          //    We use the public `mineTxPoW()` API (not the internal
          //    `mineTxPoWInProcess`). In the service-worker context,
          //    `mineTxPoW` routes as follows:
          //      • Node.js main thread  → worker_threads Worker (n/a here)
          //      • Browser + workerUrl  → Web Worker (n/a — MV3 service workers
          //                               cannot spawn new Worker() objects, so
          //                               we intentionally do NOT call
          //                               setBrowserWorkerUrl())
          //      • Browser, no workerUrl → in-process async loop (this path)
          //    WASM throughput is still used via the miner.wasm binary that was
          //    loaded at startup by setWasmUrl(chrome.runtime.getURL('miner.wasm')).
          const mineAbort = new AbortController();
          const mineTimeoutId = setTimeout(() => mineAbort.abort('Mining timeout (30 s)'), 30_000);
          const mineStart = performance.now();
          let mineResult: Awaited<ReturnType<typeof mineTxPoW>>;
          try {
            mineResult = await mineTxPoW(txBodyBytes, txnDifficulty, { signal: mineAbort.signal });
          } finally {
            clearTimeout(mineTimeoutId);
          }
          const mineMs = performance.now() - mineStart;
          txLog.info(` ✅ Step 4.1: Local mining SUCCESS in ${mineMs.toFixed(0)}ms, nonce=${mineResult.nonce}, src=${mineResult.source}`);

          // --- 5. Assemble full TxPoW bytes: minedHeaderBytes ++ [0x01] ++ txBodyBytes ---
          //    Wire format: TxHeader | MiniByte(0x01=hasBody) | TxBody
          const { minedHeaderBytes } = mineResult;
          const minedArr = new Uint8Array(minedHeaderBytes.length + 1 + txBodyBytes.length);
          minedArr.set(minedHeaderBytes, 0);
          minedArr[minedHeaderBytes.length] = 0x01;
          minedArr.set(txBodyBytes, minedHeaderBytes.length + 1);
          const minedHex = '0x' + Array.from(minedArr).map(b => b.toString(16).padStart(2, '0')).join('');
          txLog.info(` Step 4.1: minedHex = ${minedHex.length} chars`);

          // --- 6. Submit pre-mined TxPoW to Axia (relay-only) ---
          const { TransactionService: TxSvc } = await import('../core/transaction/service');
          const minedFinalizeResult = await TxSvc.finalizeMined({
            leaseToken: prepareResult.leaseToken,
            minedHex
          });
          if (!minedFinalizeResult?.txpowid) throw new Error('finalize-mined returned no txpowid');
          txLog.info(` ✅ Step 4.1: Locally-mined transaction broadcast, txpowid=${minedFinalizeResult.txpowid}`);

          localMineSucceeded = true;

          // Persist receipt (best-effort — don't let this block the success response)
          transactionReceiptStore.add({
            txpowid: minedFinalizeResult.txpowid,
            timestamp: Date.now(),
            to,
            amount,
            tokenId: tokenid,
            tokenSymbol: tokenSymbol || (tokenid === '0x00' ? 'MINIMA' : undefined),
            from: sourceAddress,
            indices: {
              addressIndex: prepareResult.addressIndex,
              l1: prepareResult.l1,
              l2: prepareResult.l2
            },
            leaseId: minedFinalizeResult.leaseId,
            status: 'pending',
            lifecycle: 'submitted'
          }).catch(e => txLog.warn(' Failed to persist receipt (local mine):', e));

          pollTransactionConfirmation(minedFinalizeResult.txpowid);
          if (portfolioStreamManager.isCurrentlyStreaming()) {
            setTimeout(() => portfolioStreamManager.forceRefresh().catch(() => {}), 5_000);
            setTimeout(() => portfolioStreamManager.forceRefresh().catch(() => {}), 12_000);
          }

          // Return early — skip the txnimport path entirely
          return {
            ok: true,
            txpowid: minedFinalizeResult.txpowid,
            leaseId: minedFinalizeResult.leaseId,
            addressIndex: prepareResult.addressIndex,
            l1: prepareResult.l1,
            l2: prepareResult.l2,
            miningSource: 'local' as const,
            stage: 'complete',
            id
          };

        } catch (mineErr: any) {
          if (localMineSucceeded) {
            // Receipt-save failed after a successful broadcast — re-throw so the
            // outer catch returns an error rather than silently retrying with the
            // consumed lease.
            throw mineErr;
          }
          txLog.warn(` ⚠️ Step 4.1: Local mining failed (${mineErr?.message || String(mineErr)}), falling back to MEG-side mining`);
          // Fall through to the existing txnimport path below
        }

        // Generate import ID for txnimport (matches backend format)
        const importId = `totem-${prepareResult.leaseId || Date.now()}`;
        
        // Serialize in txnexport-compatible format: [ID length][ASCII ID][Transaction][Witness]
        // Pass coinProofsHex and inputScripts for per-address ScriptProofs
        // CRITICAL FIX (January 2026): Pass buildResult.serialized to avoid re-serialization!
        // This ensures the transaction bytes in txnimport match EXACTLY what was hashed for signing.
        const txnImportBytes = serializeForTxnImport(buildResult.transaction, importId, wotsData, coinProofsHex, inputScripts, buildResult.serialized);
        const txnImportHex = toHex(txnImportBytes);
        
        // CRITICAL DIAGNOSTIC: Verify transaction bytes match what was signed
        // The txnimport format is: [MiniString ID][Transaction bytes][Witness bytes]
        // We need to verify that the transaction bytes portion matches buildResult.serialized
        if (buildResult.serialized && buildResult.serialized.length > 0 && txnImportBytes.length >= 4) {
          const idLen = (txnImportBytes[0] << 24) | (txnImportBytes[1] << 16) | (txnImportBytes[2] << 8) | txnImportBytes[3];
          const txnBytesStart = 4 + idLen; // Skip 4-byte length + ID string
          
          // Validate bounds before slicing
          if (txnBytesStart + buildResult.serialized.length <= txnImportBytes.length) {
            const txnBytesInImport = txnImportBytes.slice(txnBytesStart, txnBytesStart + buildResult.serialized.length);
            const txnBytesMatch = buildResult.serialized.length === txnBytesInImport.length &&
              buildResult.serialized.every((b, i) => b === txnBytesInImport[i]);
            
            if (!txnBytesMatch) {
              txLog.error(' CRITICAL: Transaction bytes in txnimport do NOT match signed bytes!');
              txLog.error(` Expected ${buildResult.serialized.length} bytes, got ${txnBytesInImport.length} bytes`);
              txLog.error(` Signed digest: ${buildResult.digestTxHex}`);
              throw new Error('Transaction serialization mismatch - digest will not verify');
            }
            txLog.info(' VERIFIED: Transaction bytes in txnimport MATCH signed bytes exactly');
          } else {
            txLog.warn(` Skipping txn byte verification: bounds out of range (start=${txnBytesStart}, need=${buildResult.serialized.length}, have=${txnImportBytes.length})`);
          }
        } else {
          txLog.warn(' Skipping txn byte verification: buildResult.serialized not available or txnImportBytes too short');
        }
        
        // DIAGNOSTIC: Detailed serialization logging
        const txnImportByteCount = txnImportBytes.length;
        txLog.info(' ╔══════════════════════════════════════════════════════════════╗');
        txLog.info(' ║           SERIALIZED TRANSACTION (DIAGNOSTIC)               ║');
        txLog.info(' ╠══════════════════════════════════════════════════════════════╣');
        txLog.info(` ║ Total bytes: ${txnImportByteCount}B (hex chars: ${txnImportHex.length})`);
        txLog.info(` ║ Import ID: ${importId}`);
        txLog.info(` ║ First 64 chars: ${txnImportHex.slice(0, 64)}`);
        txLog.info(` ║ Last 64 chars: ...${txnImportHex.slice(-64)}`);
        
        // DEBUG FLAG: Toggle to true to log FULL hex (warning: very large, ~36K chars!)
        // Set to false in production to reduce console output and avoid sensitive data exposure
        const DEBUG_FULL_HEX = true;
        if (DEBUG_FULL_HEX) {
          txLog.info(' ╠══════════════════════════════════════════════════════════════╣');
          txLog.info(' ║ FULL SIGNED HEX (DEBUG_FULL_HEX=true):');
          txLog.info(' ║ <<<BEGIN_TXN_HEX>>>');
          // Log in chunks to avoid console truncation
          const chunkSize = 1000;
          for (let i = 0; i < txnImportHex.length; i += chunkSize) {
            txLog.info(` ║ ${txnImportHex.slice(i, i + chunkSize)}`);
          }
          txLog.info(' ║ <<<END_TXN_HEX>>>');
        }
        txLog.info(' ╚══════════════════════════════════════════════════════════════╝');
        
        txLog.info(' Step 4 complete: Transaction assembled for txnimport', {
          txnImportHexLength: txnImportHex.length,
          txnImportByteCount,
          importId
        });
        
        // Step 5: Finalize (submit via txnimport + txnpost)
        // Send hex directly - we use bypass URL (api2.axia.to) to avoid Cloudflare WAF
        txLog.info('Step 5: Submitting transaction for broadcast...');
        txLog.debug(`Transaction hex length: ${txnImportHex.length}`);
        
        const finalizeResult = await walletManager.finalizeTransaction({
          leaseToken: prepareResult.leaseToken,
          signedHex: txnImportHex,  // Send as hex - bypass URL avoids Cloudflare WAF issues
          importId  // Pass importId so backend uses matching ID
        });
        
        // DIAGNOSTIC: Log full node response and parse for comparison
        const finalizeAny = finalizeResult as any;
        txLog.info(' ╔══════════════════════════════════════════════════════════════╗');
        txLog.info(' ║           NODE RESPONSE (DIAGNOSTIC)                        ║');
        txLog.info(' ╠══════════════════════════════════════════════════════════════╣');
        txLog.info(` ║ Success: ${finalizeResult?.ok ? 'YES' : 'NO'}`);
        txLog.info(` ║ Full response: ${JSON.stringify(finalizeResult, null, 2)}`);
        if (finalizeAny?.error) {
          txLog.error(` ║ ❌ Error: ${finalizeAny.error}`);
        }
        if (finalizeAny?.nodeResponse) {
          txLog.info(` ║ Node response details: ${JSON.stringify(finalizeAny.nodeResponse, null, 2)}`);
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // DIAGNOSTIC: Parse node response for side-by-side comparison
        // ═══════════════════════════════════════════════════════════════════════
        const nodeResponse = finalizeAny?.nodeResponse || finalizeAny?.response || finalizeAny?.data || {};
        const nodeTxnCheck = nodeResponse?.valid || nodeResponse?.txncheck || {};
        const nodeSignatures = nodeTxnCheck?.signatures || nodeResponse?.signatures || [];
        const nodeInputs = nodeTxnCheck?.inputs || nodeResponse?.inputs || [];
        
        // Extract node's expected publickey from first signature
        const nodeExpectedPk = nodeSignatures?.[0]?.publickey || nodeSignatures?.[0]?.pubkey || 'N/A';
        // Extract node's computed txid
        const nodeTxId = nodeTxnCheck?.txnid || nodeResponse?.txnid || nodeResponse?.txid || 'N/A';
        // Extract input address from node response
        const nodeInputAddress = nodeInputs?.[0]?.address || nodeInputs?.[0]?.script || 'N/A';
        
        if (nodeExpectedPk !== 'N/A' || nodeTxId !== 'N/A') {
          txLog.info(' ╠══════════════════════════════════════════════════════════════╣');
          txLog.info(' ║           CLIENT vs NODE COMPARISON                          ║');
          txLog.info(' ╠══════════════════════════════════════════════════════════════╣');
          
          // Public key comparison
          txLog.info(' ║ PUBLIC KEY:');
          txLog.info(` ║   Client (wotsData.rootPublicKey): ${wotsData.rootPublicKey || 'N/A'}`);
          txLog.info(` ║   Node (signatures[0].publickey):  ${nodeExpectedPk}`);
          const clientPkNorm = (wotsData.rootPublicKey || '').toUpperCase().replace(/^0X/, '0x');
          const nodePkNorm = (nodeExpectedPk || '').toUpperCase().replace(/^0X/, '0x');
          const pkMatch = clientPkNorm === nodePkNorm;
          txLog.info(` ║   Match: ${pkMatch ? '✅ YES' : '❌ NO - THIS IS THE BUG!'}`);
          
          if (!pkMatch && nodeExpectedPk !== 'N/A') {
            txLog.error(' ║ ❌ PUBLIC KEY MISMATCH DETECTED!');
            txLog.error(' ║   The node expected a different public key than we provided.');
            txLog.error(' ║   Check: Is wotsData.rootPublicKey the correct Level-1 address key?');
          }
          
          // Transaction ID comparison
          txLog.info(' ║ TRANSACTION ID:');
          txLog.info(` ║   Client (digestTxHex): ${buildResult.digestTxHex}`);
          txLog.info(` ║   Node (txnid):         ${nodeTxId}`);
          const clientTxNorm = (buildResult.digestTxHex || '').toUpperCase().replace(/^0X/, '0x');
          const nodeTxNorm = (nodeTxId || '').toUpperCase().replace(/^0X/, '0x');
          const txIdMatch = clientTxNorm === nodeTxNorm;
          txLog.info(` ║   Match: ${txIdMatch ? '✅ YES' : '❌ NO - SERIALIZATION BUG!'}`);
          
          if (!txIdMatch && nodeTxId !== 'N/A') {
            txLog.error(' ║ ❌ TXID MISMATCH DETECTED!');
            txLog.error(' ║   The node computed a different transaction digest.');
            txLog.error(' ║   Check: Is the transaction serialization byte-exact with Java?');
          }
          
          // Input address
          if (nodeInputAddress !== 'N/A') {
            txLog.info(' ║ INPUT ADDRESS:');
            txLog.info(` ║   Client (inputScripts[0]): ${inputScripts[0]?.address || 'N/A'}`);
            txLog.info(` ║   Node (inputs[0].address): ${nodeInputAddress}`);
          }
        }
        
        txLog.info(' ╚══════════════════════════════════════════════════════════════╝');
        
        if (!finalizeResult || !finalizeResult.ok) {
          throw new Error(`Failed to finalize transaction: ${finalizeAny?.error || 'Unknown error'}`);
        }
        
        txLog.info(' Transaction complete!', {
          txpowid: finalizeResult.txpowid,
          leaseId: finalizeResult.leaseId
        });
        
        // Persist transaction receipt
        await transactionReceiptStore.add({
          txpowid: finalizeResult.txpowid,
          timestamp: Date.now(),
          to,
          amount,
          tokenId: tokenid,
          tokenSymbol: tokenSymbol || (tokenid === '0x00' ? 'MINIMA' : undefined),
          from: sourceAddress,
          indices: {
            addressIndex: prepareResult.addressIndex,
            l1: prepareResult.l1,
            l2: prepareResult.l2
          },
          leaseId: finalizeResult.leaseId,
          status: 'pending',
          lifecycle: 'submitted'
        });
        
        txLog.info(' Receipt persisted');
        
        // Start background polling for this transaction
        pollTransactionConfirmation(finalizeResult.txpowid);

        // Trigger portfolio refresh after the transaction propagates to the network.
        // Two attempts: 5s (fast nodes) and 12s (covers typical NEWTXPOW webhook latency).
        if (portfolioStreamManager.isCurrentlyStreaming()) {
          setTimeout(() => portfolioStreamManager.forceRefresh().catch(() => {}), 5_000);
          setTimeout(() => portfolioStreamManager.forceRefresh().catch(() => {}), 12_000);
        }

        // Return success with all relevant data
        return {
          ok: true,
          txpowid: finalizeResult.txpowid,
          leaseId: finalizeResult.leaseId,
          addressIndex: prepareResult.addressIndex,
          l1: prepareResult.l1,
          l2: prepareResult.l2,
          miningSource: 'meg' as const,
          stage: 'complete',
          id
        };
        
      } catch (error: any) {
        txLog.error(' Transaction failed:', error);
        
        // Handle CoinSelectionError specifically for better user messaging
        if (error instanceof CoinSelectionError) {
          let userMessage = error.message;
          if (error.code === 'SERVICE_UNAVAILABLE') {
            userMessage = 'Coin lookup service is temporarily unavailable. Please try again in a moment.';
          } else if (error.code === 'NETWORK_ERROR') {
            userMessage = 'Network error - please check your connection and try again.';
          }
          
          return {
            ok: false,
            error: userMessage,
            stage: 'coin_selection',
            errorCode: error.code,
            id
          };
        }
        
        // Determine which stage failed for better error reporting
        let stage = 'unknown';
        if (error.message?.includes('lease') || error.message?.includes('addressIndex')) stage = 'prepare';
        else if (error.message?.includes('sign') || error.message?.includes('ACCOUNT_NOT_FOUND') || error.message?.includes('INVALID_ADDRESS_INDEX') || error.message?.includes('INVALID_SIGNING_INDICES') || error.message?.includes('PUBKEY_MISMATCH') || error.message?.includes('TreeKey')) stage = 'sign';
        else if (error.message?.includes('finalize') || error.message?.includes('post')) stage = 'finalize';
        else if (error.message?.includes('locked') || error.message?.includes('SESSION_EXPIRED')) stage = 'unlock';
        else if (error.message?.includes('coin') || error.message?.includes('UTXO')) stage = 'coin_selection';
        
        return {
          ok: false,
          error: error.message || 'Transaction failed',
          stage,
          id
        };
      }
    }

    case 'WOTS_SIGN_DATA': {
      try {
        const {
          unsignedHex,
          inputIndices,
          sourceAddress,
          inputAddresses,
          returnFormat = 'hex',
          perAddressPublicKey
        } = params || {};

        if (!unsignedHex || typeof unsignedHex !== 'string') {
          return { ok: false, error: 'unsignedHex is required', id };
        }
        if (!sourceAddress || typeof sourceAddress !== 'string') {
          return { ok: false, error: 'sourceAddress is required', id };
        }

        const addressIndex = walletManager.getAddressIndex(sourceAddress);
        if (addressIndex === null) {
          return { ok: false, error: `sourceAddress ${sourceAddress} not found in wallet`, errorCode: 'ACCOUNT_NOT_FOUND', id };
        }

        const account = walletManager.getAccountByIndex(addressIndex);
        if (!account) {
          return { ok: false, error: 'Connected account not found', errorCode: 'ACCOUNT_NOT_FOUND', id };
        }

        const perAddressTreeKey = walletManager.getPerAddressTreeKey(addressIndex);
        if (!perAddressTreeKey) {
          return { ok: false, error: 'Per-address TreeKey not available (wallet locked?)', id };
        }

        // Derive transaction digest from unsignedHex
        const hexStr = unsignedHex.startsWith('0x') ? unsignedHex.slice(2) : unsignedHex;
        const txBytes = new Uint8Array(hexStr.length / 2);
        for (let i = 0; i < hexStr.length; i += 2) {
          txBytes[i / 2] = parseInt(hexStr.slice(i, i + 2), 16);
        }
        const digestBytes = sha3_256(txBytes);
        const digestTx = '0x' + Array.from(digestBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        // Allocate signing indices for this address (same model as TOTEM_VERIFY)
        await watermarkStore.initialize();
        const signingIndices = watermarkStore.getNextIndicesForAddress(addressIndex);
        if (!signingIndices) {
          return { ok: false, error: 'No available signing indices for this address (exhausted)', id };
        }
        const { l1, l2 } = signingIndices;

        // Sign with per-address TreeKey (setUses + sign for Java parity)
        const KEYS_PER_LEVEL = 64;
        const uses = l1 * KEYS_PER_LEVEL + l2;
        perAddressTreeKey.setUses(uses);
        const treeSignature: TreeSignature = perAddressTreeKey.sign(digestBytes);
        await watermarkStore.advanceWatermark({ addressIndex, l1, l2 });

        // Serialize signature
        const signatureBytes = serializeTreeSignature(treeSignature);
        const signatureHex = '0x' + Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        // Build the witness bundle in the hex format expected by MinimaTransactionBuilder / Pact
        const rootPublicKeyHex = perAddressPublicKey || '0x' + Array.from(perAddressTreeKey.getPublicKey()).map(b => b.toString(16).padStart(2, '0')).join('');
        const proofs = treeSignature.proofs.map((proof: any) => ({
          leafPubkey: '0x' + Array.from(proof.leafPubkey).map((b: number) => b.toString(16).padStart(2, '0')).join(''),
          signature: '0x' + Array.from(proof.signature).map((b: number) => b.toString(16).padStart(2, '0')).join(''),
          mmrProof: '0x' + Array.from(serializeMMRProof(proof.mmrProof)).map((b: number) => b.toString(16).padStart(2, '0')).join('')
        }));

        const signedHex = signatureHex;

        return {
          ok: true,
          result: {
            success: true,
            signedHex,
            signatures: [{
              addressIndex,
              l1,
              l2,
              rootPublicKey: rootPublicKeyHex,
              publicKey: rootPublicKeyHex,
              signature: signatureHex,
              proofs,
              signerAddress: ensureMx(account.address),
              signerIndex: addressIndex
            }],
            inputsSigned: inputIndices || [],
            digestTx,
            returnFormat,
            status: 'signed'
          },
          id
        };
      } catch (error: any) {
        console.error('[WOTS_SIGN_DATA] Error:', error);
        return { ok: false, error: error.message || 'WOTS_SIGN_DATA failed', id };
      }
    }
    
    case 'dapp:connect':
      walletManager.connectDapp(params[0], params[1], params[2]);
      return { ok: true, result: true, id };
    
    case 'dapp:disconnect':
      walletManager.disconnectDapp(params[0]);
      return { ok: true, result: true, id };
    
    case 'dapp:getConnected':
      try {
        const connectedSites = connectedSitesStore.getAllSites();
        const formattedSites = connectedSites.map(site => ({
          origin: site.origin,
          name: new URL(site.origin).hostname,
          permissions: Object.entries(site.permissions)
            .filter(([_, v]) => v)
            .map(([k]) => k),
          connectedAt: site.connectedAt,
          lastUsed: site.lastUsedAt
        }));
        return { ok: true, result: formattedSites, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'TOTEM_CONNECT': {
      try {
        const { origin } = params || {};
        
        if (!origin) {
          return { ok: false, error: 'Origin is required', id };
        }

        const unlocked = await ensureUnlocked('A dApp wants to connect to your wallet');
        if (!unlocked) {
          return { ok: false, error: 'Wallet is locked', id };
        }
        
        console.log('[TOTEM_CONNECT] Connection request from:', origin);
        
        const existingSite = connectedSitesStore.getSite(origin);
        if (existingSite) {
          console.log('[TOTEM_CONNECT] Site already connected, returning existing address');
          await connectedSitesStore.updateLastUsed(origin);
          const reconnectAccount = walletManager.getAccountByIndex(existingSite.addressIndex);
          return {
            ok: true,
            result: {
              connected: true,
              address: ensureMx(existingSite.minimaAddress),
              addressIndex: existingSite.addressIndex,
              publicKey: reconnectAccount?.publicKey ?? null,
              isReconnect: true
            },
            id
          };
        }
        
        const accounts = walletManager.getAllAccounts();
        if (accounts.length === 0) {
          return { ok: false, error: 'Wallet not initialized', id };
        }
        
        console.log('[TOTEM_CONNECT] First-time connection, showing address picker popup');

        // Best-effort pre-warm: trigger an HTTP portfolio fetch for all subscribed
        // addresses so the popup shows real balances rather than the stale '0' that
        // walletManager holds.  We race against a 1.5 s wall-clock timeout so the
        // popup always opens promptly even if the API is slow or unreachable.
        await Promise.race([
          portfolioStreamManager.forceRefresh().catch((err: unknown) => {
            console.warn('[TOTEM_CONNECT] portfolio pre-warm failed:', err);
          }),
          new Promise<void>(resolve => setTimeout(resolve, 1500)),
        ]);

        // Enrich each account's balance from the portfolio cache.
        // getCachedPortfolio() reads chrome.storage.local synchronously-ish —
        // it will have data if the stream has fetched at least once since unlock.
        // Fall back to acc.balance (typically '0') when no cache entry exists yet.
        const enrichedAccounts = await Promise.all(
          accounts.map(async acc => {
            const entries = await portfolioStreamManager.getCachedPortfolio(acc.address).catch(() => null);
            const native = entries?.find(e => e.kind === 'native');
            return {
              index: acc.index,
              address: acc.address,
              balance: native?.confirmed ?? acc.balance,
              name: acc.name,
            };
          })
        );

        const selectedIndex = await showConnectApprovalPopup({
          origin,
          accounts: enrichedAccounts,
        });
        
        if (selectedIndex === null) {
          return { ok: false, error: 'User rejected connection', id };
        }
        
        const selectedAccount = walletManager.getAccountByIndex(selectedIndex);
        if (!selectedAccount) {
          return { ok: false, error: `Address index ${selectedIndex} not found`, id };
        }
        
        const site = await connectedSitesStore.connectSite(
          origin,
          selectedIndex,
          selectedAccount.address
        );
        
        console.log('[TOTEM_CONNECT] Connection approved:', { origin, addressIndex: selectedIndex });

        // Pre-warm the portfolio cache for the newly connected address so the extension
        // popup UI shows an accurate portfolio immediately (balance is not exposed to dApps).
        portfolioStreamManager.getCachedPortfolio(site.minimaAddress).catch((err) => {
          console.warn('[TOTEM_CONNECT] portfolio cache pre-warm failed:', err);
        });
        console.log('[TOTEM_CONNECT] Pre-warming portfolio cache for newly connected address');

        return {
          ok: true,
          result: {
            connected: true,
            address: ensureMx(site.minimaAddress),
            addressIndex: site.addressIndex,
            publicKey: selectedAccount.publicKey ?? null,
          },
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_CONNECT] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'TOTEM_CONNECT_APPROVE': {
      try {
        const { origin, addressIndex } = params || {};
        
        if (!origin || addressIndex === undefined) {
          return { ok: false, error: 'Origin and addressIndex are required', id };
        }
        
        const account = walletManager.getAccountByIndex(addressIndex);
        if (!account) {
          return { ok: false, error: `Address index ${addressIndex} not found`, id };
        }
        
        console.log('[TOTEM_CONNECT_APPROVE] Approving connection:', { origin, addressIndex });
        
        const site = await connectedSitesStore.connectSite(
          origin,
          addressIndex,
          account.address
        );

        // Pre-warm the portfolio cache for the newly connected address so the extension
        // popup UI shows an accurate portfolio immediately (balance is not exposed to dApps).
        portfolioStreamManager.getCachedPortfolio(site.minimaAddress).catch((err) => {
          console.warn('[TOTEM_CONNECT_APPROVE] portfolio cache pre-warm failed:', err);
        });
        console.log('[TOTEM_CONNECT_APPROVE] Pre-warming portfolio cache for newly connected address');
        
        return {
          ok: true,
          result: {
            connected: true,
            address: ensureMx(site.minimaAddress),
            addressIndex: site.addressIndex
          },
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_CONNECT_APPROVE] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'TOTEM_VERIFY': {
      try {
        const { origin, challenge: challengeRequest } = params || {};
        
        if (!origin) {
          return { ok: false, error: 'Origin is required', id };
        }

        const unlocked = await ensureUnlocked('A dApp wants to verify your identity');
        if (!unlocked) {
          return { ok: false, error: 'Wallet is locked', id };
        }
        
        console.log('[TOTEM_VERIFY] Verification request from:', origin);
        
        const site = connectedSitesStore.getSite(origin);
        if (!site) {
          return { ok: false, error: 'Site not connected. Call TOTEM_CONNECT first.', id };
        }
        
        if (!site.permissions.canVerify) {
          return { ok: false, error: 'Site does not have verification permission', id };
        }
        
        const account = walletManager.getAccountByIndex(site.addressIndex);
        if (!account) {
          return { ok: false, error: 'Connected address not found in wallet', id };
        }
        
        const builder = ChallengeBuilder.create()
          .setDomain(origin)
          .setAddress(account.address);
        
        if (challengeRequest?.statement) {
          builder.setStatement(challengeRequest.statement);
        }
        if (challengeRequest?.nonce) {
          builder.setNonce(challengeRequest.nonce);
        }
        if (challengeRequest?.expiryMs) {
          builder.setExpiry(challengeRequest.expiryMs);
        }
        
        const serialized = builder.build();
        
        console.log('[TOTEM_VERIFY] Challenge built, fetching signing indices...');
        console.log('[TOTEM_VERIFY]   Site address index:', site.addressIndex);
        console.log('[TOTEM_VERIFY]   Domain:', origin);

        // v4.1: sign from the connected spend address. The proof's publicKey
        // is the spend address's root public key, so backends can verify with
        // the one-liner verifySignatureDetailed(address, message, sig, pubkey).
        const addressIndex = site.addressIndex;
        const perAddressTreeKey = walletManager.getPerAddressTreeKey(addressIndex);
        if (!perAddressTreeKey) {
          return { ok: false, error: 'Per-address TreeKey not available (wallet locked?)', id };
        }

        // Get next available indices from watermark BEFORE showing popup so the user
        // can see exactly which leaf will be consumed in the approval screen.
        // CRITICAL: Must use initialize() not load() - load() returns null for fresh/legacy wallets
        // leaving this.state null, which causes getNextIndicesForAddress() to return null
        await watermarkStore.initialize();
        const signingIndices = watermarkStore.getNextIndicesForAddress(addressIndex);
        if (!signingIndices) {
          return { ok: false, error: 'No available signing indices for this address (exhausted)', id };
        }

        const l1 = signingIndices.l1;
        const l2 = signingIndices.l2;

        const capacity = watermarkStore.getAddressCapacity(addressIndex);
        if (capacity.level !== 'ok') {
          console.warn(
            `[TOTEM_VERIFY] Address ${addressIndex} signature capacity ${capacity.level}: ` +
            `${capacity.used}/${capacity.total} (${capacity.percentage.toFixed(2)}%) used`
          );
        }

        console.log('[TOTEM_VERIFY] Showing approval popup...');
        const approved = await showVerifyApprovalPopup({
          challenge: serialized.challenge,
          rawMessage: serialized.message,
          addressIndex: site.addressIndex,
          minimaAddress: account.address,
          origin,
          wotsIndices: { l1, l2 },
          capacity
        });
        
        if (!approved) {
          console.log('[TOTEM_VERIFY] User rejected verification request');
          return { ok: false, error: 'User rejected verification request', id };
        }
        
        if (serialized.challenge.expiresAt <= Date.now()) {
          return { ok: false, error: 'Challenge expired', id };
        }
        
        console.log('[TOTEM_VERIFY] User approved, signing with per-address TreeKey...');
        
        // CRITICAL FIX (2026-02-05): Convert (l1, l2) indices to 'uses' counter for Java parity
        // Java's TreeKey.sign() uses baseConversion(uses) to produce 3 proofs
        const KEYS_PER_LEVEL = 64;
        const uses = l1 * KEYS_PER_LEVEL + l2;
        console.log(`[TOTEM_VERIFY] Using uses=${uses} (from l1=${l1}, l2=${l2}) for address ${addressIndex}`);
        
        // Use setUses() + sign() to produce 3 proofs matching Java exactly
        // Java pattern: tk.setUses(uses) → tk.sign(zData) → produces 3 proofs
        perAddressTreeKey.setUses(uses);
        const treeSignature: TreeSignature = perAddressTreeKey.sign(serialized.digest);
        console.log(`[TOTEM_VERIFY] Generated ${treeSignature.proofs.length} proofs (should be 3 for Java parity)`);
        
        // Advance watermark after signing to prevent reuse
        await watermarkStore.advanceWatermark({ addressIndex, l1, l2 });
        console.log(`[TOTEM_VERIFY] Watermark advanced to next available slot`);
        
        const signatureBytes = serializeTreeSignature(treeSignature);
        const signatureHex = '0x' + Array.from(signatureBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        // Per-address TreeKey root IS the address public key
        const addressPubkey = perAddressTreeKey.getPublicKey();
        const rootPubkeyHex = '0x' + Array.from(addressPubkey)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        const verifyBuf = new Uint8Array(16);
        crypto.getRandomValues(verifyBuf);
        const verificationId = `verify-${Date.now()}-${Array.from(verifyBuf).map(b => b.toString(16).padStart(2, '0')).join('')}`;
        await connectedSitesStore.recordVerification({
          id: verificationId,
          origin,
          addressIndex: site.addressIndex,
          challenge: serialized.message,
          nonce: serialized.challenge.nonce,
          signedAt: Date.now(),
          expiresAt: serialized.challenge.expiresAt,
          treeIndices: { l1: addressIndex, l2: l1, l3: l2 }
        });
        
        await connectedSitesStore.updateLastUsed(origin);
        
        console.log('[TOTEM_VERIFY] Signature generated successfully');
        
        const verifyResult: Record<string, unknown> = {
          verified: true,
          verificationId,
          address: ensureMx(account.address),
          message: serialized.message,
          signature: signatureHex,
          publicKey: rootPubkeyHex,
          expiresAt: serialized.challenge.expiresAt
        };

        const globalRootPublicKey = walletManager.getRootPublicKey();
        if (globalRootPublicKey) {
          verifyResult.rootPublicKey = globalRootPublicKey;
        }

        return {
          ok: true,
          result: verifyResult,
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_VERIFY] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'TOTEM_SEND_TRANSACTION': {
      try {
        const { origin, request: txRequest } = params || {};
        
        if (!origin) {
          return { 
            ok: true,
            result: { success: false, error: 'Origin is required', errorCode: 'INVALID_REQUEST' },
            id 
          };
        }
        
        console.log('[TOTEM_SEND_TRANSACTION] Transaction request from:', origin);
        
        const site = connectedSitesStore.getSite(origin);
        if (!site) {
          return { 
            ok: true,
            result: { success: false, error: 'Site not connected. Call TOTEM_CONNECT first.', errorCode: 'SITE_NOT_CONNECTED' },
            id 
          };
        }
        
        if (!txRequest || typeof txRequest !== 'object') {
          return {
            ok: true,
            result: { success: false, error: 'Invalid transaction request', errorCode: 'INVALID_REQUEST' },
            id
          };
        }
        
        if (txRequest.version !== 1) {
          return {
            ok: true,
            result: { success: false, error: `Unsupported version: ${txRequest.version}. Expected 1`, errorCode: 'INVALID_REQUEST' },
            id
          };
        }
        
        if (!Array.isArray(txRequest.outputs) || txRequest.outputs.length === 0) {
          return {
            ok: true,
            result: { success: false, error: 'outputs must be a non-empty array', errorCode: 'INVALID_REQUEST' },
            id
          };
        }
        
        for (let i = 0; i < txRequest.outputs.length; i++) {
          const output = txRequest.outputs[i];
          if (!output.address || typeof output.address !== 'string') {
            return {
              ok: true,
              result: { success: false, error: `outputs[${i}].address is required`, errorCode: 'INVALID_REQUEST' },
              id
            };
          }
          if (!output.amount || typeof output.amount !== 'string') {
            return {
              ok: true,
              result: { success: false, error: `outputs[${i}].amount is required`, errorCode: 'INVALID_REQUEST' },
              id
            };
          }
        }
        
        const intent = txRequest.intent || 'send';
        const primaryOutput = txRequest.outputs[0];
        const tokenId = primaryOutput.tokenId || '0x00';
        const amount = primaryOutput.amount;
        
        const permissionCheck = connectedSitesStore.canExecuteTransaction(
          origin,
          intent,
          tokenId,
          amount
        );
        
        if (!permissionCheck.allowed) {
          console.log('[TOTEM_SEND_TRANSACTION] Permission denied:', permissionCheck.reason);
          
          const txPerm = connectedSitesStore.getTransactionPermission(origin);
          if (!txPerm) {
            return {
              ok: true,
              result: { 
                success: false, 
                error: 'Transaction permission required',
                errorCode: 'PERMISSION_DENIED',
                requiresApproval: true,
                requestedIntent: intent,
                requestedToken: tokenId,
                requestedAmount: amount
              },
              id
            };
          }
          
          return {
            ok: true,
            result: { 
              success: false, 
              error: permissionCheck.reason,
              errorCode: 'PERMISSION_DENIED'
            },
            id
          };
        }
        
        console.log('[TOTEM_SEND_TRANSACTION] Showing approval popup for user confirmation...');
        
        const approved = await showTransactionApprovalPopup({
          origin,
          to: primaryOutput.address,
          amount: amount,
          tokenId: tokenId,
          intent: intent
        });
        
        if (!approved) {
          console.log('[TOTEM_SEND_TRANSACTION] User rejected transaction');
          return {
            ok: true,
            result: {
              success: false,
              error: 'Transaction rejected by user',
              errorCode: 'USER_REJECTED'
            },
            id
          };
        }
        
        console.log('[TOTEM_SEND_TRANSACTION] User approved transaction, proceeding...');
        
        console.log('[TOTEM_SEND_TRANSACTION] Permission granted, preparing transaction...');
        
        const account = walletManager.getAccountByIndex(site.addressIndex);
        if (!account) {
          return { 
            ok: true,
            result: { success: false, error: 'Connected address not found in wallet', errorCode: 'BUILD_FAILED' },
            id 
          };
        }
        
        const internalSender: chrome.runtime.MessageSender = { id: chrome.runtime.id };
        const wotsSendResult = await handleMessage({
          method: 'WOTS_SEND',
          params: {
            to: primaryOutput.address,
            amount: amount,
            tokenid: tokenId,
            sourceAddress: account.address,
            sendMode: 'single'
          },
          id: `wots-send-${Date.now()}`
        }, internalSender);
        
        if (wotsSendResult.error) {
          return {
            ok: true,
            result: { 
              success: false, 
              error: wotsSendResult.error,
              errorCode: 'BUILD_FAILED'
            },
            id
          };
        }
        
        await connectedSitesStore.recordTransaction(origin, tokenId, amount);
        await connectedSitesStore.updateLastUsed(origin);
        
        console.log('[TOTEM_SEND_TRANSACTION] Transaction successful:', wotsSendResult.result?.txpowid);
        
        return {
          ok: true,
          result: {
            success: true,
            txpowid: wotsSendResult.result?.txpowid,
            status: 'submitted'
          },
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_SEND_TRANSACTION] Error:', error);
        return { 
          ok: false,
          error: error.message,
          id 
        };
      }
    }
    
    case 'TOTEM_GRANT_TX_PERMISSION': {
      try {
        const { config } = params || {};

        // SECURITY: derive trusted origin from browser-verified sender.tab.url,
        // NOT from params.origin which the dApp could spoof.
        let trustedOrigin: string | null = null;
        if (sender?.tab?.url) {
          try { trustedOrigin = new URL(sender.tab.url).origin; } catch { trustedOrigin = null; }
        }
        if (!trustedOrigin) {
          return { ok: false, error: 'Cannot determine caller origin', id };
        }

        if (!config) {
          return { ok: false, error: 'Config is required', id };
        }

        console.log('[TOTEM_GRANT_TX_PERMISSION] Requesting user confirmation for:', trustedOrigin);

        // SECURITY: show confirmation popup — user must explicitly approve the permission grant.
        const approved = await showPermissionApprovalPopup({
          origin: trustedOrigin,
          allowedIntents: config.allowedIntents || ['send', 'token_send'],
          expiresInDays: config.expiresInDays || 30,
          tokenLimits: config.tokenLimits || []
        });

        if (!approved) {
          return { ok: false, error: 'Permission request denied by user', id };
        }

        const success = await connectedSitesStore.grantTransactionPermission(trustedOrigin, {
          allowedIntents: config.allowedIntents || ['send', 'token_send'],
          tokenLimits: config.tokenLimits || [],
          expiresInDays: config.expiresInDays || 30
        });

        console.log('[TOTEM_GRANT_TX_PERMISSION] Permission granted to:', trustedOrigin);
        return { ok: true, result: { success }, id };
      } catch (error: any) {
        console.error('[TOTEM_GRANT_TX_PERMISSION] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'TOTEM_REVOKE_TX_PERMISSION': {
      try {
        // SECURITY: derive trusted origin from browser-verified sender.tab.url,
        // NOT from params.origin which the dApp could spoof.
        let trustedOrigin: string | null = null;
        if (sender?.tab?.url) {
          try { trustedOrigin = new URL(sender.tab.url).origin; } catch { trustedOrigin = null; }
        }
        if (!trustedOrigin) {
          return { ok: false, error: 'Cannot determine caller origin', id };
        }

        console.log('[TOTEM_REVOKE_TX_PERMISSION] Revoking permission from:', trustedOrigin);

        const success = await connectedSitesStore.revokeTransactionPermission(trustedOrigin);
        return { ok: true, result: { success }, id };
      } catch (error: any) {
        console.error('[TOTEM_REVOKE_TX_PERMISSION] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'TOTEM_GET_TX_PERMISSIONS': {
      try {
        // v4.0.0: scoped to the calling origin only.
        // A dApp may only read its own permissions — not all connected sites.
        // SECURITY: derive trusted origin from sender.tab.url (browser-verified),
        // NOT from params.origin which the dApp could spoof.
        let trustedOrigin: string | null = null;
        if (sender?.tab?.url) {
          try { trustedOrigin = new URL(sender.tab.url).origin; } catch { trustedOrigin = null; }
        }
        if (!trustedOrigin) {
          return { ok: false, error: 'Cannot determine caller origin', id };
        }
        const sites = connectedSitesStore.getSitesWithTransactionPermissions();
        const ownSites = sites.filter(site => site.origin === trustedOrigin);
        return {
          ok: true,
          result: ownSites.map(site => ({
            origin: site.origin,
            address: ensureMx(site.minimaAddress),
            permissions: site.transactionPermissions
          })),
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_GET_TX_PERMISSIONS] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'GET_CONNECTED_SITES': {
      try {
        await connectedSitesStore.load();
        const sites = connectedSitesStore.getAllSites();

        // Enrich each site with the per-address signature capacity so the UI
        // can warn the user when a connected dApp's address is running low on
        // one-time signatures (Task #84).
        type EnrichedSite = (typeof sites)[number] & {
          capacity?: ReturnType<typeof watermarkStore.getAddressCapacity>;
        };
        let enriched: EnrichedSite[] = sites;
        try {
          await watermarkStore.initialize();
          enriched = sites.map((site): EnrichedSite => ({
            ...site,
            capacity: watermarkStore.getAddressCapacity(site.addressIndex)
          }));
        } catch (capErr) {
          console.warn('[GET_CONNECTED_SITES] Could not compute capacity:', capErr);
        }

        console.log('[GET_CONNECTED_SITES] Returning', enriched.length, 'sites');
        return { ok: true, result: enriched, id };
      } catch (error: any) {
        console.error('[GET_CONNECTED_SITES] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'TOTEM_GET_ACCOUNTS': {
      try {
        const { origin } = params || {};
        
        if (!origin) {
          return { ok: false, error: 'Origin is required', id };
        }
        
        console.log('[TOTEM_GET_ACCOUNTS] Request from:', origin);
        
        const hasWallet = await walletManager.hasEncryptedSeed();
        if (!hasWallet) {
          return { ok: false, error: 'Wallet not initialized', id };
        }
        
        const walletState = await walletManager.getStateAsync();
        if (walletState.locked) {
          return { ok: false, error: 'Wallet is locked', id };
        }
        
        const site = connectedSitesStore.getSite(origin);
        if (!site) {
          return { ok: false, error: 'Site not connected. Call TOTEM_CONNECT first.', id };
        }
        
        const account = walletManager.getAccountByIndex(site.addressIndex);
        if (!account) {
          return { ok: false, error: 'Connected account no longer exists in wallet', id };
        }
        
        console.log('[TOTEM_GET_ACCOUNTS] Returning account for index:', site.addressIndex);
        
        // v4.0.0: balance is not returned — Totem is a signing provider, not a balance oracle.
        // DApps must fetch balance from Axia API: GET /v1/balance/:address or GET /v1/portfolio/:address.
        return {
          ok: true,
          result: {
            accounts: [{
              index: account.index,
              address: ensureMx(account.address),
              chainId: TOTEM_CHAIN_ID,
              addressType: 'standard' as const,
              capabilities: [] as string[]
            }]
          },
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_GET_ACCOUNTS] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'TOTEM_GET_COINS': {
      try {
        const { tokenId, address: filterAddress, minAmount } = params || {};

        // SECURITY: derive trusted origin from browser-verified sender.tab.url,
        // NOT from params.origin which the dApp could spoof.
        let origin: string | null = null;
        if (sender?.tab?.url) {
          try { origin = new URL(sender.tab.url).origin; } catch { origin = null; }
        }
        if (!origin) {
          return { ok: true, result: { success: false, error: 'Cannot determine caller origin', errorCode: 'INVALID_REQUEST' }, id };
        }

        const unlocked = await ensureUnlocked('A dApp wants to query your coins');
        if (!unlocked) {
          return { ok: true, result: { success: false, error: 'Wallet is locked', errorCode: 'WALLET_LOCKED' }, id };
        }
        
        console.log('[TOTEM_GET_COINS] UTXO query from:', origin);
        
        const site = connectedSitesStore.getSite(origin);
        if (!site) {
          return { ok: true, result: { success: false, error: 'Site not connected. Call TOTEM_CONNECT first.', errorCode: 'SITE_NOT_CONNECTED' }, id };
        }
        
        const txPerm = connectedSitesStore.getTransactionPermission(origin);
        if (!txPerm || !txPerm.allowedIntents.includes('utxo_read')) {
          return {
            ok: true,
            result: {
              success: false,
              error: 'UTXO read permission required. Grant "utxo_read" intent first.',
              errorCode: 'PERMISSION_DENIED',
              requiredIntent: 'utxo_read'
            },
            id
          };
        }
        
        const account = walletManager.getAccountByIndex(site.addressIndex);
        if (!account) {
          return { ok: true, result: { success: false, error: 'Connected account not found', errorCode: 'ACCOUNT_NOT_FOUND' }, id };
        }
        
        const addressesToQuery = filterAddress
          ? [filterAddress]
          : [account.address];
        
        await coinSelectionService.loadExcludedAddresses();
        const coins = await coinSelectionService.fetchSpendableCoins(
          addressesToQuery,
          (tokenId as string) || '0x00'
        );
        
        let filteredCoins = coins;
        if (minAmount && typeof minAmount === 'string') {
          const { compareDecimal } = await import('../core/transaction/CoinSelectionService');
          filteredCoins = coins.filter(c => compareDecimal(c.amount, minAmount as string) >= 0);
        }
        
        const sanitizedCoins = filteredCoins.map(c => ({
          coinId: c.coinId,
          address: ensureMx(c.address),
          amount: c.amount,
          tokenId: c.tokenid,
          created: c.created
        }));
        
        console.log(`[TOTEM_GET_COINS] Returning ${sanitizedCoins.length} coins for ${origin}`);
        
        await connectedSitesStore.updateLastUsed(origin);
        
        return {
          ok: true,
          result: {
            success: true,
            coins: sanitizedCoins,
            totalCoins: sanitizedCoins.length,
            queriedAddresses: addressesToQuery.length,
            tokenId: (tokenId as string) || '0x00'
          },
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_GET_COINS] Error:', error);
        return { ok: true, result: { success: false, error: error.message, errorCode: 'FETCH_FAILED' }, id };
      }
    }

    case 'TOTEM_SEND_COMPLEX': {
      try {
        const { origin, buildParams, mode: requestMode } = params || {};
        const mode = (requestMode === 'build') ? 'build' : 'submit';
        
        if (!origin) {
          return { ok: true, result: { success: false, error: 'Origin is required', errorCode: 'INVALID_REQUEST' }, id };
        }

        const unlocked = await ensureUnlocked('A dApp wants to send a transaction');
        if (!unlocked) {
          return { ok: true, result: { success: false, error: 'Wallet is locked', errorCode: 'WALLET_LOCKED' }, id };
        }
        
        console.log(`[TOTEM_SEND_COMPLEX] Complex transaction request (mode=${mode}) from:`, origin);
        
        const site = connectedSitesStore.getSite(origin);
        if (!site) {
          return { ok: true, result: { success: false, error: 'Site not connected. Call TOTEM_CONNECT first.', errorCode: 'SITE_NOT_CONNECTED' }, id };
        }
        
        if (!buildParams || typeof buildParams !== 'object') {
          return { ok: true, result: { success: false, error: 'buildParams object required', errorCode: 'INVALID_REQUEST' }, id };
        }
        
        const bp = buildParams as any;
        
        if (!Array.isArray(bp.inputs) || bp.inputs.length === 0) {
          return { ok: true, result: { success: false, error: 'buildParams.inputs must be a non-empty array', errorCode: 'INVALID_REQUEST' }, id };
        }
        
        if (!Array.isArray(bp.outputs) || bp.outputs.length === 0) {
          return { ok: true, result: { success: false, error: 'buildParams.outputs must be a non-empty array', errorCode: 'INVALID_REQUEST' }, id };
        }
        
        for (let i = 0; i < bp.inputs.length; i++) {
          const input = bp.inputs[i];
          if (!input.coinId || !input.address || !input.amount) {
            return { ok: true, result: { success: false, error: `inputs[${i}] requires coinId, address, and amount`, errorCode: 'INVALID_REQUEST' }, id };
          }
          if (!input.scriptDescriptor || !input.scriptDescriptor.scriptType || !input.scriptDescriptor.script) {
            return { ok: true, result: { success: false, error: `inputs[${i}].scriptDescriptor requires scriptType and script`, errorCode: 'INVALID_REQUEST' }, id };
          }
        }
        
        for (let i = 0; i < bp.outputs.length; i++) {
          const output = bp.outputs[i];
          if (!output.address || !output.amount) {
            return { ok: true, result: { success: false, error: `outputs[${i}] requires address and amount`, errorCode: 'INVALID_REQUEST' }, id };
          }
        }
        
        const account = walletManager.getAccountByIndex(site.addressIndex);
        if (!account) {
          return { ok: true, result: { success: false, error: 'Connected account not found', errorCode: 'ACCOUNT_NOT_FOUND' }, id };
        }
        
        const walletAddressesHex = walletManager.getAllAddresses().map((a: string) => normalizeToHex(a));
        const inputAddresses = bp.inputs.map((inp: any) => normalizeToHex(inp.address || ''));
        const ownedInputCount = inputAddresses.filter((a: string) => walletAddressesHex.includes(a)).length;
        
        if (ownedInputCount === 0) {
          return {
            ok: true,
            result: {
              success: false,
              error: 'None of the input addresses belong to the connected wallet. At least one input must be owned by the signer.',
              errorCode: 'INPUT_OWNERSHIP_VIOLATION'
            },
            id
          };
        }
        
        const scriptTypes = bp.inputs.map((inp: any) => inp.scriptDescriptor?.scriptType || 'unknown');
        const hasMultisig = scriptTypes.some((t: string) => t === 'multisig' || t === 'multisig_mofn');
        const hasMAST = scriptTypes.some((t: string) => t === 'mast');
        const hasHTLC = scriptTypes.some((t: string) => t === 'htlc');
        const hasExchange = scriptTypes.some((t: string) => t === 'exchange');
        
        const detectedIntent = hasMultisig ? 'multisig'
          : hasHTLC ? 'htlc'
          : hasExchange ? 'swap'
          : hasMAST ? 'contract_call'
          : 'complex_send';
        
        const txPerm = connectedSitesStore.getTransactionPermission(origin);
        if (!txPerm || (!txPerm.allowedIntents.includes('complex_send' as any) && !txPerm.allowedIntents.includes(detectedIntent as any))) {
          return {
            ok: true,
            result: {
              success: false,
              error: `Permission required for "${detectedIntent}" transactions. Grant "complex_send" or "${detectedIntent}" intent.`,
              errorCode: 'PERMISSION_DENIED',
              detectedIntent,
              scriptTypes,
              requiredIntent: 'complex_send'
            },
            id
          };
        }
        
        const totalOutputAmount = bp.outputs.reduce((sum: string, o: any) => {
          try {
            const a = parseFloat(sum || '0');
            const b = parseFloat(o.amount || '0');
            return String(a + b);
          } catch { return sum; }
        }, '0');
        
        const primaryOutput = bp.outputs[0];
        const primaryTokenId = primaryOutput.tokenId || '0x00';
        
        const approvalDetails: TxApprovalParams = {
          origin,
          to: primaryOutput.address,
          amount: totalOutputAmount,
          tokenId: primaryTokenId,
          intent: detectedIntent,
          mode
        };
        
        console.log(`[TOTEM_SEND_COMPLEX] Showing approval popup (mode=${mode}):`, {
          scriptTypes,
          detectedIntent,
          inputCount: bp.inputs.length,
          outputCount: bp.outputs.length,
          ownedInputs: ownedInputCount,
          externalInputs: bp.inputs.length - ownedInputCount,
          totalAmount: totalOutputAmount
        });
        
        const approved = await showTransactionApprovalPopup(approvalDetails);
        
        if (!approved) {
          console.log('[TOTEM_SEND_COMPLEX] User rejected complex transaction');
          return {
            ok: true,
            result: { success: false, error: 'Transaction rejected by user', errorCode: 'USER_REJECTED' },
            id
          };
        }
        
        if (mode === 'build') {
          console.log('[TOTEM_SEND_COMPLEX] Build mode - constructing unsigned transaction blob...');
          
          const internalSender: chrome.runtime.MessageSender = { id: chrome.runtime.id };
          const buildResult = await handleMessage({
            method: 'WOTS_BUILD_UNSIGNED',
            params: {
              buildParams: bp,
              sourceAddress: account.address,
              intent: detectedIntent
            },
            id: `complex-build-${Date.now()}`
          }, internalSender);
          
          if (buildResult.error || !buildResult.result) {
            return {
              ok: true,
              result: {
                success: false,
                error: buildResult.error || 'Build failed',
                errorCode: 'BUILD_FAILED'
              },
              id
            };
          }
          
          const built = buildResult.result as any;
          
          const inputCoinProofs = bp.inputs.map((inp: any) => ({
            coinId: inp.coinId,
            amount: inp.amount,
            tokenId: inp.tokenId || '0x00',
            address: ensureMx(inp.address),
            proof: inp.coinProof || null
          }));
          
          const scriptDescriptors = bp.inputs.map((inp: any) => {
            const sd = inp.scriptDescriptor || {};
            return {
              scriptType: sd.scriptType || 'unknown',
              script: sd.script || '',
              ...(sd.scriptType === 'mast' ? {
                root: sd.root || null,
                branchScript: sd.branchScript || sd.script || '',
                proofPath: sd.proofPath || [],
                extraScripts: sd.extraScripts || []
              } : {}),
              ...(sd.scriptType === 'multisig' || sd.scriptType === 'multisig_mofn' ? {
                requiredSignatures: sd.requiredSignatures || sd.m || null,
                totalSigners: sd.totalSigners || sd.n || null,
                signerKeys: sd.signerKeys || []
              } : {})
            };
          });
          
          const chainId = TOTEM_CHAIN_ID;
          
          const unsignedHex = built.unsignedHex || '';
          const digestTx = built.digestTxHex || built.digestTx || '';
          
          function canonicalJson(obj: any): string {
            if (obj === null || obj === undefined) return JSON.stringify(obj);
            if (typeof obj !== 'object') return JSON.stringify(obj);
            if (Array.isArray(obj)) {
              return '[' + obj.map(item => canonicalJson(item)).join(',') + ']';
            }
            const sortedKeys = Object.keys(obj).sort();
            const pairs = sortedKeys.map(key => JSON.stringify(key) + ':' + canonicalJson(obj[key]));
            return '{' + pairs.join(',') + '}';
          }
          
          const canonicalBlob = canonicalJson({
            unsignedHex,
            digestTx,
            inputCoinProofs,
            scriptDescriptors,
            chainId
          });
          
          let blobHash = '';
          try {
            const { sha3_256 } = await import('@noble/hashes/sha3');
            const hashBytes = sha3_256(new TextEncoder().encode(canonicalBlob));
            blobHash = '0x' + Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
          } catch (hashError) {
            console.warn('[TOTEM_SEND_COMPLEX] blobHash computation failed:', hashError);
          }
          
          const plan = {
            inputs: bp.inputs.map((inp: any) => ({
              coinId: inp.coinId,
              amount: inp.amount,
              tokenId: inp.tokenId || '0x00',
              address: ensureMx(inp.address)
            })),
            outputs: bp.outputs.map((out: any) => ({
              address: ensureMx(out.address),
              amount: out.amount,
              tokenId: out.tokenId || '0x00'
            })),
            change: built.changeOutput || null,
            fee: built.fee || null
          };
          
          console.log('[TOTEM_SEND_COMPLEX] Build mode complete:', {
            unsignedHexLength: unsignedHex.length,
            digestTx: digestTx.slice(0, 20) + '...',
            blobHash: blobHash.slice(0, 20) + '...',
            inputCount: inputCoinProofs.length,
            scriptDescriptorCount: scriptDescriptors.length
          });
          
          return {
            ok: true,
            result: {
              success: true,
              mode: 'build',
              unsignedHex,
              digestTx,
              plan,
              inputCoinProofs,
              scriptDescriptors,
              chainId,
              blobHash,
              detectedIntent,
              scriptTypes
            },
            id
          };
        }
        
        console.log('[TOTEM_SEND_COMPLEX] User approved, building enhanced transaction...');
        
        const internalSender: chrome.runtime.MessageSender = { id: chrome.runtime.id };
        
        const complexAccount = walletManager.getAccountByIndex(site.addressIndex);
        const complexPerAddressPubkey = complexAccount
          ? (() => {
              try {
                const tk = walletManager.getPerAddressTreeKey(complexAccount.index);
                if (tk) {
                  const pkBytes = tk.getPublicKey();
                  return '0x' + Array.from(pkBytes).map((b: number) => b.toString(16).padStart(2, '0')).join('');
                }
              } catch {}
              return undefined;
            })()
          : undefined;

        const wotsSendResult = await handleMessage({
          method: 'WOTS_SEND_COMPLEX',
          params: {
            buildParams: bp,
            sourceAddress: account.address,
            intent: detectedIntent,
            perAddressPublicKey: complexPerAddressPubkey
          },
          id: `complex-send-${Date.now()}`
        }, internalSender);
        
        if (wotsSendResult.error) {
          return {
            ok: true,
            result: {
              success: false,
              error: wotsSendResult.error,
              errorCode: 'BUILD_FAILED'
            },
            id
          };
        }
        
        await connectedSitesStore.recordTransaction(origin, primaryTokenId, totalOutputAmount);
        await connectedSitesStore.updateLastUsed(origin);
        
        console.log('[TOTEM_SEND_COMPLEX] Complex transaction successful:', wotsSendResult.result?.txpowid);
        
        return {
          ok: true,
          result: {
            success: true,
            mode: 'submit',
            txpowid: wotsSendResult.result?.txpowid,
            status: 'submitted',
            detectedIntent,
            scriptTypes,
            inputCount: bp.inputs.length,
            outputCount: bp.outputs.length
          },
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_SEND_COMPLEX] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }

    case 'TOTEM_SIGN_DATA': {
      try {
        const { origin, unsignedHex, inputIndices, signingManifest, returnFormat = 'hex' } = params || {};
        
        if (!origin) {
          return { ok: true, result: { success: false, error: 'Origin is required', errorCode: 'INVALID_REQUEST' }, id };
        }

        const unlocked = await ensureUnlocked('A dApp wants to sign data');
        if (!unlocked) {
          return { ok: true, result: { success: false, error: 'Wallet is locked', errorCode: 'WALLET_LOCKED' }, id };
        }
        
        console.log('[TOTEM_SIGN_DATA] request from:', origin);
        
        const site = connectedSitesStore.getSite(origin);
        if (!site) {
          return { ok: true, result: { success: false, error: 'Site not connected. Call TOTEM_CONNECT first.', errorCode: 'SITE_NOT_CONNECTED' }, id };
        }
        
        const signAccount = walletManager.getAccountByIndex(site.addressIndex);
        if (!signAccount) {
          return { ok: true, result: { success: false, error: 'Connected account not found', errorCode: 'ACCOUNT_NOT_FOUND' }, id };
        }
        const walletAddrs = walletManager.getAllAddresses();
        
        const validation = validateSignData(unsignedHex, signingManifest, walletAddrs);
        if (validation.ok === false) {
          return { ok: true, result: { success: false, ...validation.result }, id };
        }
        const { parsedInputs: parsedTxInputs, digestHex: computedDigestHex, ownedCount, walletAddrsHex, manifestInputs } = validation.data;

        // Permission check
        const txPerm = connectedSitesStore.getTransactionPermission(origin);
        if (!txPerm || !txPerm.allowedIntents.includes('sign_data' as any)) {
          return {
            ok: true,
            result: { success: false, error: 'Signing permission required. Grant "sign_data" intent first.', errorCode: 'PERMISSION_DENIED', requiredIntent: 'sign_data' },
            id
          };
        }
        
        // Approval popup: list each parsed input with ownership status
        const parsedInputSummary = parsedTxInputs.map((inp, idx) => {
          const manifInp = manifestInputs[idx];
          const isOwned = walletAddrsHex.includes(normalizeSignAddr(manifInp?.address || ''));
          return `[${idx}] ${isOwned ? 'MINE' : 'co-signer'} coin=${inp.coinId.slice(0, 10)} addr=${inp.address.slice(0, 10)} amt=${manifInp?.amount || '?'}`;
        }).join('\n');
        const approved = await showTransactionApprovalPopup({
          origin,
          to: `Sign ${ownedCount}/${manifestInputs.length} input(s) digest:${computedDigestHex.slice(0, 18)}\n${parsedInputSummary}`,
          amount: String(ownedCount),
          tokenId: '0x00',
          intent: 'sign_data'
        });
        
        if (!approved) {
          console.log('[TOTEM_SIGN_DATA] User rejected signing request');
          return {
            ok: true,
            result: { success: false, error: 'Signing rejected by user', errorCode: 'USER_REJECTED' },
            id
          };
        }
        
        console.log('[TOTEM_SIGN_DATA] User approved, signing transaction data...', {
          ownedInputs: ownedCount,
          totalManifestInputs: manifestInputs.length,
          digestTx: computedDigestHex
        });
        
        const internalSender: chrome.runtime.MessageSender = { id: chrome.runtime.id };
        // Derive inputAddresses from the validated signingManifest inputs
        const validatedInputAddresses = manifestInputs.map(inp => inp.address);
        const signPerAddressPubkey = (() => {
          try {
            const tk = walletManager.getPerAddressTreeKey(signAccount.index);
            if (tk) {
              const pkBytes = tk.getPublicKey();
              return '0x' + Array.from(pkBytes).map((b: number) => b.toString(16).padStart(2, '0')).join('');
            }
          } catch {}
          return undefined;
        })();
        const signResult = await handleMessage({
          method: 'WOTS_SIGN_DATA',
          params: {
            unsignedHex: unsignedHex as string,
            inputIndices: inputIndices || manifestInputs.map(inp => inp.inputIndex),
            sourceAddress: signAccount.address,
            inputAddresses: validatedInputAddresses,
            returnFormat: returnFormat || 'hex',
            perAddressPublicKey: signPerAddressPubkey
          },
          id: `sign-data-${Date.now()}`
        }, internalSender);
        
        if (signResult.error) {
          return {
            ok: true,
            result: {
              success: false,
              error: signResult.error,
              errorCode: 'SIGN_FAILED'
            },
            id
          };
        }
        
        await connectedSitesStore.updateLastUsed(origin);
        
        console.log('[TOTEM_SIGN_DATA] Partial signing successful');
        
        return {
          ok: true,
          result: {
            success: true,
            signedHex: signResult.result?.signedHex,
            signatures: signResult.result?.signatures,
            signerAddress: ensureMx(signAccount.address),
            signerIndex: site.addressIndex,
            inputsSigned: signResult.result?.inputsSigned || inputIndices || [],
            digestTx: computedDigestHex,
            status: 'signed'
          },
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_SIGN_DATA] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }

    case 'TOTEM_BROADCAST_HEX': {
      try {
        const { origin, signedHex, expectedDigestTx } = params || {};
        
        if (!origin) {
          return { ok: true, result: { success: false, error: 'Origin is required', errorCode: 'INVALID_REQUEST' }, id };
        }

        const unlocked = await ensureUnlocked('A dApp wants to broadcast a transaction');
        if (!unlocked) {
          return { ok: true, result: { success: false, error: 'Wallet is locked', errorCode: 'WALLET_LOCKED' }, id };
        }
        
        console.log('[TOTEM_BROADCAST_HEX] Broadcast request from:', origin);
        
        const site = connectedSitesStore.getSite(origin);
        if (!site) {
          return { ok: true, result: { success: false, error: 'Site not connected. Call TOTEM_CONNECT first.', errorCode: 'SITE_NOT_CONNECTED' }, id };
        }
        
        if (!signedHex || typeof signedHex !== 'string') {
          return { ok: true, result: { success: false, error: 'signedHex is required (hex-encoded signed transaction)', errorCode: 'INVALID_REQUEST' }, id };
        }
        
        const txPerm = connectedSitesStore.getTransactionPermission(origin);
        if (!txPerm || !txPerm.allowedIntents.includes('broadcast_tx' as any)) {
          return {
            ok: true,
            result: {
              success: false,
              error: 'Permission required for broadcasting transactions. Grant "broadcast_tx" intent.',
              errorCode: 'PERMISSION_DENIED',
              requiredIntent: 'broadcast_tx'
            },
            id
          };
        }
        
        let broadcastPreview: { outputCount: number; digestPreview: string; hexLength: number } = {
          outputCount: 0,
          digestPreview: 'unknown',
          hexLength: signedHex.length
        };
        
        try {
          const cleanHex = signedHex.startsWith('0x') ? signedHex.slice(2) : signedHex;
          const hexBytes = new Uint8Array(cleanHex.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) || []);
          
          if (hexBytes.length > 0) {
            const { sha3_256 } = await import('@noble/hashes/sha3');
            const digestBytes = sha3_256(hexBytes);
            const computedDigest = '0x' + Array.from(digestBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            broadcastPreview.digestPreview = computedDigest.slice(0, 18) + '...';
            
            if (expectedDigestTx && computedDigest !== expectedDigestTx) {
              console.warn('[TOTEM_BROADCAST_HEX] Digest mismatch:', {
                expected: expectedDigestTx,
                computed: computedDigest
              });
            }
          }
        } catch (parseError) {
          console.warn('[TOTEM_BROADCAST_HEX] Could not parse signedHex for preview:', parseError);
        }
        
        console.log('[TOTEM_BROADCAST_HEX] Showing broadcast approval popup:', broadcastPreview);
        
        const approved = await showTransactionApprovalPopup({
          origin,
          to: 'Network Broadcast',
          amount: `${broadcastPreview.hexLength} bytes`,
          tokenId: '0x00',
          intent: 'broadcast_tx',
          mode: 'broadcast'
        });
        
        if (!approved) {
          console.log('[TOTEM_BROADCAST_HEX] User rejected broadcast');
          return {
            ok: true,
            result: { success: false, error: 'Broadcast rejected by user', errorCode: 'USER_REJECTED' },
            id
          };
        }
        
        console.log('[TOTEM_BROADCAST_HEX] User approved, broadcasting...');
        
        const internalSender: chrome.runtime.MessageSender = { id: chrome.runtime.id };
        
        const broadcastResult = await handleMessage({
          method: 'WOTS_BROADCAST_HEX',
          params: {
            signedHex,
            expectedDigestTx
          },
          id: `broadcast-hex-${Date.now()}`
        }, internalSender);
        
        if (broadcastResult.error || !broadcastResult.result) {
          return {
            ok: true,
            result: {
              success: false,
              error: broadcastResult.error || 'Broadcast failed',
              errorCode: 'BROADCAST_FAILED'
            },
            id
          };
        }
        
        const result = broadcastResult.result as any;
        
        await connectedSitesStore.updateLastUsed(origin);
        
        console.log('[TOTEM_BROADCAST_HEX] Broadcast successful:', result.txpowid);
        
        return {
          ok: true,
          result: {
            success: true,
            txpowid: result.txpowid
          },
          id
        };
      } catch (error: any) {
        console.error('[TOTEM_BROADCAST_HEX] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }

    case 'TOTEM_PROVE_OWNERSHIP': {
      try {
        const { origin: reqOrigin, childIndices } = params || {};

        if (!reqOrigin) {
          return { ok: false, error: 'Origin is required', id };
        }

        if (!Array.isArray(childIndices) || childIndices.length === 0) {
          return { ok: false, error: 'childIndices must be a non-empty array of numbers', errorCode: 'INVALID_INDICES', id };
        }

        const invalidIdx = childIndices.find((idx) => !Number.isInteger(idx) || idx < 0);
        if (invalidIdx !== undefined) {
          return { ok: false, error: `Invalid child index: ${invalidIdx}`, errorCode: 'INVALID_INDICES', id };
        }

        const unlocked = await ensureUnlocked('A dApp wants to generate a Root Identity ownership proof');
        if (!unlocked) {
          return { ok: false, error: 'Wallet is locked', id };
        }

        const site = connectedSitesStore.getSite(reqOrigin);
        if (!site) {
          return { ok: false, error: 'Site not connected. Call TOTEM_CONNECT first.', id };
        }

        console.log('[TOTEM_PROVE_OWNERSHIP] Request from:', reqOrigin, 'indices:', childIndices);

        const rootInfo = walletManager.getRootIdentityInfo();
        if (!rootInfo.rootAddress) {
          return { ok: false, error: 'Root identity not available (wallet locked?)', id };
        }

        // Derive child addresses directly from the RootIdentityWallet instance
        // (bypasses the account list, so the popup always shows the exact addresses
        // that will appear in the proof, even for indices not yet in local storage).
        const childAddresses: string[] = walletManager.getChildAddressesForIndices(childIndices);

        const approved = await showProveOwnershipPopup({
          origin: reqOrigin,
          rootAddress: rootInfo.rootAddress,
          childAddresses,
          childIndices,
        });

        if (!approved) {
          console.log('[TOTEM_PROVE_OWNERSHIP] User rejected request');
          return { ok: false, error: 'User rejected ownership proof request', errorCode: 'USER_REJECTED', id };
        }

        console.log('[TOTEM_PROVE_OWNERSHIP] User approved, generating proof...');
        const proof = await walletManager.generateOwnershipProof('', childIndices);
        console.log('[TOTEM_PROVE_OWNERSHIP] Proof generated for root:', proof.rootAddress?.slice(0, 12));

        await connectedSitesStore.updateLastUsed(reqOrigin);

        return { ok: true, result: proof, id };
      } catch (error: any) {
        console.error('[TOTEM_PROVE_OWNERSHIP] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }

    case 'TOTEM_DISCONNECT': {
      try {
        const reqOrigin = params?.origin || origin;
        if (!reqOrigin) {
          return { ok: false, error: 'Origin is required', id };
        }

        console.log('[TOTEM_DISCONNECT] DApp-initiated disconnect:', reqOrigin);
        const site = connectedSitesStore.getSite(reqOrigin);
        if (!site) {
          return { ok: false, error: 'Site not connected', errorCode: 'SITE_NOT_CONNECTED', id };
        }

        const success = await connectedSitesStore.disconnectSite(reqOrigin);

        if (success) {
          try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
              if (tab.id && tab.url) {
                try {
                  const tabOrigin = new URL(tab.url).origin;
                  if (tabOrigin === reqOrigin) {
                    chrome.tabs.sendMessage(tab.id, {
                      type: 'TOTEM_EVENT',
                      eventName: 'accountsChanged',
                      data: []
                    }).catch(() => {});
                  }
                } catch {}
              }
            }
          } catch (e) {
            console.warn('[TOTEM_DISCONNECT] Failed to broadcast accountsChanged event:', e);
          }
        }

        return { ok: true, result: { success }, id };
      } catch (error: any) {
        console.error('[TOTEM_DISCONNECT] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }

    case 'DISCONNECT_SITE': {
      try {
        const { origin } = params || {};
        if (!origin) {
          return { ok: false, error: 'Origin is required', id };
        }
        
        console.log('[DISCONNECT_SITE] Disconnecting:', origin);
        const success = await connectedSitesStore.disconnectSite(origin);
        return { ok: true, result: { success }, id };
      } catch (error: any) {
        console.error('[DISCONNECT_SITE] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'DISCONNECT_ALL_SITES': {
      try {
        console.log('[DISCONNECT_ALL_SITES] Disconnecting all sites');
        await connectedSitesStore.disconnectAll();
        return { ok: true, result: { success: true }, id };
      } catch (error: any) {
        console.error('[DISCONNECT_ALL_SITES] Error:', error);
        return { ok: false, error: error.message, id };
      }
    }
    
    case 'GET_RPC_ENDPOINT':
      try {
        const projectId = request.projectId || 'totem-shared';
        // Use api.axia.to - the production API endpoint
        const endpoint = `https://api.axia.to/v1/${projectId}`;
        return { ok: true, result: { endpoint }, id };
      } catch (error: any) {
        return { ok: true, result: { endpoint: `https://api.axia.to/v1/${request.projectId || 'totem-shared'}` }, id };
      }
    
    case 'sdk:getConfig':
      try {
        const sdkConfig = await SdkMigrationManager.getConfig();
        return { ok: true, result: sdkConfig, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'sdk:getStats':
      try {
        const sdkStats = await SdkMigrationManager.getStats();
        const sessionStats = sdkTelemetry.getSessionStats();
        return { 
          ok: true,
          result: {
            ...sdkStats,
            session: sessionStats,
          }, 
          id 
        };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'sdk:setMode':
      try {
        const mode = params[0];
        if (mode === 'sdk') {
          await SdkMigrationManager.enableSdk();
        } else if (mode === 'legacy') {
          await SdkMigrationManager.manualRollback('User requested legacy mode');
        }
        return { ok: true, result: { success: true }, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'sdk:setRolloutGroup':
      try {
        await SdkMigrationManager.setRolloutGroup(params[0]);
        return { ok: true, result: { success: true }, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'sdk:reset':
      try {
        await SdkMigrationManager.reset();
        sdkTelemetry.reset();
        return { ok: true, result: { success: true }, id };
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    case 'RPC_COMMAND': {
      const RPC_ALLOWED_COMMANDS = new Set([
        'txpow', 'balance', 'coins', 'tokens', 'txlist', 'status',
      ]);
      try {
        const { command, params: rpcParams } = params || {};
        
        if (!command) {
          return { ok: true, result: { response: { status: false, error: 'Command required' } }, id };
        }

        const cmdLower = command.toLowerCase().trim();
        if (!RPC_ALLOWED_COMMANDS.has(cmdLower)) {
          console.warn('[Background] Blocked RPC command:', command);
          return { ok: false, error: `RPC command not allowed: ${command}`, id };
        }
        
        console.log('[Background] RPC_COMMAND:', command);
        
        // Get config for authenticated API calls
        const storage = await chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID']);
        const baseUrl = storage.AXIA_BASE || 'https://api.axia.to';
        const projectId = storage.AXIA_PROJECT_ID || 'totem-shared';
        
        // Build JSON-RPC 2.0 request
        const rpcRequest = {
          jsonrpc: '2.0',
          method: command,
          params: rpcParams || {},
          id: Date.now()
        };
        
        console.log('[Background] Sending RPC to:', `${baseUrl}/v1/${projectId}`);
        
        const response = await fetch(`${baseUrl}/v1/${projectId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': projectId
          },
          body: JSON.stringify(rpcRequest)
        });
        
        const data = await response.json();
        console.log('[Background] RPC response:', data);
        
        // Convert JSON-RPC 2.0 response to expected format
        if (data.error) {
          return {
            ok: true,
            result: {
              response: {
                status: false,
                error: data.error.message || 'RPC error'
              }
            },
            id
          };
        }
        
        return {
          ok: true,
          result: {
            response: {
              status: true,
              response: data.result
            }
          },
          id
        };
      } catch (error: any) {
        console.error('[Background] RPC_COMMAND failed:', error);
        return {
          ok: false,
          error: error.message || 'RPC command failed',
          id
        };
      }
    }
    
    case 'balances:getBulkSnapshot':
      // Efficient bulk balance fetch - returns all cached balances from BalanceStreamManager
      // Falls back to single API call if cache is empty
      try {
        const requestedAddresses: string[] = params?.[0] || [];
        
        if (requestedAddresses.length === 0) {
          return { ok: false, error: 'Addresses required', id };
        }
        
        // First try to get from cache (populated by portfolio stream)
        const snapshot = await portfolioStreamManager.getSnapshot(requestedAddresses);
        
        // If cache has data, return it immediately
        if (Object.keys(snapshot.portfolios).length > 0) {
          console.log('[Background] balances:getBulkSnapshot - returning cached data for', Object.keys(snapshot.portfolios).length, 'addresses');
          
          // Convert cached portfolio entries to the format expected by UI
          // CRITICAL: sendable = confirmed only (unconfirmed incoming coins cannot be spent)
          const balanceMap: Record<string, { total: string; confirmed: string; sendable: string }> = {};
          for (const [addr, addrEntries] of Object.entries(snapshot.portfolios)) {
            const native = (addrEntries as any[]).find((e: any) => e.tokenid === '0x00' || e.kind === 'native');
            balanceMap[addr] = {
              total:     native?.total     ?? '0',
              confirmed: native?.confirmed ?? '0',
              sendable:  native?.confirmed ?? '0', // Only confirmed coins can be spent
            };
          }
          
          return {
            ok: true,
            balances: balanceMap,
            connectionState: snapshot.connectionState,
            source: 'cache',
            id
          };
        }
        
        // Cache empty — fetch all addresses from portfolio REST endpoint
        console.log('[Background] balances:getBulkSnapshot - cache empty, fetching from portfolio API');
        const storage = await chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID']);
        const baseUrl = storage.AXIA_BASE || 'https://api.axia.to';
        const projectId = storage.AXIA_PROJECT_ID || 'totem-shared';

        const balanceMap: Record<string, { total: string; confirmed: string; sendable: string }> = {};
        for (const addr of requestedAddresses) {
          balanceMap[addr] = { total: '0', confirmed: '0', sendable: '0' };
        }

        let aggregateTotal = '0';
        let aggregateSendable = '0';
        const customTokens: any[] = [];

        await Promise.allSettled(requestedAddresses.map(async (addr) => {
          const portfolioRes = await fetch(`${baseUrl}/v1/portfolio/${encodeURIComponent(addr)}`, {
            headers: { 'x-api-key': projectId }
          });
          if (!portfolioRes.ok) return;
          const payload = await portfolioRes.json();
          const entries: any[] = Array.isArray(payload) ? payload : (Array.isArray(payload?.entries) ? payload.entries : []);
          if (entries.length === 0) return;

          const native = entries.find((e: any) => e.kind === 'native' || e.tokenid === '0x00');
          if (native) {
            balanceMap[addr] = {
              total:     native.total     ?? '0',
              confirmed: native.confirmed ?? '0',
              sendable:  native.confirmed ?? '0',
            };
            aggregateTotal = native.total ?? '0';
            aggregateSendable = native.confirmed ?? '0';
          }

          for (const e of entries) {
            if (e.kind === 'native' || e.tokenid === '0x00') continue;
            customTokens.push({
              tokenid:   e.tokenid,
              name:      e.name      ?? 'Unknown',
              ticker:    e.ticker,
              url:       e.url       ?? e.icon,
              icon:      e.url       ?? e.icon,
              type:      e.kind,
              confirmed: e.confirmed ?? '0',
              sendable:  e.confirmed ?? '0',
              total:     e.total     ?? '0',
              coins:     e.coins     ?? 0,
            });
          }
        }));

        return {
          ok: true,
          aggregateTotal,
          aggregateSendable,
          balances: balanceMap,
          tokens: customTokens,
          source: 'api-portfolio',
          id
        };
      } catch (error: any) {
        console.error('[Background] balances:getBulkSnapshot failed:', error);
        return { ok: false, error: error.message, balances: {}, id };
      }

    case 'balances:getAddressTokens':
      try {
        const targetAddress: string = params?.[0] || '';
        if (!targetAddress) {
          return { ok: false, error: 'Address required', id };
        }

        const atStorage = await chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID']);
        const atBaseUrl = atStorage.AXIA_BASE || 'https://api.axia.to';
        const atProjectId = atStorage.AXIA_PROJECT_ID || 'totem-shared';

        const v2 = await portfolioStreamManager.getSnapshot([targetAddress]);
        const addrEntries: any[] = v2.portfolios[targetAddress] ?? [];
        const nativeEntry = addrEntries.find((e: any) => e.tokenid === '0x00' || e.kind === 'native');
        const tokenEntries = addrEntries.filter((e: any) => e.tokenid !== '0x00' && e.kind !== 'native');

        const hasCachedBalance = nativeEntry && (
          parseFloat(nativeEntry.confirmed ?? '0') > 0 ||
          parseFloat(nativeEntry.total ?? '0') > 0 ||
          tokenEntries.some((t: any) =>
            parseFloat(t.confirmed ?? '0') > 0 ||
            parseFloat(t.total ?? '0') > 0
          )
        );
        if (hasCachedBalance) {
          console.log('[Background] balances:getAddressTokens - cache hit for', targetAddress);
          return {
            ok: true,
            minima: { confirmed: nativeEntry.confirmed ?? '0', sendable: nativeEntry.confirmed ?? '0', total: nativeEntry.total ?? '0' },
            tokens: tokenEntries,
            source: 'cache',
            id
          };
        }

        console.log('[Background] balances:getAddressTokens - cache miss, fetching from portfolio API for', targetAddress);
        const atResponse = await fetch(`${atBaseUrl}/v1/portfolio/${encodeURIComponent(targetAddress)}`, {
          headers: { 'x-api-key': atProjectId }
        });

        if (!atResponse.ok) {
          return { ok: false, error: `API error: ${atResponse.status}`, id };
        }

        const atPayload = await atResponse.json();
        const atEntries: any[] = Array.isArray(atPayload) ? atPayload : (Array.isArray(atPayload?.entries) ? atPayload.entries : []);
        const atNative = atEntries.find((e: any) => e.kind === 'native' || e.tokenid === '0x00') ?? null;
        const atConfirmed = atNative?.confirmed ?? '0';
        const atSendable  = atNative?.confirmed ?? '0';

        const atTokens: any[] = [];
        if (Array.isArray(atEntries)) {
          for (const e of atEntries) {
            if (e.kind === 'native' || e.tokenid === '0x00') continue;
            atTokens.push({
              tokenid:     e.tokenid,
              token:       e.ticker ?? e.name ?? 'Unknown',
              name:        e.name   ?? e.ticker ?? 'Unknown',
              ticker:      e.ticker,
              url:         e.url    ?? e.icon,
              icon:        e.url    ?? e.icon,
              type:        e.kind,
              confirmed:   e.confirmed   ?? '0',
              sendable:    e.confirmed   ?? '0',
              unconfirmed: e.unconfirmed ?? '0',
              total:       e.total       ?? '0',
              coins:       e.coins       ?? 0,
              timestamp:   Date.now(),
              source:      'api',
            });
          }
        }

        return {
          ok: true,
          minima: {
            confirmed:   atConfirmed,
            unconfirmed: atNative?.unconfirmed ?? '0',
            sendable:    atSendable,
            balance:     atNative?.total ?? '0',
            tokenid:     '0x00',
            timestamp:   Date.now(),
            source:      'api',
          },
          tokens: atTokens,
          source: 'api',
          id
        };
      } catch (error: any) {
        console.error('[Background] balances:getAddressTokens failed:', error);
        return { ok: false, error: error.message, id };
      }

    case 'balances:getTokenList':
      try {
        const reqAddresses: string[] = params?.[0] || [];
        if (reqAddresses.length === 0) {
          return { ok: false, error: 'Addresses required', tokens: [], id };
        }

        const tlStorage = await chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID']);
        const tlBaseUrl = tlStorage.AXIA_BASE || 'https://api.axia.to';
        const tlProjectId = tlStorage.AXIA_PROJECT_ID || 'totem-shared';

        const tokenResults: any[] = [];

        await Promise.allSettled(reqAddresses.map(async (addr) => {
          const tlResponse = await fetch(`${tlBaseUrl}/v1/portfolio/${encodeURIComponent(addr)}`, {
            headers: { 'x-api-key': tlProjectId }
          });
          if (!tlResponse.ok) return;
          const tlPayload = await tlResponse.json();
          const tlEntries: any[] = Array.isArray(tlPayload) ? tlPayload : (Array.isArray(tlPayload?.entries) ? tlPayload.entries : []);
          if (tlEntries.length === 0) return;

          for (const e of tlEntries) {
            if (e.kind === 'native' || e.tokenid === '0x00') continue;
            tokenResults.push({
              tokenid:  e.tokenid,
              name:     e.name    ?? e.ticker ?? 'Unknown',
              ticker:   e.ticker,
              url:      e.url     ?? e.icon,
              icon:     e.url     ?? e.icon,
              type:     e.kind,
              confirmed: e.confirmed ?? '0',
              sendable:  e.confirmed ?? '0',
              total:     e.total     ?? '0',
              coins:     e.coins     ?? 0,
            });
          }
        }));

        console.log(`[Background] balances:getTokenList - found ${tokenResults.length} custom tokens`);
        return { ok: true, tokens: tokenResults, id };
      } catch (error: any) {
        console.error('[Background] balances:getTokenList failed:', error);
        return { ok: false, error: error.message, tokens: [], id };
      }
    
    case 'GET_BALANCE_SNAPSHOT':
      try {
        const address = params?.[0];
        if (!address) {
          return { ok: false, error: 'Address required', id };
        }
        
        // PRODUCTION SAFETY: Mock RPC only available in Designer mode
        // __DESIGNER_MODE__ is a compile-time constant - false in production builds
        if (__DESIGNER_MODE__) {
          // In Designer mode, query Mock RPC state and calculate per-address balance
          // Note: In MV3 service workers, globalThis.location.origin is chrome-extension://...
          // so we explicitly target the dev server for Mock RPC
          try {
            const mockRpcUrl = 'http://localhost:6000/mock-rpc/state';
            const response = await fetch(mockRpcUrl);
            
            if (!response.ok) {
              console.warn(`[Background] Mock RPC returned ${response.status}`);
              return {
                ok: false,
                error: `Mock RPC unavailable (${response.status})`,
                total: '0',
                confirmed: '0',
                unconfirmed: '0',
                sendable: '0',
                tokens: {},
                id
              };
            }
            
            const data = await response.json();
            
            if (data.status && data.response) {
              const coins = data.response.coins || [];
              
              // Calculate per-address balance by summing coins for this address
              const addressCoins = coins.filter((coin: any) => coin.address === address);
              
              // Aggregate balance by tokenid for this address
              const tokenBalances: Record<string, bigint> = {};
              
              for (const coin of addressCoins) {
                const tokenid = coin.tokenid || '0x00';
                const amount = BigInt(coin.amount || '0');
                
                if (!tokenBalances[tokenid]) {
                  tokenBalances[tokenid] = BigInt(0);
                }
                tokenBalances[tokenid] += amount;
              }
              
              // Get MINIMA balance for this address
              const minimaBalance = (tokenBalances['0x00'] || BigInt(0)).toString();
              
              return {
                ok: true,
                total: minimaBalance,
                confirmed: minimaBalance,
                unconfirmed: '0',
                sendable: minimaBalance,
                tokens: Object.fromEntries(
                  Object.entries(tokenBalances).map(([tokenid, balance]) => [tokenid, balance.toString()])
                ),
                id
              };
            }
          } catch (fetchError) {
            console.warn('[Background] Mock RPC fetch failed:', fetchError);
            return {
              ok: false,
              error: 'Mock RPC unavailable',
              total: '0',
              confirmed: '0',
              unconfirmed: '0',
              sendable: '0',
              tokens: {},
              id
            };
          }
        }
        
        // Production mode: Fetch balance from real API
        try {
          const storage = await chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID']);
          const baseUrl = storage.AXIA_BASE || 'https://api.axia.to';
          const projectId = storage.AXIA_PROJECT_ID || 'totem-shared';
          
          console.log('[Background] GET_BALANCE_SNAPSHOT - fetching from portfolio API:', { address, baseUrl });

          const response = await fetch(`${baseUrl}/v1/portfolio/${encodeURIComponent(address)}`, {
            headers: { 'x-api-key': projectId }
          });

          if (!response.ok) {
            console.warn('[Background] Portfolio API returned:', response.status);
            return {
              ok: false,
              error: `Portfolio API error: ${response.status}`,
              total: '0',
              confirmed: '0',
              unconfirmed: '0',
              sendable: '0',
              tokens: {},
              id
            };
          }

          const portfolioPayload = await response.json();
          const entries: any[] = Array.isArray(portfolioPayload) ? portfolioPayload : (Array.isArray(portfolioPayload?.entries) ? portfolioPayload.entries : []);
          console.log('[Background] Portfolio API response: entries=', entries.length);

          // Convert display amount to base units (44 decimals) for BigInt aggregation
          const MINIMA_DECIMALS = 44;
          const MINIMA_SCALE = BigInt(10) ** BigInt(MINIMA_DECIMALS);

          const toBaseUnits = (display: string): string => {
            try {
              if (!display || display === '0') return '0';
              const [whole = '0', frac = ''] = display.split('.');
              const wholeBigInt = BigInt(whole) * MINIMA_SCALE;
              if (!frac) return wholeBigInt.toString();
              const paddedFrac = frac.padEnd(MINIMA_DECIMALS, '0').slice(0, MINIMA_DECIMALS);
              return (wholeBigInt + BigInt(paddedFrac)).toString();
            } catch {
              return '0';
            }
          };

          const native = entries.find((e: any) => e.kind === 'native' || e.tokenid === '0x00') ?? null;
          const totalBaseUnits       = toBaseUnits(native?.total       ?? '0');
          const confirmedBaseUnits   = toBaseUnits(native?.confirmed   ?? '0');
          const unconfirmedBaseUnits = toBaseUnits(native?.unconfirmed ?? '0');
          const sendableBaseUnits    = toBaseUnits(native?.confirmed   ?? '0');

          const tokens: Record<string, string> = {};
          for (const e of entries) {
            tokens[e.tokenid] = toBaseUnits(e.total ?? '0');
          }

          return {
            ok: true,
            total: totalBaseUnits,
            confirmed: confirmedBaseUnits,
            unconfirmed: unconfirmedBaseUnits,
            sendable: sendableBaseUnits,
            tokens,
            id
          };
        } catch (fetchError: any) {
          console.error('[Background] Production balance fetch failed:', fetchError);
          return {
            ok: false,
            error: fetchError.message || 'Balance fetch failed',
            total: '0',
            confirmed: '0',
            unconfirmed: '0',
            sendable: '0',
            tokens: {},
            id
          };
        }
      } catch (error: any) {
        return { ok: false, error: error.message, id };
      }
    
    default:
      return { ok: false, error: `Unknown method: ${method}`, id };
  }
}

// Handle connection from content scripts and UI
chrome.runtime.onConnect.addListener((port) => {
  console.log('New connection:', port.name);
  
  // Handle portfolio-stream port for real-time portfolio updates
  if (port.name === 'portfolio-stream') {
    console.log('[Background] Portfolio stream port connected');
    
    const listener: PortfolioStreamListener = {
      onPortfolioUpdate: (event) => {
        try {
          port.postMessage({ type: 'PORTFOLIO_SNAPSHOT', payload: event });
        } catch (e) {
          // Port may be disconnected
        }
      },
      onConnectionStateChange: (state, error) => {
        try {
          port.postMessage({ type: 'CONNECTION_STATE', payload: { state, error } });
        } catch (e) {
          // Port may be disconnected
        }
      },
    };
    
    // Add listener to stream manager
    portfolioStreamManager.addListener(listener);
    
    // Handle incoming messages from UI
    port.onMessage.addListener(async (msg) => {
      switch (msg.type) {
        case 'START_STREAM': {
          console.log('[Background] Starting portfolio stream for', msg.addresses?.length || 0, 'addresses');
          await portfolioStreamManager.start(msg.addresses);
          
          const initialSnapshot = await portfolioStreamManager.getSnapshot(msg.addresses);
          const allCachedEntries: any[] = [];
          for (const addrEntries of Object.values(initialSnapshot.portfolios)) {
            allCachedEntries.push(...(addrEntries as any[]));
          }
          console.log('[Background] Sending initial portfolio snapshot with', allCachedEntries.length, 'cached entries');
          
          try {
            port.postMessage({ 
              type: 'INITIAL_SNAPSHOT', 
              payload: {
                entries: allCachedEntries,
                connectionState: initialSnapshot.connectionState,
                error: initialSnapshot.error
              }
            });
          } catch (e) {
            // Port may be disconnected
          }
          break;
        }
          
        case 'STOP_STREAM':
          console.log('[Background] Stopping portfolio stream');
          portfolioStreamManager.stop();
          break;
          
        case 'UPDATE_ADDRESSES':
          console.log('[Background] Updating portfolio stream addresses:', msg.addresses?.length || 0, 'addresses');
          await portfolioStreamManager.updateAddresses(msg.addresses);
          break;
          
        case 'GET_CACHED': {
          const cachedEntries = await portfolioStreamManager.getCachedPortfolio(msg.address);
          port.postMessage({ type: 'CACHED_PORTFOLIO', address: msg.address, entries: cachedEntries });
          break;
        }
          
        case 'GET_SNAPSHOT': {
          console.log('[Background] Getting portfolio snapshot for', msg.addresses?.length || 0, 'addresses');
          const snap = await portfolioStreamManager.getSnapshot(msg.addresses);
          try {
            port.postMessage({ 
              type: 'SNAPSHOT', 
              payload: {
                portfolios: snap.portfolios,
                connectionState: snap.connectionState,
                error: snap.error
              }
            });
          } catch (e) {
            // Port may be disconnected
          }
          break;
        }
          
        default:
          console.log('[Background] Unknown portfolio-stream message:', msg.type);
      }
    });
    
    // Cleanup on disconnect
    port.onDisconnect.addListener(() => {
      console.log('[Background] Portfolio stream port disconnected');
      portfolioStreamManager.removeListener(listener);
    });
    
    return;
  }
  
  // Handle wallet-init port for streaming wallet initialization events
  if (port.name === 'wallet-init') {
    console.log('[Background] Wallet init port connected');
    
    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'IMPORT_WALLET') {
        console.log('[Background] Starting wallet import with event streaming...');
        
        try {
          const { mnemonic, password } = msg;
          
          // Import with event streaming
          const result = await walletManager.importWalletWithEvents(
            mnemonic,
            password,
            (event) => {
              // Forward each event to the UI
              try {
                port.postMessage({ type: 'INIT_EVENT', payload: event });
              } catch (e) {
                // Port may be disconnected
              }
            }
          );
          
          // Mark wallet as initialized
          await chrome.storage.local.set({ walletSetup: true });
          
          // Pre-fetch price in background
          prefetchMinimaPrice().catch(e => console.warn('[Background] Price prefetch failed:', e));
          
          // Send completion message
          port.postMessage({ 
            type: 'IMPORT_COMPLETE', 
            payload: { address: result.address, success: true } 
          });
          
        } catch (error: any) {
          console.error('[Background] Wallet import with events failed:', error);
          port.postMessage({ 
            type: 'IMPORT_ERROR', 
            payload: { error: error.message } 
          });
        }
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('[Background] Wallet init port disconnected');
    });
    
    return;
  }
  
  // Default handler for other ports (content scripts, etc.)
  port.onMessage.addListener(async (msg) => {
    const response = await handleMessage(msg, { id: port.sender?.id } as any);
    port.postMessage(response);
  });
});