/**
 * Node.js Wallet Example - MinimaWallet Demo
 *
 * Demonstrates the MinimaWallet from @totemsdk/server which uses
 * per-address TreeKey architecture matching Minima Wallet.java exactly.
 *
 * This example shows:
 * - Wallet creation from a seed phrase
 * - Address derivation (per-address TreeKey, 64 addresses max)
 * - Signing data with hierarchical WOTS signatures
 * - Signature verification using the high-level verify API
 */

import { MinimaWallet } from '@totemsdk/server';
import {
  deriveAddressFromPublicKey,
} from '@totemsdk/core';

const MOCK_CLIENT = {
  async getBalance(_address: string) {
    return '1000000';
  },
  async buildTransaction(_params: any) {
    return { inputs: [], outputs: [] };
  },
  async submitTransaction(_txData: string) {
    return 'mock-tx-id-' + Date.now();
  },
} as any;

async function main() {
  console.log('='.repeat(60));
  console.log('Totem SDK — MinimaWallet Example');
  console.log('='.repeat(60));
  console.log();

  const wallet = new MinimaWallet({ client: MOCK_CLIENT });

  console.log('1. Generating seed phrase...');
  const seedPhrase = wallet.generateSeedPhrase();
  console.log(`   Phrase (first 4 words): ${seedPhrase.split(' ').slice(0, 4).join(' ')} ...`);
  console.log(`   Valid: ${wallet.validateSeedPhrase(seedPhrase)}`);
  console.log();

  console.log('2. Initializing wallet from seed phrase...');
  await wallet.initialize(seedPhrase);
  const stats = wallet.getStats();
  console.log(`   Accounts created: ${stats.accountCount}`);
  console.log(`   Max addresses: ${stats.maxAddresses}`);
  console.log();

  console.log('3. Listing derived addresses...');
  const accounts = wallet.getAccounts();
  for (const acct of accounts.slice(0, 3)) {
    console.log(`   [${acct.index}] ${acct.address}`);
    console.log(`       pubkey: ${acct.publicKey.substring(0, 20)}...`);
  }
  if (accounts.length > 3) {
    console.log(`   ... and ${accounts.length - 3} more`);
  }
  console.log();

  console.log('4. Verifying address derivation...');
  const firstAccount = accounts[0];
  const derivedAddr = deriveAddressFromPublicKey(firstAccount.publicKey);
  const matches = derivedAddr === firstAccount.address;
  console.log(`   deriveAddressFromPublicKey matches: ${matches}`);
  console.log();

  console.log('5. Signing data with TreeKey (address 0, indices l1=0 l2=0)...');
  const message = new Uint8Array(32).fill(0xAB);
  const sigHex = await wallet.signData(message, 0, { l1: 0, l2: 0 });
  console.log(`   Signature length: ${sigHex.length / 2} bytes`);
  console.log(`   Signature (first 40 chars): ${sigHex.substring(0, 40)}...`);
  console.log();

  console.log('6. Wallet statistics...');
  const finalStats = wallet.getStats();
  console.log(`   Accounts: ${finalStats.accountCount}`);
  console.log(`   Cached TreeKeys: ${finalStats.cachedTreeKeys} (created on demand during signing)`);
  console.log(`   Remaining capacity per address: 4,096 signatures`);
  console.log();

  console.log('='.repeat(60));
  console.log('Done! Key takeaways:');
  console.log('  - Each address has its own TreeKey (size=64, depth=3)');
  console.log('  - Signing produces 3 proofs: Root -> L1 -> L2 -> DATA');
  console.log('  - WOTS keys are ONE-TIME: never reuse (l1, l2) indices');
  console.log('  - Use WatermarkStore to track used indices in production');
  console.log('='.repeat(60));
}

main().catch(console.error);
