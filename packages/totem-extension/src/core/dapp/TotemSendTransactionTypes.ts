/**
 * TOTEM_SEND_TRANSACTION Payload Schema
 * 
 * This defines the public dApp-facing API for requesting transactions from the Totem wallet.
 * The schema supports all Minima transaction types from simple sends to complex contracts.
 * 
 * Design Principles:
 * 1. Versioned for forward compatibility
 * 2. Flexible outputs[] array for multi-output transactions
 * 3. Type-safe with explicit transaction intents
 * 4. Supports optional TOTEMIDEA verification
 */

export const TOTEM_SEND_TRANSACTION_VERSION = 1;

export type DAppTransactionIntent =
  | 'send'
  | 'token_send'
  | 'swap'
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'contract_call'
  | 'multisig'
  | 'timelock'
  | 'htlc'
  | 'custom';

export interface DAppStateVariable {
  port: number;
  value: string;
  type?: 'number' | 'string' | 'hex' | 'address';
}

export interface DAppTransactionOutput {
  address: string;
  amount: string;
  tokenId?: string;
  state?: DAppStateVariable[];
  storeState?: boolean;
  script?: string;
  scriptRef?: string;
}

export interface DAppTransactionInput {
  coinId: string;
  address?: string;
  amount?: string;
  tokenId?: string;
}

export interface DAppSwapParams {
  fromTokenId: string;
  toTokenId: string;
  amountIn: string;
  minAmountOut: string;
  slippageBps?: number;
  poolAddress?: string;
}

export interface DAppLiquidityParams {
  poolAddress: string;
  tokenAId: string;
  tokenBId: string;
  amountA?: string;
  amountB?: string;
  lpTokenAmount?: string;
}

export interface DAppMultisigParams {
  requiredSignatures: number;
  publicKeys: string[];
  timeoutBlocks?: number;
}

export interface DAppTimelockParams {
  releaseBlock: number;
  fallbackAddress?: string;
}

export interface DAppHtlcParams {
  hashlock: string;
  timeoutBlocks: number;
  recipientAddress: string;
  refundAddress: string;
}

export interface DAppContractCallParams {
  contractAddress: string;
  method?: string;
  args?: Record<string, string>;
  script?: string;
}

export interface TotemSendTransactionRequest {
  version: typeof TOTEM_SEND_TRANSACTION_VERSION;
  intent: DAppTransactionIntent;
  outputs: DAppTransactionOutput[];
  inputs?: DAppTransactionInput[];
  burn?: string;
  memo?: string;
  metadata?: {
    appName?: string;
    description?: string;
    iconUrl?: string;
  };
  options?: {
    verifyWithTotemidea?: boolean;
    skipPreview?: boolean;
    useSourceAddress?: string;
    excludeAddresses?: string[];
  };
  swap?: DAppSwapParams;
  liquidity?: DAppLiquidityParams;
  multisig?: DAppMultisigParams;
  timelock?: DAppTimelockParams;
  htlc?: DAppHtlcParams;
  contract?: DAppContractCallParams;
}

export interface TotemSendTransactionResponse {
  success: boolean;
  txpowid?: string;
  status?: 'pending' | 'submitted' | 'confirmed' | 'rejected';
  artifactId?: string;
  digestHex?: string;
  error?: string;
  errorCode?: TotemTransactionErrorCode;
  verification?: {
    totemideaValid?: boolean;
    totemideaWarnings?: string[];
    totemideaNotes?: string[];
  };
}

export type TotemTransactionErrorCode =
  | 'INVALID_REQUEST'
  | 'INSUFFICIENT_FUNDS'
  | 'PERMISSION_DENIED'
  | 'USER_REJECTED'
  | 'SITE_NOT_CONNECTED'
  | 'SPENDING_LIMIT_EXCEEDED'
  | 'TOKEN_NOT_ALLOWED'
  | 'VERIFICATION_FAILED'
  | 'BUILD_FAILED'
  | 'SIGN_FAILED'
  | 'BROADCAST_FAILED'
  | 'TIMEOUT';

export interface SiteTransactionPermission {
  origin: string;
  grantedAt: number;
  expiresAt: number;
  scopes: TransactionScope[];
}

export interface TransactionScope {
  tokenId: string;
  tokenSymbol?: string;
  maxAmountPerTx: string;
  maxDailyAmount: string;
  dailyUsed: string;
  lastResetDate: string;
  allowedIntents: DAppTransactionIntent[];
}

export function validateSendTransactionRequest(request: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request || typeof request !== 'object') {
    return { valid: false, errors: ['Request must be an object'] };
  }

  const req = request as Record<string, unknown>;

  if (req.version !== TOTEM_SEND_TRANSACTION_VERSION) {
    errors.push(`Invalid version: expected ${TOTEM_SEND_TRANSACTION_VERSION}, got ${req.version}`);
  }

  const validIntents: DAppTransactionIntent[] = [
    'send', 'token_send', 'swap', 'liquidity_add', 'liquidity_remove',
    'contract_call', 'multisig', 'timelock', 'htlc', 'custom'
  ];
  if (!validIntents.includes(req.intent as DAppTransactionIntent)) {
    errors.push(`Invalid intent: ${req.intent}. Must be one of: ${validIntents.join(', ')}`);
  }

  if (!Array.isArray(req.outputs) || req.outputs.length === 0) {
    errors.push('outputs must be a non-empty array');
  } else {
    for (let i = 0; i < req.outputs.length; i++) {
      const output = req.outputs[i] as Record<string, unknown>;
      if (!output.address || typeof output.address !== 'string') {
        errors.push(`outputs[${i}].address is required and must be a string`);
      }
      if (!output.amount || typeof output.amount !== 'string') {
        errors.push(`outputs[${i}].amount is required and must be a string`);
      }
      const amountNum = parseFloat(output.amount as string);
      if (isNaN(amountNum) || amountNum <= 0) {
        errors.push(`outputs[${i}].amount must be a positive number`);
      }
    }
  }

  if (req.burn !== undefined) {
    const burnNum = parseFloat(req.burn as string);
    if (isNaN(burnNum) || burnNum < 0) {
      errors.push('burn must be a non-negative number string');
    }
  }

  if (req.intent === 'swap' && !req.swap) {
    errors.push('swap params required for swap intent');
  }

  if ((req.intent === 'liquidity_add' || req.intent === 'liquidity_remove') && !req.liquidity) {
    errors.push('liquidity params required for liquidity intent');
  }

  if (req.intent === 'multisig' && !req.multisig) {
    errors.push('multisig params required for multisig intent');
  }

  if (req.intent === 'timelock' && !req.timelock) {
    errors.push('timelock params required for timelock intent');
  }

  if (req.intent === 'htlc' && !req.htlc) {
    errors.push('htlc params required for htlc intent');
  }

  if (req.intent === 'contract_call' && !req.contract) {
    errors.push('contract params required for contract_call intent');
  }

  return { valid: errors.length === 0, errors };
}

export function simpleTotemSendRequest(
  to: string,
  amount: string,
  tokenId?: string
): TotemSendTransactionRequest {
  return {
    version: TOTEM_SEND_TRANSACTION_VERSION,
    intent: tokenId && tokenId !== '0x00' ? 'token_send' : 'send',
    outputs: [{
      address: to,
      amount,
      tokenId: tokenId || '0x00'
    }]
  };
}
