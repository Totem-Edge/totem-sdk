/**
 * Totem/Minima HTTP transport
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

import type { MinimaRpcConfig, MinimaEnvelope } from './types.js';
import { MinimaRpcError } from './types.js';
import { postCommandRaw, isRawHttpAvailable } from './raw-http.js';

function buildUrl(config: MinimaRpcConfig): string {
  const scheme = config.ssl === false ? 'http' : 'https';
  return `${scheme}://${config.host}:${config.port}`;
}

function sanitizeRpcValue(value: unknown, paramName: string): string {
  const str = String(value);
  if (str.length > 1024) {
    throw new MinimaRpcError(`Parameter ${paramName} exceeds maximum length (1024)`, '');
  }
  // The wire format is space-delimited, so any whitespace in a value would
  // inject additional `key:value` parameters. Reject whitespace and control
  // characters outright.
  if (/[\x00-\x20\x7f]/.test(str)) {
    throw new MinimaRpcError(
      `Parameter ${paramName} contains whitespace or control characters`,
      '',
    );
  }
  return str;
}

/**
 * Push a `name:value` parameter onto the command parts, sanitizing the value
 * so it cannot inject whitespace-delimited extra parameters.
 */
function pushParam(parts: string[], name: string, value: unknown): void {
  parts.push(`${name}:${sanitizeRpcValue(value, name)}`);
}

function buildAuthHeader(config: MinimaRpcConfig): string {
  const user = config.username ?? 'minima';
  const credential = `${user}:${config.password ?? ''}`;
  const encoded =
    typeof Buffer !== 'undefined'
      ? Buffer.from(credential).toString('base64')
      : btoa(credential);
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
      if (p.address !== undefined) pushParam(parts, 'address', p.address);
      if (p.megammr !== undefined) pushParam(parts, 'megammr', p.megammr);
      if (p.tokendetails !== undefined) pushParam(parts, 'tokendetails', p.tokendetails);
      return parts.join(' ');
    }

    case 'history': {
      const parts = ['history'];
      if (p.action !== undefined) pushParam(parts, 'action', p.action);
      if (p.max !== undefined) pushParam(parts, 'max', p.max);
      if (p.offset !== undefined) pushParam(parts, 'offset', p.offset);
      if (p.relevant !== undefined) pushParam(parts, 'relevant', p.relevant);
      if (p.address !== undefined) pushParam(parts, 'address', p.address);
      return parts.join(' ');
    }

    case 'coins': {
      const parts = ['coins'];
      if (p.relevant !== undefined) pushParam(parts, 'relevant', p.relevant);
      if (p.sendable !== undefined) pushParam(parts, 'sendable', p.sendable);
      if (p.coinid !== undefined) pushParam(parts, 'coinid', p.coinid);
      if (p.amount !== undefined) pushParam(parts, 'amount', p.amount);
      if (p.address !== undefined) pushParam(parts, 'address', p.address);
      if (p.tokenid !== undefined) pushParam(parts, 'tokenid', p.tokenid);
      if (p.coinage !== undefined) pushParam(parts, 'coinage', p.coinage);
      if (p.megammr !== undefined) pushParam(parts, 'megammr', p.megammr);
      return parts.join(' ');
    }

    case 'tokens': {
      const parts = ['tokens'];
      if (p.tokenid !== undefined) pushParam(parts, 'tokenid', p.tokenid);
      if (p.action !== undefined) pushParam(parts, 'action', p.action);
      return parts.join(' ');
    }

    case 'status':
      return 'status';

    case 'burn': {
      const parts = ['burn'];
      if (p.last !== undefined) pushParam(parts, 'last', p.last);
      return parts.join(' ');
    }

    case 'send': {
      const parts = ['send'];
      if (p.address !== undefined) pushParam(parts, 'address', p.address);
      if (p.amount !== undefined) pushParam(parts, 'amount', p.amount);
      if (p.tokenid !== undefined) pushParam(parts, 'tokenid', p.tokenid);
      if (p.burn !== undefined) pushParam(parts, 'burn', p.burn);
      if (p.split !== undefined) pushParam(parts, 'split', p.split);
      return parts.join(' ');
    }

    case 'getaddress':
      return 'getaddress';

    case 'megammr':
      return 'megammr';

    case 'coinexport': {
      const parts = ['coinexport'];
      if (p.coinid !== undefined) pushParam(parts, 'coinid', p.coinid);
      return parts.join(' ');
    }

    case 'verify': {
      const parts = ['verify'];
      if (p.publickey !== undefined) pushParam(parts, 'publickey', p.publickey);
      if (p.data !== undefined) pushParam(parts, 'data', p.data);
      if (p.signature !== undefined) pushParam(parts, 'signature', p.signature);
      return parts.join(' ');
    }

    case 'webhooks': {
      const parts = ['webhooks'];
      pushParam(parts, 'action', p.action);
      if (p.hook !== undefined) pushParam(parts, 'hook', p.hook);
      if (p.filter !== undefined) pushParam(parts, 'filter', p.filter);
      return parts.join(' ');
    }

    case 'txncreate': {
      const parts = ['txncreate'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      return parts.join(' ');
    }

    case 'txnbasics': {
      const parts = ['txnbasics'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      return parts.join(' ');
    }

    case 'txnpost': {
      const parts = ['txnpost'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      if (p.data !== undefined) pushParam(parts, 'data', p.data);
      if (p.auto !== undefined) pushParam(parts, 'auto', p.auto);
      if (p.mine !== undefined) pushParam(parts, 'mine', p.mine);
      if (p.txndelete !== undefined) pushParam(parts, 'txndelete', p.txndelete);
      if (p.burn !== undefined) pushParam(parts, 'burn', p.burn);
      return parts.join(' ');
    }

    case 'txnsign': {
      const parts = ['txnsign'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      if (p.publickey !== undefined) pushParam(parts, 'publickey', p.publickey);
      if (p.txndata !== undefined) pushParam(parts, 'txndata', p.txndata);
      return parts.join(' ');
    }

    case 'txncheck': {
      const parts = ['txncheck'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      return parts.join(' ');
    }

    case 'txnimport': {
      const parts = ['txnimport'];
      if (p.data !== undefined) pushParam(parts, 'data', p.data);
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      return parts.join(' ');
    }

    case 'txnexport': {
      const parts = ['txnexport'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      return parts.join(' ');
    }

    case 'txnlist': {
      const parts = ['txnlist'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      if (p.transactiononly !== undefined) pushParam(parts, 'transactiononly', p.transactiononly);
      return parts.join(' ');
    }

    case 'txndelete': {
      const parts = ['txndelete'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      return parts.join(' ');
    }

    case 'txninput': {
      const parts = ['txninput'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      if (p.coinid !== undefined) pushParam(parts, 'coinid', p.coinid);
      if (p.address !== undefined) pushParam(parts, 'address', p.address);
      if (p.amount !== undefined) pushParam(parts, 'amount', p.amount);
      if (p.tokenid !== undefined) pushParam(parts, 'tokenid', p.tokenid);
      if (p.floating !== undefined) pushParam(parts, 'floating', p.floating);
      return parts.join(' ');
    }

    case 'txnoutput': {
      const parts = ['txnoutput'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      if (p.address !== undefined) pushParam(parts, 'address', p.address);
      if (p.amount !== undefined) pushParam(parts, 'amount', p.amount);
      if (p.tokenid !== undefined) pushParam(parts, 'tokenid', p.tokenid);
      if (p.storestate !== undefined) pushParam(parts, 'storestate', p.storestate);
      return parts.join(' ');
    }

    case 'txnstate': {
      const parts = ['txnstate'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      if (p.port !== undefined) pushParam(parts, 'port', p.port);
      if (p.value !== undefined) pushParam(parts, 'value', p.value);
      return parts.join(' ');
    }

    case 'txnscript': {
      const parts = ['txnscript'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      if (p.scripts !== undefined) pushParam(parts, 'scripts', p.scripts);
      return parts.join(' ');
    }

    case 'txnclear': {
      const parts = ['txnclear'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      return parts.join(' ');
    }

    case 'txnmine': {
      const parts = ['txnmine'];
      if (p.id !== undefined) pushParam(parts, 'id', p.id);
      if (p.data !== undefined) pushParam(parts, 'data', p.data);
      return parts.join(' ');
    }

    case 'txnminepost': {
      const parts = ['txnminepost'];
      if (p.data !== undefined) pushParam(parts, 'data', p.data);
      return parts.join(' ');
    }

    case 'sendfrom': {
      const parts = ['sendfrom'];
      if (p.fromaddress !== undefined) pushParam(parts, 'fromaddress', p.fromaddress);
      if (p.address !== undefined) pushParam(parts, 'address', p.address);
      if (p.amount !== undefined) pushParam(parts, 'amount', p.amount);
      if (p.tokenid !== undefined) pushParam(parts, 'tokenid', p.tokenid);
      if (p.script !== undefined) pushParam(parts, 'script', p.script);
      if (p.keyuses !== undefined) pushParam(parts, 'keyuses', p.keyuses);
      if (p.burn !== undefined) pushParam(parts, 'burn', p.burn);
      if (p.mine !== undefined) pushParam(parts, 'mine', p.mine);
      return parts.join(' ');
    }

    case 'sendnosign': {
      const parts = ['sendnosign'];
      if (p.address !== undefined) pushParam(parts, 'address', p.address);
      if (p.amount !== undefined) pushParam(parts, 'amount', p.amount);
      if (p.multi !== undefined) pushParam(parts, 'multi', p.multi);
      if (p.tokenid !== undefined) pushParam(parts, 'tokenid', p.tokenid);
      if (p.state !== undefined) pushParam(parts, 'state', p.state);
      if (p.burn !== undefined) pushParam(parts, 'burn', p.burn);
      if (p.split !== undefined) pushParam(parts, 'split', p.split);
      if (p.file !== undefined) pushParam(parts, 'file', p.file);
      if (p.debug !== undefined) pushParam(parts, 'debug', p.debug);
      return parts.join(' ');
    }

    case 'sendview': {
      const parts = ['sendview'];
      if (p.file !== undefined) pushParam(parts, 'file', p.file);
      return parts.join(' ');
    }

    case 'sendsign': {
      const parts = ['sendsign'];
      if (p.file !== undefined) pushParam(parts, 'file', p.file);
      return parts.join(' ');
    }

    case 'sendpost': {
      const parts = ['sendpost'];
      if (p.file !== undefined) pushParam(parts, 'file', p.file);
      return parts.join(' ');
    }

    /**
     * MinimaRpc-specific commands.
     * Command names inferred from Minima naming conventions.
     * Verify against https://github.com/spartacusrex-minima/minima-core/tree/main/src/org/minima/system/commands/
     */
    case 'getmmrproof': {
      const parts = ['getmmrproof'];
      if (p.coinid !== undefined) pushParam(parts, 'coinid', p.coinid);
      return parts.join(' ');
    }

    case 'coincheck': {
      const parts = ['coincheck'];
      if (p.coinid !== undefined) pushParam(parts, 'coinid', p.coinid);
      return parts.join(' ');
    }

    case 'getchaintip':
      return 'getchaintip';

    default: {
      if (!/^[a-zA-Z0-9_-]+$/.test(method)) {
        throw new MinimaRpcError(
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
          throw new MinimaRpcError(
            `Invalid parameter name: ${key}`,
            method,
          );
        }
        pushParam(parts, key, value);
      }
      return parts.join(' ');
    }
  }
}

/**
 * Send a single POST to the Minima RPC endpoint and return the parsed envelope.
 * Throws MinimaRpcError on HTTP errors or Minima status:false.
 *
 * @param opts.retryable When true, ambiguous network failures are retried (up to
 *   `config.maxRetries`) and the tolerant raw HTTP transport may be used as a
 *   fallback. Defaults to false: ambiguous failures surface immediately without
 *   repeating a possibly non-idempotent command.
 */
export async function postCommand(
  config: MinimaRpcConfig,
  commandString: string,
  opts?: { retryable?: boolean },
): Promise<unknown> {
  const retryable = opts?.retryable ?? false;
  const url = buildUrl(config);
  const timeoutMs = config.timeoutMs ?? 30_000;
  const maxRetries = retryable ? (config.maxRetries ?? 0) : 0;

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
        headers['Authorization'] = buildAuthHeader(config);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: commandString,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 401 || response.status === 403) {
        throw new MinimaRpcError(
          `Authentication failed: HTTP ${response.status}`,
          commandString,
          undefined,
          response.status,
        );
      }

      if (!response.ok) {
        throw new MinimaRpcError(
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
        throw new MinimaRpcError(
          `Minima command failed: ${envelope.error ?? 'unknown error'}`,
          commandString,
          envelope.error,
        );
      }

      return envelope.response;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof MinimaRpcError) throw err;
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));
      if (isAbort) {
        // A hung fetch against a non-RFC server must NOT be fatal for
        // retryable reads — record it and fall through to the tolerant raw
        // transport below.
        lastError = err;
        continue;
      }
      lastError = err;
    }
  }

  // Ambiguous network failure. For non-retryable (typically mutating)
  // commands, surface the failure immediately rather than repeating the
  // operation or falling back to a second transport.
  if (!retryable) {
    throw new MinimaRpcError(
      `Ambiguous network failure (not retried): ${String(lastError)}`,
      commandString,
    );
  }

  // Final attempt via the raw, tolerant transport so the SDK works against
  // servers that undici/node:http cannot parse.
  if (isRawHttpAvailable()) {
    const raw = await postCommandRaw(config, commandString);
    if (raw.statusCode === 401 || raw.statusCode === 403) {
      throw new MinimaRpcError(
        `Authentication failed: HTTP ${raw.statusCode}`,
        commandString,
        undefined,
        raw.statusCode,
      );
    }
    if (!raw.bodyText.trim()) {
      throw new MinimaRpcError(`HTTP ${raw.statusCode} error (empty body)`, commandString);
    }
    let envelope: MinimaEnvelope;
    try {
      envelope = JSON.parse(raw.bodyText) as MinimaEnvelope;
    } catch {
      return raw.bodyText;
    }
    if (envelope.status === false) {
      throw new MinimaRpcError(
        `Minima command failed: ${envelope.error ?? 'unknown error'}`,
        commandString,
        envelope.error,
      );
    }
    return envelope.response;
  }

  throw new MinimaRpcError(
    `Command failed after ${maxRetries + 1} attempt(s): ${String(lastError)}`,
    commandString,
  );
}
