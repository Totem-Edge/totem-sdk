export type TxLogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LOG_LEVEL_PRIORITY: Record<TxLogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

let currentLogLevel: TxLogLevel = 'info';

const VERBOSE_MODE_KEY = 'TX_VERBOSE_LOGGING';

function getLogLevel(): TxLogLevel {
  try {
    if (typeof __DESIGNER_MODE__ !== 'undefined' && __DESIGNER_MODE__ && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(VERBOSE_MODE_KEY);
      if (stored === 'trace') return 'trace';
      if (stored === 'debug') return 'debug';
    }
  } catch (e) {
  }
  return currentLogLevel;
}

export function setTxLogLevel(level: TxLogLevel): void {
  currentLogLevel = level;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(VERBOSE_MODE_KEY, level);
  }
}

export function enableVerboseLogging(): void {
  setTxLogLevel('trace');
}

export function disableVerboseLogging(): void {
  setTxLogLevel('info');
}

function shouldLog(level: TxLogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[getLogLevel()];
}

export type TxLogScope = 
  | 'Tx:Build' 
  | 'Tx:Sign' 
  | 'Tx:Send' 
  | 'Tx:Serialize' 
  | 'Tx:WOTS'
  | 'Tx:Verify'
  | 'Wallet';

export interface TxLogContext {
  txId?: string;
  phase?: string;
  [key: string]: unknown;
}

function formatPrefix(scope: TxLogScope, txId?: string): string {
  return txId ? `[${scope}][${txId.slice(0, 8)}]` : `[${scope}]`;
}

function formatMessage(message: string, context?: TxLogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return message;
  }
  const { txId, phase, ...rest } = context;
  if (Object.keys(rest).length === 0) {
    return message;
  }
  return `${message} ${JSON.stringify(rest)}`;
}

export interface ScopedLogger {
  error(message: string, context?: TxLogContext): void;
  warn(message: string, context?: TxLogContext): void;
  info(message: string, context?: TxLogContext): void;
  debug(message: string, context?: TxLogContext): void;
  trace(message: string, context?: TxLogContext): void;
  child(txId: string): ScopedLogger;
}

export function createTxLogger(scope: TxLogScope, defaultTxId?: string): ScopedLogger {
  const log = (level: TxLogLevel, message: string, context?: TxLogContext): void => {
    if (!shouldLog(level)) return;
    
    const txId = context?.txId || defaultTxId;
    const prefix = formatPrefix(scope, txId);
    const formattedMessage = formatMessage(message, context);
    const fullMessage = `${prefix} ${formattedMessage}`;
    
    switch (level) {
      case 'error':
        console.error(fullMessage);
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'info':
        console.log(fullMessage);
        break;
      case 'debug':
        console.debug(fullMessage);
        break;
      case 'trace':
        console.debug(fullMessage);
        break;
    }
  };
  
  return {
    error: (message, context) => log('error', message, context),
    warn: (message, context) => log('warn', message, context),
    info: (message, context) => log('info', message, context),
    debug: (message, context) => log('debug', message, context),
    trace: (message, context) => log('trace', message, context),
    child: (txId: string) => createTxLogger(scope, txId),
  };
}

let correlationCounter = 0;

export function generateTxCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (correlationCounter++).toString(36).padStart(4, '0');
  return `tx-${timestamp}-${counter}`;
}

export const TxBuildLogger = createTxLogger('Tx:Build');
export const TxSignLogger = createTxLogger('Tx:Sign');
export const TxSendLogger = createTxLogger('Tx:Send');
export const TxSerializeLogger = createTxLogger('Tx:Serialize');
export const TxWotsLogger = createTxLogger('Tx:WOTS');
export const TxVerifyLogger = createTxLogger('Tx:Verify');
export const WalletLogger = createTxLogger('Wallet');
