export * from '../../../../packages/txpow/dist/serialization.js';
export * from '../../../../packages/txpow/dist/constants.js';
export * from '../../../../packages/txpow/dist/difficulty.js';

export async function mineTxPoW(..._args: unknown[]): Promise<never> {
  throw new Error(
    'Local TxPoW mining is disabled in the Totem extension. Submit transactions through the Axia node.'
  );
}
