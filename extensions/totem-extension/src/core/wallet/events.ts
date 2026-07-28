/**
 * WalletInitEvent - Real-time events emitted during wallet initialization
 * 
 * These events are streamed from the wallet core to the UI during wallet
 * creation/import, providing accurate progress information for Minima protocol
 * engineers to understand what's happening.
 * 
 * Event flow:
 * 1. mnemonic_validate - Validating mnemonic phrase
 * 2. seed_derive - Deriving master seed from mnemonic (SHA3-256)
 * 3. vault_encrypt - Encrypting seed with AES-GCM
 * 4. treekey_start - Starting TreeKey generation
 * 5. wots_key - Individual WOTS key generation (64 per level)
 * 6. mmr_build - Building MMR tree from public keys
 * 7. address_derive - Deriving wallet addresses from TreeKey
 * 8. storage_persist - Persisting wallet to chrome.storage
 * 9. complete - Wallet initialization complete
 * 10. error - An error occurred
 */

export type WalletInitPhase = 
  | 'mnemonic_validate'
  | 'seed_derive'
  | 'vault_encrypt'
  | 'treekey_start'
  | 'wots_key'
  | 'mmr_build'
  | 'address_derive'
  | 'storage_persist'
  | 'balance_stream'
  | 'fast_unlock'        // Initial addresses ready (fast unlock phase)
  | 'background_derive'  // Background address generation in progress
  | 'complete'
  | 'error';

export interface WalletInitEvent {
  phase: WalletInitPhase;
  message: string;
  timestamp: number;
  current?: number;
  total?: number;
  addressIndex?: number;
  level?: number;
  error?: string;
}

export type WalletInitEventCallback = (event: WalletInitEvent) => void;

export function createInitEvent(
  phase: WalletInitPhase,
  message: string,
  extra?: Partial<Omit<WalletInitEvent, 'phase' | 'message' | 'timestamp'>>
): WalletInitEvent {
  return {
    phase,
    message,
    timestamp: Date.now(),
    ...extra
  };
}

export const WALLET_INIT_PORT_NAME = 'wallet-init';
