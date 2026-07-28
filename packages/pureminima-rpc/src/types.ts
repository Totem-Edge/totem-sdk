/**
 * PureMinima RPC types
 * Minima node HTTP RPC response shapes and client config.
 */

export interface PureMinimaConfig {
  host: string;
  port: number;
  password?: string;
  ssl?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

export class PureMinimaRpcError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly minimaError?: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'PureMinimaRpcError';
  }
}

export interface MinimaEnvelope {
  command: string;
  status: boolean;
  pending: boolean;
  response?: unknown;
  error?: string;
}

export interface NodeStatus {
  version: string;
  locked: boolean;
  length: number;
  weight: string;
  minima: string;
  coins: number;
  data: string;
  time: string;
  memory: {
    ram: string;
    disk: string;
    files: {
      txpowdb: string;
      archivedb: string;
      cascade: string;
      chaintree: string;
      wallet: string;
      userdb: string;
      p2pdb: string;
    };
  };
  chain: {
    block: number;
    time: string;
    hash: string;
    speed: string;
    difficulty: string;
    size: number;
    length: number;
    branches: number;
    weight: string;
  };
  txpow: {
    mempool: number;
    ramdb: number;
    txpowdb: number;
    archivedb: number;
  };
  network: {
    host: string;
    port: number;
    connecting: number;
    connected: number;
    rpc: boolean;
    p2p: string;
    traffic: {
      from: string;
      to: string;
      read: string;
      write: string;
    };
  };
}

export interface Balance {
  token: string;
  tokenid: string;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  coins: number;
  total?: string;
  details?: unknown;
}

export interface BalanceQuery {
  address?: string;
  megammr?: boolean;
  tokendetails?: boolean;
}

export interface Coin {
  coinid: string;
  amount: string;
  address: string;
  miniaddress: string;
  tokenid: string;
  token: unknown | null;
  storestate: boolean;
  state: unknown[];
  spent: boolean;
  mmrentry: string;
  created: string;
}

export interface CoinsQuery {
  relevant?: boolean;
  sendable?: boolean;
  coinid?: string;
  amount?: string;
  address?: string;
  tokenid?: string;
  coinage?: number;
  megammr?: boolean;
}

export interface TokenInfo {
  tokenid: string;
  name: Record<string, unknown>;
  total: string;
  sendable: string;
  unconfirmed: string;
  confirmed: string;
  mempool: string;
  coins: number;
  script?: string;
  totalamount?: string;
  scale?: number;
  description?: unknown;
}

export interface AddressInfo {
  script: string;
  address: string;
  miniaddress: string;
  simple: boolean;
  default: boolean;
  publickey: string;
  track: boolean;
}

export interface ChainTip {
  block: number;
  hash: string;
  time: string;
  txpow?: unknown;
}

export interface MMRProof {
  coinid: string;
  data: {
    proof: {
      blocktime: unknown;
      proofchain: unknown[];
      chainsha: string;
    };
    coin: unknown;
  };
}

export interface CoinCheckResult {
  found: boolean;
  spent: boolean;
  coin?: Coin;
  mmrentry?: string;
}

export interface CoinExportResult {
  coinid: string;
  data: string;
}

export interface MegaMMRInfo {
  size: string;
  block: number;
  hash: string;
}

export interface TxnPostResult {
  txpowid?: string;
  txpow?: unknown;
  size?: number;
  isblock?: boolean;
  istransaction?: boolean;
  hasproof?: boolean;
}

export interface TxnPostParams {
  id: string;
  auto?: boolean;
  mine?: boolean;
  txndelete?: boolean;
  burn?: string;
  data?: string;
}

export interface TxnMineParams {
  id: string;
  data?: string;
}

export interface TxnInputParams {
  id: string;
  coinid?: string;
  address?: string;
  amount?: string;
  tokenid?: string;
  floating?: boolean;
}

export interface TxnOutputParams {
  id: string;
  address: string;
  amount: string;
  tokenid?: string;
  storestate?: boolean;
}

export interface TxnStateParams {
  id: string;
  port: number;
  value: string;
}

export interface TxnScriptParams {
  id: string;
  scripts: string;
}

export interface TxnSignParams {
  id: string;
  publickey?: string;
  txndata?: string;
}

export interface TxnCheckResult {
  valid: boolean;
  signatures?: unknown;
  txpow?: unknown;
}

export interface TxnListResult {
  txns?: unknown[];
  txpow?: unknown;
  transaction?: unknown;
}

export interface BurnInfo {
  txpow: unknown;
  avg: string;
  median: string;
  recommended: string;
}

export interface SendParams {
  address: string;
  amount: string;
  tokenid?: string;
  burn?: string;
  split?: number;
}

export interface HistoryQuery {
  action?: string;
  max?: number;
  offset?: number;
  relevant?: boolean;
  address?: string;
}

export interface HistoryEntry {
  txpowid: string;
  superblock: number;
  size: number;
  burn: string;
  header: unknown;
  hasbody: boolean;
  txbody?: unknown;
}

export interface WebhookEntry {
  hook: string;
  filter?: string;
}

export interface PureMinimaClient {
  runCommand(cmd: string, params?: Record<string, unknown>): Promise<unknown>;
  status(): Promise<NodeStatus>;
  balance(params?: BalanceQuery): Promise<Balance[]>;
  coins(query?: CoinsQuery): Promise<Coin[]>;
  tokens(tokenId?: string, action?: string): Promise<TokenInfo[]>;
  getAddress(): Promise<AddressInfo>;
  megammr(): Promise<MegaMMRInfo>;
  history(params?: HistoryQuery): Promise<HistoryEntry[]>;
  burn(last?: number): Promise<BurnInfo>;
  send(params: SendParams): Promise<TxnPostResult>;
  coinCheck(coinId: string): Promise<CoinCheckResult>;
  coinExport(coinId: string): Promise<CoinExportResult>;
  mmrProof(coinId: string): Promise<MMRProof>;
  getTip(): Promise<ChainTip>;
  txnCreate(id: string): Promise<void>;
  txnBasics(id: string): Promise<void>;
  txnInput(params: TxnInputParams): Promise<void>;
  txnOutput(params: TxnOutputParams): Promise<void>;
  txnState(params: TxnStateParams): Promise<void>;
  txnScript(params: TxnScriptParams): Promise<void>;
  txnSign(params: TxnSignParams): Promise<void>;
  txnCheck(id: string): Promise<TxnCheckResult>;
  txnList(id?: string, transactionOnly?: boolean): Promise<TxnListResult>;
  txnImport(data: string, id?: string): Promise<void>;
  txnExport(id: string): Promise<string>;
  txnPost(params: TxnPostParams): Promise<TxnPostResult>;
  txnMinePost(data: string): Promise<TxnPostResult>;
  txnMine(params: TxnMineParams): Promise<void>;
  txnDelete(id: string): Promise<void>;
  txnClear(id: string): Promise<void>;
  verify(publicKey: string, data: string, signature: string): Promise<boolean>;
  webhooks(action: 'list'): Promise<WebhookEntry[]>;
  webhooks(action: 'add', hook: string, filter: 'NEWTXPOW' | 'NEWBLOCK'): Promise<void>;
  webhooks(action: 'remove', hook: string): Promise<void>;
}
