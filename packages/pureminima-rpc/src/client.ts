/**
 * PureMinima RPC Client
 * Factory function returning a typed PureMinimaClient object.
 */

import type {
  PureMinimaConfig,
  PureMinimaClient,
  NodeStatus,
  Balance,
  BalanceQuery,
  Coin,
  CoinsQuery,
  TokenInfo,
  AddressInfo,
  ChainTip,
  MMRProof,
  CoinCheckResult,
  CoinExportResult,
  MegaMMRInfo,
  TxnPostResult,
  TxnPostParams,
  TxnMineParams,
  TxnInputParams,
  TxnOutputParams,
  TxnStateParams,
  TxnScriptParams,
  TxnSignParams,
  TxnCheckResult,
  TxnListResult,
  BurnInfo,
  SendParams,
  HistoryQuery,
  HistoryEntry,
  WebhookEntry,
} from './types.js';
import { buildCommandString, postCommand } from './transport.js';

export function createPureMinimaClient(config: PureMinimaConfig): PureMinimaClient {
  async function run(cmd: string, params?: Record<string, unknown>): Promise<unknown> {
    const commandString = buildCommandString(cmd, params);
    return postCommand(config, commandString);
  }

  return {
    runCommand(cmd, params) {
      return run(cmd, params);
    },

    async status() {
      return run('status') as Promise<NodeStatus>;
    },

    async balance(params?: BalanceQuery) {
      const result = await run('balance', params as Record<string, unknown> | undefined);
      return result as Balance[];
    },

    async coins(query?: CoinsQuery) {
      const result = await run('coins', query as Record<string, unknown> | undefined);
      return result as Coin[];
    },

    async tokens(tokenId?: string, action?: string) {
      const p: Record<string, unknown> = {};
      if (tokenId !== undefined) p.tokenid = tokenId;
      if (action !== undefined) p.action = action;
      const result = await run('tokens', p);
      return result as TokenInfo[];
    },

    async getAddress() {
      return run('getaddress') as Promise<AddressInfo>;
    },

    async megammr() {
      return run('megammr') as Promise<MegaMMRInfo>;
    },

    async history(params?: HistoryQuery) {
      const result = await run('history', params as Record<string, unknown> | undefined);
      return result as HistoryEntry[];
    },

    async burn(last?: number) {
      const p: Record<string, unknown> = {};
      if (last !== undefined) p.last = last;
      return run('burn', p) as Promise<BurnInfo>;
    },

    async send(params: SendParams) {
      return run('send', params as unknown as Record<string, unknown>) as Promise<TxnPostResult>;
    },

    async coinCheck(coinId: string) {
      return run('coincheck', { coinid: coinId }) as Promise<CoinCheckResult>;
    },

    async coinExport(coinId: string) {
      return run('coinexport', { coinid: coinId }) as Promise<CoinExportResult>;
    },

    async mmrProof(coinId: string) {
      return run('getmmrproof', { coinid: coinId }) as Promise<MMRProof>;
    },

    async getTip() {
      return run('getchaintip') as Promise<ChainTip>;
    },

    async txnCreate(id: string) {
      await run('txncreate', { id });
    },

    async txnBasics(id: string) {
      await run('txnbasics', { id });
    },

    async txnInput(params: TxnInputParams) {
      await run('txninput', params as unknown as Record<string, unknown>);
    },

    async txnOutput(params: TxnOutputParams) {
      await run('txnoutput', params as unknown as Record<string, unknown>);
    },

    async txnState(params: TxnStateParams) {
      await run('txnstate', params as unknown as Record<string, unknown>);
    },

    async txnScript(params: TxnScriptParams) {
      await run('txnscript', params as unknown as Record<string, unknown>);
    },

    async txnSign(params: TxnSignParams) {
      await run('txnsign', params as unknown as Record<string, unknown>);
    },

    async txnCheck(id: string) {
      return run('txncheck', { id }) as Promise<TxnCheckResult>;
    },

    async txnList(id?: string, transactionOnly?: boolean) {
      const p: Record<string, unknown> = {};
      if (id !== undefined) p.id = id;
      if (transactionOnly !== undefined) p.transactiononly = transactionOnly;
      return run('txnlist', p) as Promise<TxnListResult>;
    },

    async txnImport(data: string, id?: string) {
      const p: Record<string, unknown> = { data };
      if (id !== undefined) p.id = id;
      await run('txnimport', p);
    },

    async txnExport(id: string) {
      const result = await run('txnexport', { id });
      return result as string;
    },

    async txnPost(params: TxnPostParams) {
      return run('txnpost', params as unknown as Record<string, unknown>) as Promise<TxnPostResult>;
    },

    async txnMinePost(data: string) {
      return run('txnminepost', { data }) as Promise<TxnPostResult>;
    },

    async txnMine(params: TxnMineParams) {
      await run('txnmine', params as unknown as Record<string, unknown>);
    },

    async txnDelete(id: string) {
      await run('txndelete', { id });
    },

    async txnClear(id: string) {
      await run('txnclear', { id });
    },

    async verify(publicKey: string, data: string, signature: string) {
      const result = await run('verify', {
        publickey: publicKey,
        data,
        signature,
      });
      const r = result as { valid?: boolean };
      return r?.valid === true;
    },

    webhooks: ((action: string, hook?: string, filter?: string) => {
      const p: Record<string, unknown> = { action };
      if (hook !== undefined) p.hook = hook;
      if (filter !== undefined) p.filter = filter;
      if (action === 'list') {
        return postCommand(
          config,
          buildCommandString('webhooks', p),
        ) as Promise<WebhookEntry[]>;
      }
      return postCommand(config, buildCommandString('webhooks', p)).then(() => undefined);
    }) as PureMinimaClient['webhooks'],
  };
}
