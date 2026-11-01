/**
 * OSCORE (RFC 8613) security context for Node.js.
 *
 * The connector stays crypto-free; this adapter implements the OSCORE client
 * and server roles behind `CoapSecurityPort` using Node's `aes-128-ccm` and
 * HKDF-SHA-256. It is validated against the RFC 8613 Appendix C vectors.
 *
 * Supported profile: AES-CCM-16-64-128 (alg 10), HKDF-SHA-256, no Class I
 * options (none are currently defined), and the CoAP fields modeled by
 * `CoapMessage`. Uri-Host/Uri-Port remain outer (Class U); Uri-Path and
 * Uri-Query are inner (Class E). Block options are inner. Blockwise
 * observations and multicast are outside this adapter's scope.
 */

import type { CoapMessage } from './transport.js';
import type { CoapSecurityPort } from './security.js';
import { decodeBlock, encodeBlock, formatResponseCode, parseResponseCode, tokenToKey } from './codec.js';

export interface OscoreContextConfig {
  masterSecret: Uint8Array;
  /** Optional master salt; defaults to the empty byte string. */
  masterSalt?: Uint8Array;
  senderId: Uint8Array;
  recipientId: Uint8Array;
  idContext?: Uint8Array;
  /** Initial sender sequence number (Partial IV). Default 0. */
  senderSequenceNumber?: number;
  /** Anti-replay window for inbound Partial IVs. Default 32. */
  replayWindowSize?: number;
  /** Restrict protection to these endpoints. Default: all endpoints. */
  endpoints?: Array<{ host: string; port: number }>;
}

const AEAD_ALGORITHM = 10; // AES-CCM-16-64-128
const KEY_LENGTH = 16;
const NONCE_LENGTH = 13;
const TAG_LENGTH = 8;
const MAX_PIV = 0xffffffffff; // 5 bytes

const METHOD_CODES: Record<string, number> = { GET: 1, POST: 2, PUT: 3, DELETE: 4, FETCH: 5 };
const CODE_METHODS: Record<number, 'GET' | 'POST' | 'PUT' | 'DELETE' | 'FETCH'> = { 1: 'GET', 2: 'POST', 3: 'PUT', 4: 'DELETE', 5: 'FETCH' };

interface RequestState {
  kid: Uint8Array;
  piv: Uint8Array;
  nonce: Uint8Array;
}

export async function createOscoreContext(config: OscoreContextConfig): Promise<CoapSecurityPort> {
  const nodeCrypto = await import('node:crypto');

  const masterSalt = config.masterSalt ?? new Uint8Array(0);
  const idContext = config.idContext;
  if (config.senderId.length > NONCE_LENGTH - 6) throw new Error('OSCORE sender ID exceeds 7 bytes');
  if (config.recipientId.length > NONCE_LENGTH - 6) throw new Error('OSCORE recipient ID exceeds 7 bytes');

  const senderKey = deriveKey(nodeCrypto, config.masterSecret, masterSalt, config.senderId, idContext, 'Key', KEY_LENGTH);
  const recipientKey = deriveKey(nodeCrypto, config.masterSecret, masterSalt, config.recipientId, idContext, 'Key', KEY_LENGTH);
  const commonIv = deriveKey(nodeCrypto, config.masterSecret, masterSalt, new Uint8Array(0), idContext, 'IV', NONCE_LENGTH);

  let sequence = config.senderSequenceNumber ?? 0;
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > MAX_PIV) throw new Error('Invalid OSCORE sender sequence number');

  const exchanges = new Map<string, RequestState>();
  const requestReplay = new ReplayWindow(config.replayWindowSize ?? 32);
  const responseReplay = new ReplayWindow(config.replayWindowSize ?? 32);

  function protects(host: string, port: number): boolean {
    if (!config.endpoints || config.endpoints.length === 0) return true;
    return config.endpoints.some((endpoint) => endpoint.host === host && endpoint.port === port);
  }

  function nextPiv(): Uint8Array {
    if (sequence > MAX_PIV) throw new Error('OSCORE sender sequence exhausted');
    const piv = encodePiv(sequence);
    sequence++;
    return piv;
  }

  function protectRequest(message: CoapMessage): CoapMessage {
    const method = message.method!;
    const code = METHOD_CODES[method];
    if (code === undefined) throw new Error(`Unsupported OSCORE method ${method}`);

    const piv = nextPiv();
    const plaintext = encodePlaintext(code, message);
    const aad = buildAad(config.senderId, piv);
    const nonce = buildNonce(commonIv, config.senderId, piv);
    const ciphertext = encrypt(nodeCrypto, senderKey, nonce, aad, plaintext);

    exchanges.set(tokenToKey(message.token), { kid: config.senderId.slice(), piv, nonce });
    trimExchanges(exchanges);
    return {
      type: message.type,
      method: message.observe !== undefined ? 'FETCH' : 'POST',
      messageId: message.messageId,
      token: message.token,
      path: [],
      ...(message.uriHost !== undefined ? { uriHost: message.uriHost } : {}),
      ...(message.uriPort !== undefined ? { uriPort: message.uriPort } : {}),
      payload: ciphertext,
      ...(message.observe !== undefined ? { observe: message.observe } : {}),
      oscore: encodeOscoreOption(piv, { kid: config.senderId, kidContext: idContext, includeKid: true }),
      remote: message.remote,
      receivedAt: message.receivedAt,
    };
  }

  function protectResponse(message: CoapMessage): CoapMessage {
    const key = tokenToKey(message.token);
    const state = exchanges.get(key);
    if (!state) throw new Error('No matching OSCORE request context for the response');
    const code = parseResponseCode(message.responseCode!);
    const plaintext = encodePlaintext(code, message);
    const aad = buildAad(state.kid, state.piv);

    // Notifications carry a fresh Partial IV; a single response reuses the
    // request nonce and omits the Partial IV (RFC 8613 §8.3).
    const notification = message.observe !== undefined;
    const piv = notification ? nextPiv() : new Uint8Array(0);
    const nonce = notification ? buildNonce(commonIv, config.senderId, piv) : state.nonce;
    const ciphertext = encrypt(nodeCrypto, senderKey, nonce, aad, plaintext);

    if (!notification) exchanges.delete(key);
    return {
      type: message.type,
      responseCode: notification ? '2.05' : '2.04',
      messageId: message.messageId,
      token: message.token,
      path: [],
      ...(message.uriHost !== undefined ? { uriHost: message.uriHost } : {}),
      ...(message.uriPort !== undefined ? { uriPort: message.uriPort } : {}),
      payload: ciphertext,
      ...(message.observe !== undefined ? { observe: message.observe } : {}),
      oscore: notification
        ? encodeOscoreOption(piv, { includeKid: false })
        : new Uint8Array(0),
      remote: message.remote,
      receivedAt: message.receivedAt,
    };
  }

  async function protect(message: CoapMessage): Promise<CoapMessage> {
    if (message.method !== undefined) return protectRequest(message);
    if (message.responseCode !== undefined) return protectResponse(message);
    throw new Error('OSCORE protection requires a request method or a response code');
  }

  function unprotectRequest(message: CoapMessage): CoapMessage {
    const option = decodeOscoreOption(message.oscore!);
    if (!option.kid) throw new Error('OSCORE request is missing kid');
    if (!equalBytes(option.kid, config.recipientId)) throw new Error('Unknown OSCORE recipient ID');
    if (option.kidContext && !equalBytes(option.kidContext, idContext ?? new Uint8Array(0))) {
      throw new Error('Unknown OSCORE ID context');
    }
    if (option.piv.length === 0) throw new Error('OSCORE request is missing a Partial IV');
    if (!requestReplay.accept(uintFromBytes(option.piv))) throw new Error('OSCORE replay detected');

    const aad = buildAad(option.kid, option.piv);
    const nonce = buildNonce(commonIv, option.kid, option.piv);
    const plaintext = decryptPayload(nodeCrypto, recipientKey, nonce, aad, message.payload);
    const decoded = decodePlaintext(plaintext, message);
    exchanges.set(tokenToKey(message.token), { kid: option.kid.slice(), piv: option.piv, nonce });
    trimExchanges(exchanges);
    return decoded;
  }

  function unprotectResponse(message: CoapMessage): CoapMessage {
    const option = decodeOscoreOption(message.oscore!);
    if (option.kid && !equalBytes(option.kid, config.recipientId)) throw new Error('Unknown OSCORE recipient ID');
    if (option.kidContext && !equalBytes(option.kidContext, idContext ?? new Uint8Array(0))) {
      throw new Error('Unknown OSCORE ID context');
    }

    const state = exchanges.get(tokenToKey(message.token));
    if (!state) throw new Error('No matching OSCORE request context');
    const hasPiv = option.piv.length > 0;
    if (hasPiv && !responseReplay.accept(uintFromBytes(option.piv))) throw new Error('OSCORE replay detected');

    const nonce = hasPiv
      ? buildNonce(commonIv, config.recipientId, option.piv)
      : state.nonce;
    const aad = buildAad(state.kid, state.piv);
    const plaintext = decryptPayload(nodeCrypto, recipientKey, nonce, aad, message.payload);
    return decodePlaintext(plaintext, message);
  }

  async function unprotect(message: CoapMessage): Promise<CoapMessage> {
    if (message.oscore === undefined) throw new Error('Missing OSCORE option');
    return message.method !== undefined ? unprotectRequest(message) : unprotectResponse(message);
  }

  return { protects, protect, unprotect };
}

function encodePlaintext(code: number, message: CoapMessage): Uint8Array {
  const innerOptions: Array<{ number: number; value: Uint8Array }> = [];
  if (message.observe !== undefined) innerOptions.push({ number: 6, value: uintOption(message.observe) });
  for (const segment of message.path) innerOptions.push({ number: 11, value: new TextEncoder().encode(segment) });
  if (message.contentFormat !== undefined) innerOptions.push({ number: 12, value: uintOption(message.contentFormat) });
  for (const query of message.uriQuery ?? []) innerOptions.push({ number: 15, value: new TextEncoder().encode(query) });
  if (message.accept !== undefined) innerOptions.push({ number: 17, value: uintOption(message.accept) });
  if (message.block2) innerOptions.push({ number: 23, value: uintOption(encodeBlock(message.block2)) });
  if (message.block1) innerOptions.push({ number: 27, value: uintOption(encodeBlock(message.block1)) });
  if (message.size2 !== undefined) innerOptions.push({ number: 28, value: uintOption(message.size2) });
  if (message.size1 !== undefined) innerOptions.push({ number: 60, value: uintOption(message.size1) });

  return concat([
    Uint8Array.of(code),
    encodeOptions(innerOptions),
    message.payload.length ? Uint8Array.of(0xff) : new Uint8Array(0),
    message.payload,
  ]);
}

function deriveKey(
  nodeCrypto: typeof import('node:crypto'),
  masterSecret: Uint8Array,
  masterSalt: Uint8Array,
  id: Uint8Array,
  idContext: Uint8Array | undefined,
  type: 'Key' | 'IV',
  length: number,
): Uint8Array {
  const info = cborArray([
    cborBytes(id),
    idContext ? cborBytes(idContext) : [0xf6],
    cborUint(AEAD_ALGORITHM),
    cborText(type),
    cborUint(length),
  ]);
  const derived = nodeCrypto.hkdfSync(
    'sha256',
    Buffer.from(masterSecret),
    Buffer.from(masterSalt),
    Buffer.from(Uint8Array.from(info)),
    length,
  );
  return new Uint8Array(derived);
}

function buildAad(requestKid: Uint8Array, requestPiv: Uint8Array): Uint8Array {
  const aadArray = cborArray([
    cborUint(1),
    cborArray([cborUint(AEAD_ALGORITHM)]),
    cborBytes(requestKid),
    cborBytes(requestPiv),
    cborBytes(new Uint8Array(0)),
  ]);
  const external = cborBytes(Uint8Array.from(aadArray));
  return Uint8Array.from(cborArray([cborText('Encrypt0'), cborBytes(new Uint8Array(0)), external]));
}

function buildNonce(commonIv: Uint8Array, id: Uint8Array, piv: Uint8Array): Uint8Array {
  if (piv.length > 5) throw new Error('OSCORE Partial IV exceeds 5 bytes');
  if (id.length > 7) throw new Error('OSCORE ID exceeds 7 bytes');
  const pad = new Uint8Array(NONCE_LENGTH);
  pad[0] = id.length;
  // ID and PIV are left-padded within their fields: ID in bytes 1..7, PIV in
  // bytes 8..12 (RFC 8613 §5.2, Figure 8).
  pad.set(id, 8 - id.length);
  pad.set(piv, NONCE_LENGTH - piv.length);
  return Uint8Array.from(commonIv, (byte, index) => byte ^ pad[index]);
}

function encrypt(
  nodeCrypto: typeof import('node:crypto'),
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array,
): Uint8Array {
  const cipher = nodeCrypto.createCipheriv('aes-128-ccm', Buffer.from(key), Buffer.from(nonce), { authTagLength: TAG_LENGTH });
  cipher.setAAD(Buffer.from(aad), { plaintextLength: plaintext.length });
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = new Uint8Array(ciphertext.length + tag.length);
  out.set(ciphertext, 0);
  out.set(tag, ciphertext.length);
  return out;
}

function decryptPayload(
  nodeCrypto: typeof import('node:crypto'),
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  payload: Uint8Array,
): Uint8Array {
  if (payload.length < TAG_LENGTH) throw new Error('OSCORE payload is too short');
  const ciphertext = payload.slice(0, payload.length - TAG_LENGTH);
  const tag = payload.slice(payload.length - TAG_LENGTH);
  const decipher = nodeCrypto.createDecipheriv('aes-128-ccm', Buffer.from(key), Buffer.from(nonce), { authTagLength: TAG_LENGTH });
  decipher.setAAD(Buffer.from(aad), { plaintextLength: ciphertext.length });
  decipher.setAuthTag(Buffer.from(tag));
  try {
    return new Uint8Array(Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]));
  } catch {
    throw new Error('OSCORE authentication failed');
  }
}

function encodePiv(sequence: number): Uint8Array {
  if (sequence === 0) return Uint8Array.of(0);
  const bytes: number[] = [];
  let remaining = sequence;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return Uint8Array.from(bytes);
}

interface OscoreOptionParts {
  kid?: Uint8Array;
  kidContext?: Uint8Array;
  includeKid: boolean;
}

function encodeOscoreOption(piv: Uint8Array, { kid, kidContext, includeKid }: OscoreOptionParts): Uint8Array {
  const flags = (kidContext ? 0x10 : 0) | (includeKid ? 0x08 : 0) | piv.length;
  const out: number[] = [flags, ...piv];
  if (kidContext) out.push(kidContext.length, ...kidContext);
  if (includeKid && kid) out.push(...kid);
  return Uint8Array.from(out);
}

interface OscoreOption {
  piv: Uint8Array;
  kid?: Uint8Array;
  kidContext?: Uint8Array;
}

function decodeOscoreOption(value: Uint8Array): OscoreOption {
  if (value.length === 0) return { piv: new Uint8Array(0) };
  const flags = value[0];
  if ((flags & 0xe0) !== 0) throw new Error('Reserved OSCORE flag bits set');
  const length = flags & 0x07;
  if (length === 6 || length === 7) throw new Error('Reserved OSCORE Partial IV length');
  let offset = 1;
  if (offset + length > value.length) throw new Error('Truncated OSCORE Partial IV');
  const piv = value.slice(offset, offset + length);
  offset += length;

  let kidContext: Uint8Array | undefined;
  if (flags & 0x10) {
    if (offset >= value.length) throw new Error('Truncated OSCORE kid context');
    const contextLength = value[offset++];
    if (offset + contextLength > value.length) throw new Error('Truncated OSCORE kid context');
    kidContext = value.slice(offset, offset + contextLength);
    offset += contextLength;
  }
  let kid: Uint8Array | undefined;
  if (flags & 0x08) {
    kid = value.slice(offset);
    offset = value.length;
  }
  if (offset !== value.length) throw new Error('Trailing OSCORE option bytes');
  return { piv, kid, kidContext };
}

function encodeOptions(entries: Array<{ number: number; value: Uint8Array }>): Uint8Array {
  const sorted = [...entries].sort((a, b) => a.number - b.number);
  const out: number[] = [];
  let previous = 0;
  for (const entry of sorted) {
    const delta = entry.number - previous;
    const length = entry.value.length;
    const deltaNibble = delta < 13 ? delta : delta < 269 ? 13 : 14;
    const lengthNibble = length < 13 ? length : length < 269 ? 13 : 14;
    out.push((deltaNibble << 4) | lengthNibble);
    if (deltaNibble === 13) out.push(delta - 13); else if (deltaNibble === 14) out.push((delta - 269) >> 8, (delta - 269) & 0xff);
    if (lengthNibble === 13) out.push(length - 13); else if (lengthNibble === 14) out.push((length - 269) >> 8, (length - 269) & 0xff);
    out.push(...entry.value);
    previous = entry.number;
  }
  return Uint8Array.from(out);
}

function decodePlaintext(plaintext: Uint8Array, outer: CoapMessage): CoapMessage {
  if (plaintext.length === 0) throw new Error('Empty OSCORE plaintext');
  const code = plaintext[0];
  let offset = 1;
  let optionNumber = 0;
  const path: string[] = [];
  const uriQuery: string[] = [];
  let contentFormat: number | undefined;
  let accept: number | undefined;
  let observe: number | undefined;
  let block1;
  let block2;
  let size1: number | undefined;
  let size2: number | undefined;
  let payload = new Uint8Array(0);
  while (offset < plaintext.length) {
    if (plaintext[offset] === 0xff) {
      offset++;
      payload = plaintext.slice(offset);
      offset = plaintext.length;
      break;
    }
    let delta = plaintext[offset] >> 4;
    let length = plaintext[offset] & 0x0f;
    offset++;
    if (delta === 13) { delta = plaintext[offset] + 13; offset++; } else if (delta === 14) { delta = ((plaintext[offset] << 8) | plaintext[offset + 1]) + 269; offset += 2; }
    if (length === 13) { length = plaintext[offset] + 13; offset++; } else if (length === 14) { length = ((plaintext[offset] << 8) | plaintext[offset + 1]) + 269; offset += 2; }
    optionNumber += delta;
    if (offset + length > plaintext.length) throw new Error('Truncated OSCORE inner option');
    const value = plaintext.slice(offset, offset + length);
    offset += length;
    if (optionNumber === 6) observe = uintFromBytes(value);
    else if (optionNumber === 11) path.push(new TextDecoder().decode(value));
    else if (optionNumber === 12) contentFormat = uintFromBytes(value);
    else if (optionNumber === 15) uriQuery.push(new TextDecoder().decode(value));
    else if (optionNumber === 17) accept = uintFromBytes(value);
    else if (optionNumber === 23) block2 = decodeBlock(value);
    else if (optionNumber === 27) block1 = decodeBlock(value);
    else if (optionNumber === 28) size2 = uintFromBytes(value);
    else if (optionNumber === 60) size1 = uintFromBytes(value);
  }

  const message: CoapMessage = {
    type: outer.type,
    messageId: outer.messageId,
    token: outer.token,
    path,
    payload,
    remote: outer.remote,
    receivedAt: outer.receivedAt,
  };
  if (code >> 5 === 0) {
    const method = CODE_METHODS[code];
    if (method) message.method = method;
  } else {
    message.responseCode = formatResponseCode(code);
  }
  if (outer.uriHost !== undefined) message.uriHost = outer.uriHost;
  if (outer.uriPort !== undefined) message.uriPort = outer.uriPort;
  if (uriQuery.length > 0) message.uriQuery = uriQuery;
  if (contentFormat !== undefined) message.contentFormat = contentFormat;
  if (accept !== undefined) message.accept = accept;
  if (observe !== undefined) message.observe = observe;
  if (block1 !== undefined) message.block1 = block1;
  if (block2 !== undefined) message.block2 = block2;
  if (size1 !== undefined) message.size1 = size1;
  if (size2 !== undefined) message.size2 = size2;
  return message;
}

function cborHeader(major: number, length: number): number[] {
  if (length < 24) return [(major << 5) | length];
  if (length < 256) return [(major << 5) | 24, length];
  if (length < 65536) return [(major << 5) | 25, (length >> 8) & 0xff, length & 0xff];
  return [(major << 5) | 26, (length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff];
}

function cborUint(value: number): number[] {
  return cborHeader(0, value);
}

function cborBytes(value: Uint8Array): number[] {
  return [...cborHeader(2, value.length), ...value];
}

function cborText(value: string): number[] {
  return [...cborHeader(3, value.length), ...new TextEncoder().encode(value)];
}

function cborArray(items: number[][]): number[] {
  return [...cborHeader(4, items.length), ...items.flat()];
}

function uintOption(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid CoAP option value ${value}`);
  if (value === 0) return new Uint8Array(0);
  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return Uint8Array.from(bytes);
}

function uintFromBytes(value: Uint8Array): number {
  if (value.length > 4) throw new Error('CoAP option value exceeds 4 bytes');
  let result = 0;
  for (const byte of value) result = result * 256 + byte;
  return result;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

class ReplayWindow {
  private highest = -1;
  private bitmap = 0n;
  constructor(private readonly size: number) {
    if (!Number.isInteger(size) || size < 1) throw new Error('Invalid OSCORE replay window size');
  }

  accept(sequence: number): boolean {
    if (sequence > this.highest) {
      const shift = BigInt(sequence - this.highest);
      this.bitmap = ((this.bitmap << shift) | 1n) & ((1n << BigInt(this.size)) - 1n);
      this.highest = sequence;
      return true;
    }
    const difference = this.highest - sequence;
    if (difference >= this.size) return false;
    const bit = 1n << BigInt(difference);
    if ((this.bitmap & bit) !== 0n) return false;
    this.bitmap |= bit;
    return true;
  }
}

function trimExchanges(exchanges: Map<string, RequestState>): void {
  while (exchanges.size > 1024) {
    const oldest = exchanges.keys().next().value;
    if (oldest === undefined) return;
    exchanges.delete(oldest);
  }
}
