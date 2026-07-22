/**
 * PureMinima HTTP transport
 *
 * Uses fetch (available in Bare, Pear, Node 18+, browser).
 * No http module, no curl, no execFile.
 *
 * Wire format (same as MinimaRpcAdapter.makeRawRequest):
 *   POST http[s]://host:port
 *   Content-Type: text/plain
 *   Authorization: Basic base64(user:password)
 *   Body: "command param1:value1 param2:value2"
 *
 * Response envelope: { command, status, pending, response?, error? }
 */

import type { PureMinimaConfig, MinimaEnvelope } from './types.js';
import { PureMinimaRpcError } from './types.js';

function buildUrl(config: PureMinimaConfig): string {
  const scheme = config.ssl === false ? 'http' : 'https';
  return `${scheme}://${config.host}:${config.port}`;
}

function sanitizeRpcValue(value: unknown, paramName: string): string {
  const str = String(value);
  if (str.length > 1024) {
    throw new PureMinimaRpcError(`Parameter ${paramName} exceeds maximum length (1024)`, '');
  }
  if (/[\x00-\x1f\x7f]/.test(str)) {
    throw new PureMinimaRpcError(`Parameter ${paramName} contains control characters`, '');
  }
  return str;
}

function buildAuthHeader(password: string): string {
  const encoded =
    typeof Buffer !== 'undefined'
      ? Buffer.from(`:${password}`).toString('base64')
      : btoa(`:${password}`);
  return `Basic ${encoded}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the Minima command string from a method name + params object.
 * Ported from MinimaRpcAdapter.translateToMinimaCommand() with Gap 1 + Gap 2 fixes applied.
 */
export function buildCommandString(
  method: string,
  params?: Record<string, unknown>,
): string {
  const p = params ?? {};

  switch (method) {
    case 'balance': {
      const parts = ['balance'];
      if (p.address !== undefined) parts.push(`address:${p.address}`);
      if (p.megammr !== undefined) parts.push(`megammr:${p.megammr}`);
      if (p.tokendetails !== undefined) parts.push(`tokendetails:${p.tokendetails}`);
      return parts.join(' ');
    }

    case 'history': {
      const parts = ['history'];
      if (p.action !== undefined) parts.push(`action:${p.action}`);
      if (p.max !== undefined) parts.push(`max:${p.max}`);
      if (p.offset !== undefined) parts.push(`offset:${p.offset}`);
      if (p.relevant !== undefined) parts.push(`relevant:${p.relevant}`);
      if (p.address !== undefined) parts.push(`address:${p.address}`);
      return parts.join(' ');
    }

    case 'coins': {
      const parts = ['coins'];
      if (p.relevant !== undefined) parts.push(`relevant:${p.relevant}`);
      if (p.sendable !== undefined) parts.push(`sendable:${p.sendable}`);
      if (p.coinid !== undefined) parts.push(`coinid:${p.coinid}`);
      if (p.amount !== undefined) parts.push(`amount:${p.amount}`);
      if (p.address !== undefined) parts.push(`address:${p.address}`);
      if (p.tokenid !== undefined) parts.push(`tokenid:${p.tokenid}`);
      if (p.coinage !== undefined) parts.push(`coinage:${p.coinage}`);
      if (p.megammr !== undefined) parts.push(`megammr:${p.megammr}`);
      return parts.join(' ');
    }

    case 'tokens': {
      const parts = ['tokens'];
      if (p.tokenid !== undefined) parts.push(`tokenid:${p.tokenid}`);
      if (p.action !== undefined) parts.push(`action:${p.action}`);
      return parts.join(' ');
    }

    case 'status':
      return 'status';

    case 'burn': {
      const parts = ['burn'];
      if (p.last !== undefined) parts.push(`last:${p.last}`);
      return parts.join(' ');
    }

    case 'send': {
      const parts = ['send'];
      if (p.address !== undefined) parts.push(`address:${p.address}`);
      if (p.amount !== undefined) parts.push(`amount:${p.amount}`);
      if (p.tokenid !== undefined) parts.push(`tokenid:${p.tokenid}`);
      if (p.burn !== undefined) parts.push(`burn:${p.burn}`);
      if (p.split !== undefined) parts.push(`split:${p.split}`);
      return parts.join(' ');
    }

    case 'getaddress':
      return 'getaddress';

    case 'megammr':
      return 'megammr';

    case 'coinexport': {
      const parts = ['coinexport'];
      if (p.coinid !== undefined) parts.push(`coinid:${p.coinid}`);
      return parts.join(' ');
    }

    case 'verify': {
      const parts = ['verify'];
      if (p.publickey !== undefined) parts.push(`publickey:${p.publickey}`);
      if (p.data !== undefined) parts.push(`data:${p.data}`);
      if (p.signature !== undefined) parts.push(`signature:${p.signature}`);
      return parts.join(' ');
    }

    case 'webhooks': {
      const parts = ['webhooks'];
      parts.push(`action:${p.action}`);
      if (p.hook !== undefined) parts.push(`hook:${p.hook}`);
      if (p.filter !== undefined) parts.push(`filter:${p.filter}`);
      return parts.join(' ');
    }

    case 'txncreate': {
      const parts = ['txncreate'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      return parts.join(' ');
    }

    case 'txnbasics': {
      const parts = ['txnbasics'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      return parts.join(' ');
    }

    case 'txnpost': {
      const parts = ['txnpost'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      if (p.data !== undefined) parts.push(`data:${p.data}`);
      if (p.auto !== undefined) parts.push(`auto:${p.auto}`);
      if (p.mine !== undefined) parts.push(`mine:${p.mine}`);
      if (p.txndelete !== undefined) parts.push(`txndelete:${p.txndelete}`);
      if (p.burn !== undefined) parts.push(`burn:${p.burn}`);
      return parts.join(' ');
    }

    case 'txnsign': {
      const parts = ['txnsign'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      if (p.publickey !== undefined) parts.push(`publickey:${p.publickey}`);
      if (p.txndata !== undefined) parts.push(`txndata:${p.txndata}`);
      return parts.join(' ');
    }

    case 'txncheck': {
      const parts = ['txncheck'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      return parts.join(' ');
    }

    case 'txnimport': {
      const parts = ['txnimport'];
      if (p.data !== undefined) parts.push(`data:${p.data}`);
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      return parts.join(' ');
    }

    case 'txnexport': {
      const parts = ['txnexport'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      return parts.join(' ');
    }

    case 'txnlist': {
      const parts = ['txnlist'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      if (p.transactiononly !== undefined) parts.push(`transactiononly:${p.transactiononly}`);
      return parts.join(' ');
    }

    case 'txndelete': {
      const parts = ['txndelete'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      return parts.join(' ');
    }

    case 'txninput': {
      const parts = ['txninput'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      if (p.coinid !== undefined) parts.push(`coinid:${p.coinid}`);
      if (p.address !== undefined) parts.push(`address:${p.address}`);
      if (p.amount !== undefined) parts.push(`amount:${p.amount}`);
      if (p.tokenid !== undefined) parts.push(`tokenid:${p.tokenid}`);
      if (p.floating !== undefined) parts.push(`floating:${p.floating}`);
      return parts.join(' ');
    }

    case 'txnoutput': {
      const parts = ['txnoutput'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      if (p.address !== undefined) parts.push(`address:${p.address}`);
      if (p.amount !== undefined) parts.push(`amount:${p.amount}`);
      if (p.tokenid !== undefined) parts.push(`tokenid:${p.tokenid}`);
      if (p.storestate !== undefined) parts.push(`storestate:${p.storestate}`);
      return parts.join(' ');
    }

    case 'txnstate': {
      const parts = ['txnstate'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      if (p.port !== undefined) parts.push(`port:${p.port}`);
      if (p.value !== undefined) parts.push(`value:${p.value}`);
      return parts.join(' ');
    }

    case 'txnscript': {
      const parts = ['txnscript'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      if (p.scripts !== undefined) parts.push(`scripts:${p.scripts}`);
      return parts.join(' ');
    }

    case 'txnclear': {
      const parts = ['txnclear'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      return parts.join(' ');
    }

    case 'txnmine': {
      const parts = ['txnmine'];
      if (p.id !== undefined) parts.push(`id:${p.id}`);
      if (p.data !== undefined) parts.push(`data:${p.data}`);
      return parts.join(' ');
    }

    case 'txnminepost': {
      const parts = ['txnminepost'];
      if (p.data !== undefined) parts.push(`data:${p.data}`);
      return parts.join(' ');
    }

    case 'sendfrom': {
      const parts = ['sendfrom'];
      if (p.fromaddress !== undefined) parts.push(`fromaddress:${sanitizeRpcValue(p.fromaddress, 'fromaddress')}`);
      if (p.address !== undefined) parts.push(`address:${sanitizeRpcValue(p.address, 'address')}`);
      if (p.amount !== undefined) parts.push(`amount:${sanitizeRpcValue(p.amount, 'amount')}`);
      if (p.tokenid !== undefined) parts.push(`tokenid:${sanitizeRpcValue(p.tokenid, 'tokenid')}`);
      if (p.script !== undefined) parts.push(`script:${sanitizeRpcValue(p.script, 'script')}`);
      if (p.keyuses !== undefined) parts.push(`keyuses:${sanitizeRpcValue(p.keyuses, 'keyuses')}`);
      if (p.burn !== undefined) parts.push(`burn:${sanitizeRpcValue(p.burn, 'burn')}`);
      if (p.mine !== undefined) parts.push(`mine:${sanitizeRpcValue(p.mine, 'mine')}`);
      return parts.join(' ');
    }

    case 'sendnosign': {
      const parts = ['sendnosign'];
      if (p.address !== undefined) parts.push(`address:${p.address}`);
      if (p.amount !== undefined) parts.push(`amount:${p.amount}`);
      if (p.multi !== undefined) parts.push(`multi:${p.multi}`);
      if (p.tokenid !== undefined) parts.push(`tokenid:${p.tokenid}`);
      if (p.state !== undefined) parts.push(`state:${p.state}`);
      if (p.burn !== undefined) parts.push(`burn:${p.burn}`);
      if (p.split !== undefined) parts.push(`split:${p.split}`);
      if (p.file !== undefined) parts.push(`file:${p.file}`);
      if (p.debug !== undefined) parts.push(`debug:${p.debug}`);
      return parts.join(' ');
    }

    case 'sendview': {
      const parts = ['sendview'];
      if (p.file !== undefined) parts.push(`file:${p.file}`);
      return parts.join(' ');
    }

    case 'sendsign': {
      const parts = ['sendsign'];
      if (p.file !== undefined) parts.push(`file:${p.file}`);
      return parts.join(' ');
    }

    case 'sendpost': {
      const parts = ['sendpost'];
      if (p.file !== undefined) parts.push(`file:${p.file}`);
      return parts.join(' ');
    }

    /**
     * PureMinima-specific commands.
     * Command names inferred from Minima naming conventions.
     * Verify against https://github.com/spartacusrex-minima/minima-core/tree/main/src/org/minima/system/commands/
     */
    case 'getmmrproof': {
      const parts = ['getmmrproof'];
      if (p.coinid !== undefined) parts.push(`coinid:${p.coinid}`);
      return parts.join(' ');
    }

    case 'coincheck': {
      const parts = ['coincheck'];
      if (p.coinid !== undefined) parts.push(`coinid:${p.coinid}`);
      return parts.join(' ');
    }

    case 'getchaintip':
      return 'getchaintip';

    default: {
      if (!/^[a-zA-Z0-9_-]+$/.test(method)) {
        throw new PureMinimaRpcError(
          `Invalid command name: ${method}`,
          method,
        );
      }
      if (!params || Object.keys(params).length === 0) {
        return method;
      }
      const parts = [method];
      for (const [key, value] of Object.entries(params)) {
        if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
          throw new PureMinimaRpcError(
            `Invalid parameter name: ${key}`,
            method,
          );
        }
        parts.push(`${key}:${value}`);
      }
      return parts.join(' ');
    }
  }
}

/**
 * Send a single POST to the Minima RPC endpoint and return the parsed envelope.
 * Throws PureMinimaRpcError on HTTP errors or Minima status:false.
 */
export async function postCommand(
  config: PureMinimaConfig,
  commandString: string,
): Promise<unknown> {
  const url = buildUrl(config);
  const timeoutMs = config.timeoutMs ?? 30_000;
  const maxRetries = config.maxRetries ?? 0;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(200 * 2 ** (attempt - 1), 5_000));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
      };
      if (config.password) {
        headers['Authorization'] = buildAuthHeader(config.password);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: commandString,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 401 || response.status === 403) {
        throw new PureMinimaRpcError(
          `Authentication failed: HTTP ${response.status}`,
          commandString,
          undefined,
          response.status,
        );
      }

      if (!response.ok) {
        throw new PureMinimaRpcError(
          `HTTP ${response.status} error`,
          commandString,
          undefined,
          response.status,
        );
      }

      const text = await response.text();
      let envelope: MinimaEnvelope;
      try {
        envelope = JSON.parse(text) as MinimaEnvelope;
      } catch {
        return text;
      }

      if (envelope.status === false) {
        throw new PureMinimaRpcError(
          `Minima command failed: ${envelope.error ?? 'unknown error'}`,
          commandString,
          envelope.error,
        );
      }

      return envelope.response;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof PureMinimaRpcError) throw err;
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));
      if (isAbort) {
        throw new PureMinimaRpcError(
          `Request timeout after ${timeoutMs}ms`,
          commandString,
        );
      }
      lastError = err;
    }
  }

  throw new PureMinimaRpcError(
    `Command failed after ${maxRetries + 1} attempt(s): ${String(lastError)}`,
    commandString,
  );
}
