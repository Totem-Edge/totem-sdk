/**
 * CoAP Edge Gateway — wires a CoapTransportPort into an EdgeRuntime.
 *
 * Requests are CON messages matched to responses by token and remote endpoint
 * (RFC 7252 §5.3). Confirmable requests are retransmitted with exponential
 * backoff until acknowledged or until the request deadline expires. An empty
 * ACK keeps the request pending for a separate response, which is acknowledged
 * before being handed to the caller.
 *
 * RFC 7641 observations keep a token registered after the initial response;
 * later notifications with a fresh 24-bit Observe sequence are delivered to the
 * caller and confirmable notifications are acknowledged.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { CoapTransportPort, CoapMessage, CoapBlockOption } from './transport.js';
import type { CoapSecurityPort } from './security.js';
import { decodeCoap, encodeCoap, tokenToKey } from './codec.js';

export interface CoapGatewayTiming {
  /** Overall request deadline in milliseconds. Default 10_000. */
  requestTimeoutMs?: number;
  /** Initial retransmission interval in milliseconds. Default 2_000. */
  ackTimeoutMs?: number;
  /** Maximum retransmissions before waiting for the deadline. Default 4. */
  maxRetransmits?: number;
}

export interface CoapGatewayConfig {
  runtime: EdgeRuntime;
  transport: CoapTransportPort;
  localPort: number;
  timing?: CoapGatewayTiming;
  /** Optional OSCORE boundary; protected endpoints fail closed without it. */
  security?: CoapSecurityPort;
  /** Transparent RFC 7959 blockwise transfer for large payloads. */
  blockwise?: CoapBlockwiseOptions;
}

export interface CoapBlockwiseOptions {
  /** Enable transparent blockwise transfer. Default true. */
  enabled?: boolean;
  /** Preferred block size in bytes (power of two, 16-1024). Default 1024. */
  blockSize?: number;
  /** Maximum assembled response body. Default 1 MiB. */
  maxBodySize?: number;
}

export interface CoapResponseData {
  payload: Uint8Array;
  /** Content-Format option value, e.g. 0 text/plain or 60 application/cbor. */
  contentFormat?: number;
  /** Observe option value (notifications only). */
  observe?: number;
  /** Block1 option echoed by the server. */
  block1?: CoapBlockOption;
  /** Block2 option describing this response block. */
  block2?: CoapBlockOption;
  /** Size1 hint from the server. */
  size1?: number;
  /** Size2 hint (total response body size). */
  size2?: number;
}

export interface CoapObservationData extends CoapResponseData {
  observe: number;
  receivedAt: number;
}

export interface CoapObservation {
  /** Correlation token as lowercase hex. */
  readonly token: string;
  /** Deregister and stop delivering notifications. */
  cancel(): Promise<void>;
}

export interface CoapGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  get(path: string[], host: string, port: number): Promise<EdgeOperationResult<CoapResponseData>>;
  post(path: string[], payload: Uint8Array, host: string, port: number): Promise<EdgeOperationResult<CoapResponseData>>;
  observe(
    path: string[],
    host: string,
    port: number,
    handler: (notification: CoapObservationData) => void,
  ): Promise<EdgeOperationResult<CoapObservation>>;
}

interface ObservationRegistration {
  path: string[];
  handler: (notification: CoapObservationData) => void;
}

interface CoapRequestOptions {
  observation?: ObservationRegistration;
  block1?: CoapBlockOption;
  block2?: CoapBlockOption;
  size1?: number;
  accept?: number;
}

interface PendingRequest {
  messageId: number;
  frame: Uint8Array;
  host: string;
  port: number;
  resolve: (result: EdgeOperationResult<CoapResponseData | CoapObservation>) => void;
  deadline: ReturnType<typeof setTimeout>;
  retransmit?: ReturnType<typeof setTimeout>;
  intervalMs: number;
  attempts: number;
  acknowledged: boolean;
  settled: boolean;
  observation?: ObservationRegistration;
}

interface Observation {
  token: Uint8Array;
  path: string[];
  host: string;
  port: number;
  handler: (notification: CoapObservationData) => void;
  lastSequence: number;
  lastReceivedAt: number;
}

interface RequestContext {
  transport: CoapTransportPort;
  security?: CoapSecurityPort;
  pending: Map<string, PendingRequest>;
  pendingByMessageId: Map<number, string>;
  observations: Map<string, Observation>;
  nextMessageId: () => number;
  timing: Required<CoapGatewayTiming>;
  settle: (key: string, entry: PendingRequest, error?: Error, data?: CoapResponseData) => void;
}

interface Match {
  key: string;
  entry: PendingRequest;
}

const DEFAULT_TIMING: Required<CoapGatewayTiming> = {
  requestTimeoutMs: 10_000,
  ackTimeoutMs: 2_000,
  maxRetransmits: 4,
};

/** RFC 7641 §3.4 freshness window for observation sequence numbers. */
const OBSERVATION_FRESHNESS_MS = 128_000;
const OBSERVATION_SEQUENCE_MODULO = 0x100_0000;
const OBSERVATION_HALF_RANGE = 0x80_0000;

export function createCoapGateway(config: CoapGatewayConfig): CoapGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let unsubMsg: (() => void) | undefined;
  let unsubErr: (() => void) | undefined;
  const pending = new Map<string, PendingRequest>();
  const pendingByMessageId = new Map<number, string>();
  const observations = new Map<string, Observation>();
  let messageId = 0;

  function detach(key: string, entry: PendingRequest): void {
    entry.settled = true;
    clearTimeout(entry.deadline);
    if (entry.retransmit) clearTimeout(entry.retransmit);
    entry.retransmit = undefined;
    if (pending.get(key) === entry) pending.delete(key);
    if (pendingByMessageId.get(entry.messageId) === key) pendingByMessageId.delete(entry.messageId);
  }

  function settle(key: string, entry: PendingRequest, error?: Error, data?: CoapResponseData): void {
    if (entry.settled) return;
    detach(key, entry);
    if (error) entry.resolve({ ok: false, error: error.message });
    else entry.resolve({ ok: true, data: data ?? { payload: new Uint8Array(0) } });
  }

  const context: RequestContext = {
    transport: config.transport,
    security: config.security,
    pending,
    pendingByMessageId,
    observations,
    nextMessageId: () => {
      for (let candidates = 0; candidates <= 0xffff; candidates++) {
        const id = messageId;
        messageId = (messageId + 1) & 0xffff;
        if (!pendingByMessageId.has(id)) return id;
      }
      throw new Error('No free CoAP message ids');
    },
    timing: {
      requestTimeoutMs: config.timing?.requestTimeoutMs ?? DEFAULT_TIMING.requestTimeoutMs,
      ackTimeoutMs: config.timing?.ackTimeoutMs ?? DEFAULT_TIMING.ackTimeoutMs,
      maxRetransmits: config.timing?.maxRetransmits ?? DEFAULT_TIMING.maxRetransmits,
    },
    settle,
  };

  const blockwise = {
    enabled: config.blockwise?.enabled ?? true,
    blockSize: normalizeBlockSize(config.blockwise?.blockSize ?? 1024),
    maxBodySize: config.blockwise?.maxBodySize ?? 1024 * 1024,
  };
  if (!Number.isInteger(blockwise.maxBodySize) || blockwise.maxBodySize < 16) {
    throw new Error('Invalid blockwise maxBodySize');
  }

  function findPending(remote: { host: string; port: number }, tokenKey?: string, msgId?: number): Match | undefined {
    const key = tokenKey ?? (msgId === undefined ? undefined : pendingByMessageId.get(msgId));
    if (!key) return undefined;
    const entry = pending.get(key);
    if (!entry) return undefined;
    if (entry.host !== remote.host || entry.port !== remote.port) return undefined;
    return { key, entry };
  }

  function acknowledge(remote: { host: string; port: number }, msgId: number): void {
    const ack = encodeCoap({
      type: 'ACK', messageId: msgId, token: new Uint8Array(0), path: [],
      payload: new Uint8Array(0), remote, receivedAt: Date.now(),
    });
    void Promise.resolve(config.transport.send(remote.host, remote.port, ack)).catch(() => {});
  }

  async function cancelObservation(key: string): Promise<void> {
    const observation = observations.get(key);
    if (!observation) return;
    observations.delete(key);
    const id = context.nextMessageId();
    let message: CoapMessage = {
      type: 'CON', method: 'GET', messageId: id, token: observation.token, path: observation.path,
      payload: new Uint8Array(0), observe: 1,
      remote: { host: observation.host, port: observation.port }, receivedAt: Date.now(),
    };
    if (config.security?.protects(observation.host, observation.port)) {
      try { message = await config.security.protect(message); } catch { return; }
    }
    try {
      await config.transport.send(observation.host, observation.port, encodeCoap(message));
    } catch { /* deregistration is best effort */ }
  }

  function registerObservation(
    key: string,
    entry: PendingRequest,
    msg: ReturnType<typeof decodeCoap>,
  ): void {
    detach(key, entry);
    const observation: Observation = {
      token: entry.frame.slice(4, 4 + (entry.frame[0] & 0x0f)),
      path: [...entry.observation!.path],
      host: entry.host,
      port: entry.port,
      handler: entry.observation!.handler,
      lastSequence: msg.observe!,
      lastReceivedAt: msg.receivedAt,
    };
    observations.set(key, observation);
    entry.resolve({
      ok: true,
      data: { token: key, cancel: () => cancelObservation(key) },
    });
  }

  function deliverNotification(key: string, observation: Observation, msg: ReturnType<typeof decodeCoap>): void {
    if (observation.host !== msg.remote.host || observation.port !== msg.remote.port) return;
    if (msg.type === 'RST') { observations.delete(key); return; }
    if (msg.type === 'CON') acknowledge(msg.remote, msg.messageId);

    const codeClass = Number(msg.responseCode?.split('.')[0] ?? 0);
    if (codeClass !== 2 || msg.observe === undefined) {
      // A terminal error or a response without Observe ends the relation.
      observations.delete(key);
      return;
    }
    if (!isFreshObservation(observation.lastSequence, observation.lastReceivedAt, msg.observe, msg.receivedAt)) return;

    observation.lastSequence = msg.observe;
    observation.lastReceivedAt = msg.receivedAt;
    status = 'running';
    try {
      observation.handler({
        payload: msg.payload,
        contentFormat: msg.contentFormat,
        observe: msg.observe,
        receivedAt: msg.receivedAt,
      });
    } catch { /* consumer failure must not break the transport */ }
  }

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.bind(config.localPort);
      unsubMsg = config.transport.onMessage((raw, remote) => {
        void (async () => {
          let msg;
          try { msg = decodeCoap(raw, remote); } catch { return; }

          // Fail closed at the security boundary: protected endpoints must send
          // OSCORE (empty ACK/RST is exempt), and OSCORE from an unconfigured
          // endpoint is never treated as plaintext.
          const control = msg.token.length === 0 && (msg.type === 'ACK' || msg.type === 'RST') && msg.responseCode === undefined;
          const protectedEndpoint = config.security?.protects(remote.host, remote.port) ?? false;
          if (msg.oscore !== undefined) {
            if (!protectedEndpoint || !config.security) return;
            try { msg = await config.security.unprotect(msg); } catch { return; }
          } else if (protectedEndpoint && !control) {
            return;
          }

          if (msg.token.length === 4) {
          const key = tokenToKey(msg.token);
          const match = findPending(remote, key);
          if (match) {
            if (msg.type === 'RST') {
              settle(match.key, match.entry, new Error('CoAP reset'));
              return;
            }
            if (msg.type === 'CON') acknowledge(msg.remote, msg.messageId);

            const data: CoapResponseData = { payload: msg.payload };
            if (msg.contentFormat !== undefined) data.contentFormat = msg.contentFormat;
            if (msg.observe !== undefined) data.observe = msg.observe;
            if (msg.block1 !== undefined) data.block1 = msg.block1;
            if (msg.block2 !== undefined) data.block2 = msg.block2;
            if (msg.size1 !== undefined) data.size1 = msg.size1;
            if (msg.size2 !== undefined) data.size2 = msg.size2;

            if (match.entry.observation) {
              if (msg.observe === undefined) {
                settle(match.key, match.entry, new Error('CoAP server did not establish the observation'));
                return;
              }
              const codeClass = Number(msg.responseCode?.split('.')[0] ?? 0);
              if (codeClass !== 2) {
                settle(match.key, match.entry, new Error(`CoAP error response ${msg.responseCode ?? 'unknown'}`));
                return;
              }
              registerObservation(match.key, match.entry, msg);
              return;
            }

            const codeClass = Number(msg.responseCode?.split('.')[0] ?? 0);
            if (codeClass !== 2) {
              settle(match.key, match.entry, new Error(`CoAP error response ${msg.responseCode ?? 'unknown'}`));
              return;
            }
            status = 'running';
            settle(match.key, match.entry, undefined, data);
            return;
          }

          const observation = observations.get(key);
          if (observation) deliverNotification(key, observation, msg);
          return;
        }

        // Empty ACK/RST messages carry no token and are correlated by message id.
        if (msg.token.length !== 0 || (msg.type !== 'ACK' && msg.type !== 'RST')) return;
        const match = findPending(remote, undefined, msg.messageId);
        if (!match) return;
        if (msg.type === 'RST') {
          settle(match.key, match.entry, new Error('CoAP reset'));
          return;
        }
        if (msg.responseCode !== undefined) return;
        match.entry.acknowledged = true;
        if (match.entry.retransmit) clearTimeout(match.entry.retransmit);
        match.entry.retransmit = undefined;
        })().catch(() => { /* malformed or unauthenticated message is dropped */ });
      });
      unsubErr = config.transport.onError((err) => {
        status = 'error';
        for (const [key, entry] of [...pending]) {
          settle(key, entry, new Error(`CoAP transport error: ${err.message}`));
        }
        observations.clear();
      });
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubMsg?.(); unsubErr?.();
      unsubMsg = undefined;
      unsubErr = undefined;
      for (const [key, entry] of [...pending]) settle(key, entry, new Error('Gateway stopped'));
      pending.clear();
      pendingByMessageId.clear();
      observations.clear();
      await config.transport.close();
      status = 'stopped';
    },

    async get(path, host, port) {
      const first = await coapRequest(context, 'GET', path, new Uint8Array(0), host, port) as EdgeOperationResult<CoapResponseData>;
      return blockwise.enabled
        ? followBlock2(context, first, 'GET', path, new Uint8Array(0), host, port, blockwise.maxBodySize)
        : first;
    },

    async post(path, payload, host, port) {
      if (!blockwise.enabled) {
        return coapRequest(context, 'POST', path, payload, host, port) as Promise<EdgeOperationResult<CoapResponseData>>;
      }
      const first = payload.length > blockwise.blockSize
        ? await uploadBlockwise(context, path, payload, host, port, blockwise.blockSize)
        : await coapRequest(context, 'POST', path, payload, host, port) as EdgeOperationResult<CoapResponseData>;
      return followBlock2(context, first, 'POST', path, new Uint8Array(0), host, port, blockwise.maxBodySize);
    },

    async observe(path, host, port, handler) {
      return coapRequest(context, 'GET', path, new Uint8Array(0), host, port, {
        observation: { path: [...path], handler },
      }) as Promise<EdgeOperationResult<CoapObservation>>;
    },
  };
}

function isFreshObservation(previous: number, receivedAt: number, next: number, now: number): boolean {
  if (now - receivedAt > OBSERVATION_FRESHNESS_MS) return true;
  const difference = ((next - previous) % OBSERVATION_SEQUENCE_MODULO + OBSERVATION_SEQUENCE_MODULO) % OBSERVATION_SEQUENCE_MODULO;
  return difference !== 0 && difference < OBSERVATION_HALF_RANGE;
}

async function coapRequest(
  context: RequestContext,
  method: 'GET' | 'POST',
  path: string[],
  payload: Uint8Array,
  host: string,
  port: number,
  options: CoapRequestOptions = {},
): Promise<EdgeOperationResult<CoapResponseData | CoapObservation>> {
  if (!path.length || path.some((segment) => !segment || segment.includes('/'))) {
    return { ok: false, error: 'Invalid CoAP URI path' };
  }

  const { transport, pending, pendingByMessageId, timing, settle } = context;
  let id: number;
  let token: Uint8Array;
  let key: string;
  let frame: Uint8Array;
  try {
    id = context.nextMessageId();
    token = uniqueToken(pending, context.observations);
    key = tokenToKey(token);
    let message: CoapMessage = {
      type: 'CON', method, messageId: id, token, path, payload,
      observe: options.observation ? 0 : undefined,
      ...(options.block1 ? { block1: options.block1 } : {}),
      ...(options.block2 ? { block2: options.block2 } : {}),
      ...(options.size1 !== undefined ? { size1: options.size1 } : {}),
      ...(options.accept !== undefined ? { accept: options.accept } : {}),
      remote: { host, port }, receivedAt: Date.now(),
    };
    if (context.security?.protects(host, port)) {
      try {
        message = await context.security.protect(message);
      } catch (error) {
        return { ok: false, error: `CoAP protection failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
    frame = encodeCoap(message);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  function scheduleRetransmit(entryKey: string, entry: PendingRequest): void {
    if (entry.acknowledged || entry.attempts >= context.timing.maxRetransmits) return;
    entry.retransmit = setTimeout(() => {
      if (entry.settled || entry.acknowledged) return;
      if (pending.get(entryKey) !== entry) return;
      entry.attempts++;
      void Promise.resolve(transport.send(entry.host, entry.port, entry.frame)).catch(() => {});
      entry.intervalMs *= 2;
      scheduleRetransmit(entryKey, entry);
    }, entry.intervalMs);
  }

  return new Promise<EdgeOperationResult<CoapResponseData | CoapObservation>>((resolve) => {
    const entry: PendingRequest = {
      messageId: id,
      frame, host, port,
      resolve,
      deadline: setTimeout(() => settle(key, entry, new Error('CoAP request timed out')), timing.requestTimeoutMs),
      intervalMs: timing.ackTimeoutMs,
      attempts: 0,
      acknowledged: false,
      settled: false,
      ...(options.observation ? { observation: options.observation } : {}),
    };
    pending.set(key, entry);
    pendingByMessageId.set(id, key);
    if (timing.ackTimeoutMs > 0) scheduleRetransmit(key, entry);
    void Promise.resolve(transport.send(host, port, frame)).catch((error: unknown) => {
      settle(key, entry, error instanceof Error ? error : new Error(String(error)));
    });
  });
}

/**
 * RFC 7252 §5.3.1 expects client tokens to be hard for an off-path attacker to
 * guess. Use WebCrypto when the host provides it; otherwise mix a per-gateway
 * seed so tokens are not simply sequential message ids.
 */
const tokenSeed = Math.floor(Math.random() * 0xffffffff);

function uniqueToken(pending: Map<string, PendingRequest>, observations: Map<string, Observation>): Uint8Array {
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = createToken(attempt);
    const key = tokenToKey(token);
    if (!pending.has(key) && !observations.has(key)) return token;
  }
  throw new Error('Unable to allocate a unique CoAP token');
}

function createToken(messageId: number): Uint8Array {
  const token = new Uint8Array(4);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(token);
    return token;
  }
  const value = (tokenSeed ^ Math.imul(messageId + 1, 0x9e3779b1)) >>> 0;
  new DataView(token.buffer).setUint32(0, value, false);
  return token;
}


function normalizeBlockSize(size: number): number {
  if (!Number.isInteger(size) || size < 16 || size > 1024 || (size & (size - 1)) !== 0) {
    throw new Error(`Invalid blockwise block size ${size}; expected a power of two from 16 to 1024`);
  }
  return size;
}

function blockSizeExponent(size: number): number {
  return Math.log2(size) - 4;
}

interface UploadAttempt {
  result?: EdgeOperationResult<CoapResponseData>;
  retryExponent?: number;
}

async function uploadBlockwise(
  context: RequestContext,
  path: string[],
  payload: Uint8Array,
  host: string,
  port: number,
  blockSize: number,
): Promise<EdgeOperationResult<CoapResponseData>> {
  let sizeExponent = blockSizeExponent(blockSize);
  for (let attempt = 0; attempt < 2; attempt++) {
    const outcome = await uploadPass(context, path, payload, host, port, sizeExponent);
    if (outcome.retryExponent === undefined) {
      return outcome.result ?? { ok: false, error: 'Empty blockwise upload' };
    }
    sizeExponent = outcome.retryExponent;
  }
  return { ok: false, error: 'Blockwise size renegotiation failed' };
}

async function uploadPass(
  context: RequestContext,
  path: string[],
  payload: Uint8Array,
  host: string,
  port: number,
  sizeExponent: number,
): Promise<UploadAttempt> {
  const blockSize = 2 ** (sizeExponent + 4);
  let offset = 0;
  let num = 0;
  let last: EdgeOperationResult<CoapResponseData> | undefined;
  while (offset < payload.length) {
    const chunk = payload.slice(offset, Math.min(offset + blockSize, payload.length));
    const more = offset + chunk.length < payload.length;
    const result = await coapRequest(context, 'POST', path, chunk, host, port, {
      block1: { num, more, sizeExponent },
      size1: payload.length,
    }) as EdgeOperationResult<CoapResponseData>;
    if (!result.ok) return { result };
    if (more) {
      const acknowledgement = result.data?.block1;
      if (!acknowledgement) return { result: { ok: false, error: 'Server did not acknowledge the blockwise upload' } };
      if (acknowledgement.num !== num) return { result: { ok: false, error: `Unexpected Block1 number ${acknowledgement.num}` } };
      if (acknowledgement.sizeExponent < sizeExponent) {
        // The server selected a smaller block size; restart the transfer.
        return { retryExponent: acknowledgement.sizeExponent };
      }
      if (acknowledgement.sizeExponent > sizeExponent) {
        return { result: { ok: false, error: 'Server increased the Block1 size mid-transfer' } };
      }
    }
    last = result;
    offset += chunk.length;
    num++;
  }
  return { result: last };
}

async function followBlock2(
  context: RequestContext,
  first: EdgeOperationResult<CoapResponseData>,
  method: 'GET' | 'POST',
  path: string[],
  body: Uint8Array,
  host: string,
  port: number,
  maxBodySize: number,
): Promise<EdgeOperationResult<CoapResponseData>> {
  if (!first.ok || !first.data?.block2?.more) return first;
  const sizeExponent = first.data.block2.sizeExponent;
  let assembled: Uint8Array = first.data.payload.slice();
  let expected = first.data.block2.num + 1;
  let current = first.data;
  if (assembled.length > maxBodySize) return { ok: false, error: 'Blockwise response exceeds maxBodySize' };

  while (current.block2?.more) {
    const next = await coapRequest(context, method, path, method === 'POST' ? new Uint8Array(0) : body, host, port, {
      block2: { num: expected, more: false, sizeExponent },
    }) as EdgeOperationResult<CoapResponseData>;
    if (!next.ok || !next.data) return next;
    if (!next.data.block2) return { ok: false, error: 'Blockwise response is missing Block2' };
    if (next.data.block2.num !== expected) {
      return { ok: false, error: `Unexpected Block2 number ${next.data.block2.num}` };
    }
    if (next.data.block2.sizeExponent !== sizeExponent) {
      return { ok: false, error: 'Server changed the Block2 size mid-transfer' };
    }
    assembled = concatBytes(assembled, next.data.payload);
    if (assembled.length > maxBodySize) return { ok: false, error: 'Blockwise response exceeds maxBodySize' };
    current = next.data;
    expected++;
  }
  return { ok: true, data: { ...current, payload: assembled } };
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const out = new Uint8Array(first.length + second.length);
  out.set(first, 0);
  out.set(second, first.length);
  return out;
}
