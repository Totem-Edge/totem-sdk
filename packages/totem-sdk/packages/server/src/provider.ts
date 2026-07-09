/**
 * Provider interface for connecting to Minima services
 */

import { EventEmitter } from 'events';
import { MinimaClient } from './client.js';

export interface ProviderConfig {
  apiUrl: string;
  apiKey?: string;
  wsUrl?: string;
}

export class MinimaProvider extends EventEmitter {
  private client: MinimaClient;
  
  constructor(config: ProviderConfig) {
    super();
    this.client = new MinimaClient(config);
    
    // Forward client events
    this.client.on('connected', () => this.emit('connected'));
    this.client.on('disconnected', () => this.emit('disconnected'));
    this.client.on('block', (block) => this.emit('block', block));
    this.client.on('error', (error) => this.emit('error', error));
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  disconnect(): void {
    this.client.disconnect();
  }

  async request(method: string, params?: any): Promise<any> {
    switch (method) {
      case 'minima_getBlockHeight':
        return this.client.getBlockHeight();
      case 'minima_getBalance':
        return this.client.getBalance(params.address, params.tokenId);
      case 'minima_getUTXOs':
        return this.client.getUTXOs(params.address);
      case 'minima_sendTransaction':
        return this.client.submitTransaction(params.transaction);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }
}