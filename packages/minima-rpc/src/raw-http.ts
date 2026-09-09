/**
 * Raw HTTP POST client — Node-only fallback for servers whose responses are not
 * RFC-compliant (totem-node emits bare-LF line endings and a non-RFC Date
 * header that undici/node:http reject).
 *
 * Kept separate from the primary `fetch` path so Pear/Bare/browser builds that
 * cannot use node:net/node:tls are unaffected; this module only loads when the
 * fallback is needed. Connection is closed after each request (Connection:
 * close) so we read to EOF — no chunked/keep-alive handling required.
 */

import type { MinimaRpcConfig } from './types.js';
import { MinimaRpcError } from './types.js';

export interface RawHttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  bodyText: string;
}

let netModule: typeof import('node:net') | null = null;
let tlsModule: typeof import('node:tls') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  netModule = require('node:net');
} catch {
  netModule = null;
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  tlsModule = require('node:tls');
} catch {
  tlsModule = null;
}

export const isRawHttpAvailable = (): boolean => netModule !== null;

/**
 * POST a Minima-native command string and tolerantly parse the response even
 * when the server uses bare-LF line endings or unusual header values.
 */
export function postCommandRaw(
  config: MinimaRpcConfig,
  commandString: string,
): Promise<RawHttpResponse> {
  return new Promise((resolve, reject) => {
    if (!netModule) {
      reject(new MinimaRpcError('raw HTTP transport unavailable (no node:net)', commandString));
      return;
    }

    const port = config.port;
    const host = config.host;
    const secure = config.ssl !== false;
    const sockModule = secure ? (tlsModule ?? undefined) : netModule;
    if (secure && !sockModule) {
      reject(new MinimaRpcError('raw HTTPS transport unavailable (no node:tls)', commandString));
      return;
    }

    const credential = `${config.username ?? 'minima'}:${config.password ?? ''}`;
    const auth = `Basic ${Buffer.from(credential).toString('base64')}`;

    const body = Buffer.from(commandString, 'utf8');
    const lines = [
      'POST / HTTP/1.1',
      `Host: ${host}:${port}`,
      'Content-Type: text/plain',
      `Authorization: ${auth}`,
      `Content-Length: ${body.length}`,
      'Connection: close',
    ];
    // Header terminator must be an empty line (\r\n\r\n) — the node never
    // responds if the body is glued straight onto the last header.
    const head = lines.join('\r\n') + '\r\n\r\n';
    const request = Buffer.concat([Buffer.from(head, 'utf8'), body]);

    const socket = (sockModule as typeof import('node:net')).connect(port, host, () => {
      socket.write(request);
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (config.timeoutMs !== undefined) {
      timer = setTimeout(() => {
        socket.destroy();
        reject(
          new MinimaRpcError(
            `Request timeout after ${config.timeoutMs}ms (raw transport)`,
            commandString,
          ),
        );
      }, config.timeoutMs);
    }

    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      } else {
        try {
          resolve(parseRawResponse(Buffer.concat(chunks)));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      }
    };

    socket.on('data', (c: Buffer) => {
      chunks.push(c);
      // The node keeps the connection open past the response, so resolve as
      // soon as the full body has arrived (Content-Length) instead of waiting
      // for socket end.
      try {
        parseRawResponse(Buffer.concat(chunks));
        finish();
      } catch {
        // not a complete, parseable response yet
      }
    });
    socket.on('error', (err: Error) => {
      finish(new MinimaRpcError(`Raw HTTP request failed: ${String(err)}`, commandString));
    });
    socket.on('end', () => finish());
    socket.on('close', () => finish());
  });
}

/**
 * Parse an HTTP/1.x response tolerating bare-LF line endings and any header
 * value characters. Returns status, headers, and the body text.
 */
function parseRawResponse(buffer: Buffer): RawHttpResponse {
  const text = buffer.toString('utf8');

  // Split headers from body at the first blank line (\r\n\r\n or \n\n).
  const headerEndMatch = /(?:\r?\n){2}/.exec(text);
  if (!headerEndMatch) {
    throw new MinimaRpcError('Raw HTTP response had no header/body separator', '');
  }
  const headText = text.slice(0, headerEndMatch.index);
  const bodyText = text.slice(headerEndMatch.index + (headerEndMatch[0] as string).length);

  const lines = headText.split(/\r?\n/);
  const statusLine = lines[0] ?? '';
  const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(statusLine);
  if (!statusMatch) {
    throw new MinimaRpcError(`Raw HTTP response had an invalid status line: ${statusLine}`, '');
  }

  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const m = /^([^:]+):\s*(.*)$/.exec(lines[i] ?? '');
    if (m) {
      const key = (m[1] as string).trim().toLowerCase();
      headers[key] = (m[2] as string).trim();
    }
  }

  return { statusCode: Number(statusMatch[1]), headers, bodyText };
}
