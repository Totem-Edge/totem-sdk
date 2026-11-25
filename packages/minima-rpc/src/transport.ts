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
import {
  MINIMA_COMMAND_PARAMS,
  type MinimaCommandParam,
} from './commands.generated.js';

function buildUrl(config: MinimaRpcConfig): string {
  const scheme = config.ssl === false ? 'http' : 'https';
  return `${scheme}://${config.host}:${config.port}`;
}

/**
 * Maximum length of a single RPC parameter value. The node caps POST bodies at
 * 10 MB (CMDHandler::MAX_POST_BODY_SIZE); a full TxPoW hex payload (as carried
 * by `data:` on `sendtransaction`/`txnminepost`) is several KB, far above the
 * old 1024-char limit. Keep a bound slightly below the node's so an oversized
 * parameter is rejected client-side rather than truncated server-side.
 */
const MAX_RPC_PARAM_LENGTH = 10 * 1024 * 1024;

function sanitizeRpcValue(value: unknown, paramName: string): string {
  const str = String(value);
  if (str.length > MAX_RPC_PARAM_LENGTH) {
    throw new MinimaRpcError(
      `Parameter ${paramName} exceeds maximum length (${MAX_RPC_PARAM_LENGTH})`,
      '',
    );
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

function commandSchema(method: string): readonly MinimaCommandParam[] | undefined {
  return (MINIMA_COMMAND_PARAMS as Record<string, readonly MinimaCommandParam[]>)[method];
}

function coerceParamValue(value: unknown, spec: MinimaCommandParam, method: string): string {
  let coerced: string;

  switch (spec.type) {
    case 'boolean':
      if (value === true || value === 'true') coerced = 'true';
      else if (value === false || value === 'false') coerced = 'false';
      else {
        throw new MinimaRpcError(
          `Parameter ${spec.name} must be true or false for ${method}`,
          method,
        );
      }
      break;
    case 'number':
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new MinimaRpcError(`Parameter ${spec.name} must be a finite number`, method);
      }
      coerced = String(value);
      if (!/^-?\d+(?:\.\d+)?$/.test(coerced)) {
        throw new MinimaRpcError(`Parameter ${spec.name} must be numeric for ${method}`, method);
      }
      break;
    case 'object':
    case 'array': {
      let encoded: string | undefined;
      try {
        encoded = JSON.stringify(value);
      } catch {
        encoded = undefined;
      }
      if (encoded === undefined) {
        throw new MinimaRpcError(`Parameter ${spec.name} must be serializable`, method);
      }
      coerced = encoded;
      break;
    }
    default:
      coerced = String(value);
      break;
  }

  if (spec.enum && !spec.enum.includes(coerced)) {
    throw new MinimaRpcError(
      `Parameter ${spec.name} must be one of ${spec.enum.join(', ')} for ${method}`,
      method,
    );
  }
  return coerced;
}

function buildKnownCommand(
  method: string,
  params: Record<string, unknown> | undefined,
  schema: readonly MinimaCommandParam[],
): string {
  const supplied = params ?? {};
  const known = new Set(schema.map((param) => param.name));
  for (const key of Object.keys(supplied)) {
    if (!known.has(key)) {
      throw new MinimaRpcError(`Unknown parameter ${key} for ${method}`, method);
    }
  }

  const parts = [method];
  for (const spec of schema) {
    const value = supplied[spec.name];
    if (value === undefined || value === null) {
      if (spec.required) {
        throw new MinimaRpcError(`Missing required parameter ${spec.name} for ${method}`, method);
      }
      continue;
    }
    pushParam(parts, spec.name, coerceParamValue(value, spec, method));
  }
  return parts.join(' ');
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
 *
 * Known commands are serialized exclusively from the generated node schema;
 * unknown commands keep a validated passthrough for node extensions.
 */
export function buildCommandString(
  method: string,
  params?: Record<string, unknown>,
): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(method)) {
    throw new MinimaRpcError(
      `Invalid command name: ${method}`,
      method,
    );
  }

  // One path for every known command: the generated node schema owns the
  // parameter names, order, types and required checks. Keeping hand-written
  // switch arms here is what let send/balance/txnsign drift from the node.
  const schema = commandSchema(method);
  if (schema) return buildKnownCommand(method, params, schema);

  // Unknown commands retain an explicit passthrough for node extensions.
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
  if (await isRawHttpAvailable()) {
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
