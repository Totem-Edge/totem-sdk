/**
 * Node.js Crypto Adapter
 * Provides CryptoAdapter implementation using Node.js crypto module
 */

import * as crypto from 'crypto';
import type { CryptoAdapter } from '@totemsdk/core';

export class NodeCryptoAdapter implements CryptoAdapter {
  randomBytes(length: number): Uint8Array {
    return new Uint8Array(crypto.randomBytes(length));
  }

  sha256(data: Uint8Array): Uint8Array {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return new Uint8Array(hash.digest());
  }

  async sha256Async(data: Uint8Array): Promise<Uint8Array> {
    return this.sha256(data);
  }
}
