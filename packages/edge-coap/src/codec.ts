/**
 * CoAP wire codec (RFC 7252 §3).
 *
 * Kept independent of the transport so the encoding can be exercised against
 * RFC vectors without a socket. Only Uri-Path (option 11) is emitted; Uri-Host
 * and Uri-Port default to the destination address, so they are not sent.
 */

import type { CoapMessage, CoapMessageType, CoapMethod } from './transport.js';

export const URI_HOST_OPTION = 3;
export const OBSERVE_OPTION = 6;
export const URI_PORT_OPTION = 7;
export const OSCORE_OPTION = 9;
export const BLOCK2_OPTION = 23;
export const BLOCK1_OPTION = 27;
export const SIZE2_OPTION = 28;
export const SIZE1_OPTION = 60;
export const URI_PATH_OPTION = 11;
export const CONTENT_FORMAT_OPTION = 12;
export const ACCEPT_OPTION = 17;
export const URI_QUERY_OPTION = 15;
const PAYLOAD_MARKER = 0xff;
const MAX_TOKEN_LENGTH = 8;
const MAX_OPTION_VALUE = 65804; // 269 + 0xffff

const METHOD_CODES: Record<CoapMethod, number> = { GET: 1, POST: 2, PUT: 3, DELETE: 4, FETCH: 5 };
const CODE_METHODS: Record<number, CoapMethod> = { 1: 'GET', 2: 'POST', 3: 'PUT', 4: 'DELETE', 5: 'FETCH' };

export function tokenToKey(token: Uint8Array): string {
  return Array.from(token).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function encodeCoap(msg: CoapMessage): Uint8Array {
  const tokenLen = msg.token.length;
  if (tokenLen > MAX_TOKEN_LENGTH) throw new Error('CoAP token exceeds 8 bytes');
  if (msg.messageId < 0 || msg.messageId > 0xffff) throw new Error('CoAP message id out of range');

  const entries: Array<{ number: number; value: Uint8Array }> = [];
  if (msg.uriHost !== undefined) entries.push({ number: URI_HOST_OPTION, value: new TextEncoder().encode(msg.uriHost) });
  if (msg.observe !== undefined) entries.push({ number: OBSERVE_OPTION, value: uintToBytes(msg.observe) });
  if (msg.uriPort !== undefined) entries.push({ number: URI_PORT_OPTION, value: uintToBytes(msg.uriPort) });
  if (msg.oscore) entries.push({ number: OSCORE_OPTION, value: msg.oscore });
  for (const segment of msg.path) {
    if (segment.length === 0) throw new Error('CoAP Uri-Path segment cannot be empty');
    entries.push({ number: URI_PATH_OPTION, value: new TextEncoder().encode(segment) });
  }
  for (const query of msg.uriQuery ?? []) {
    entries.push({ number: URI_QUERY_OPTION, value: new TextEncoder().encode(query) });
  }
  if (msg.contentFormat !== undefined) entries.push({ number: CONTENT_FORMAT_OPTION, value: uintToBytes(msg.contentFormat) });
  if (msg.accept !== undefined) entries.push({ number: ACCEPT_OPTION, value: uintToBytes(msg.accept) });
  if (msg.block2) entries.push({ number: BLOCK2_OPTION, value: uintToBytes(encodeBlock(msg.block2)) });
  if (msg.block1) entries.push({ number: BLOCK1_OPTION, value: uintToBytes(encodeBlock(msg.block1)) });
  if (msg.size2 !== undefined) entries.push({ number: SIZE2_OPTION, value: uintToBytes(msg.size2) });
  if (msg.size1 !== undefined) entries.push({ number: SIZE1_OPTION, value: uintToBytes(msg.size1) });
  // Stable sort keeps repeated Uri-Path segments in path order.
  entries.sort((a, b) => a.number - b.number);

  const options: number[] = [];
  let previousOption = 0;
  for (const entry of entries) {
    const delta = optionDeltaNibble(entry.number - previousOption);
    const length = optionLengthNibble(entry.value.length);
    options.push((delta.nibble << 4) | length.nibble, ...delta.extended, ...length.extended, ...entry.value);
    previousOption = entry.number;
  }

  let code = 0;
  if (msg.type === 'CON' || msg.type === 'NON') {
    if (msg.method) {
      if (METHOD_CODES[msg.method] === undefined) throw new Error('CoAP request requires a method');
      code = METHOD_CODES[msg.method];
    } else if (msg.responseCode !== undefined) {
      code = parseResponseCode(msg.responseCode);
    } else {
      throw new Error('CoAP CON/NON message requires a method or response code');
    }
  } else if (msg.responseCode !== undefined) {
    code = parseResponseCode(msg.responseCode);
  }

  const marker = msg.payload.length > 0 ? [PAYLOAD_MARKER] : [];
  const out = new Uint8Array(4 + tokenLen + options.length + marker.length + msg.payload.length);
  out[0] = 0x40 | ((msgTypeCode(msg.type) & 0x03) << 4) | tokenLen;
  out[1] = code;
  out[2] = (msg.messageId >> 8) & 0xff;
  out[3] = msg.messageId & 0xff;
  out.set(msg.token, 4);
  out.set(options, 4 + tokenLen);
  const payloadOffset = 4 + tokenLen + options.length;
  if (marker.length) out[payloadOffset] = PAYLOAD_MARKER;
  out.set(msg.payload, payloadOffset + marker.length);
  return out;
}

export function decodeCoap(raw: Uint8Array, remote: { host: string; port: number }): CoapMessage {
  if (raw.length < 4) throw new Error('Truncated CoAP header');
  const version = (raw[0] >> 6) & 0x03;
  if (version !== 1) throw new Error(`Unsupported CoAP version ${version}`);
  const tokenLen = raw[0] & 0x0f;
  if (tokenLen > MAX_TOKEN_LENGTH) throw new Error('Invalid CoAP token length');
  if (raw.length < 4 + tokenLen) throw new Error('Truncated CoAP token');

  const type = typeFromCode((raw[0] >> 4) & 0x03);
  const code = raw[1];
  const messageId = ((raw[2] << 8) | raw[3]) & 0xffff;
  const token = raw.slice(4, 4 + tokenLen);

  const path: string[] = [];
  const uriQuery: string[] = [];
  let uriHost: string | undefined;
  let uriPort: number | undefined;
  let optionNumber = 0;
  let offset = 4 + tokenLen;
  let payload = new Uint8Array(0);
  let contentFormat: number | undefined;
  let accept: number | undefined;
  let observe: number | undefined;
  let oscore: Uint8Array | undefined;
  let block1: import('./transport.js').CoapBlockOption | undefined;
  let block2: import('./transport.js').CoapBlockOption | undefined;
  let size1: number | undefined;
  let size2: number | undefined;
  const seen = new Set<number>();
  while (offset < raw.length) {
    if (raw[offset] === PAYLOAD_MARKER) {
      offset++;
      if (offset === raw.length) throw new Error('CoAP payload marker without payload');
      payload = raw.slice(offset);
      offset = raw.length;
      break;
    }
    const delta = (raw[offset] >> 4) & 0x0f;
    const length = raw[offset] & 0x0f;
    offset++;
    const deltaValue = readExtendedOptionValue(delta, raw, offset);
    offset = deltaValue.offset;
    const lengthValue = readExtendedOptionValue(length, raw, offset);
    offset = lengthValue.offset;
    optionNumber += deltaValue.value;
    if (optionNumber > 0xffff) throw new Error('CoAP option number out of range');
    if (offset + lengthValue.value > raw.length) throw new Error('Truncated CoAP option value');
    const value = raw.slice(offset, offset + lengthValue.value);
    if (optionNumber !== URI_PATH_OPTION && optionNumber !== URI_QUERY_OPTION && seen.has(optionNumber)) {
      throw new Error(`Duplicate CoAP option ${optionNumber}`);
    }
    if (optionNumber === URI_HOST_OPTION) {
      uriHost = new TextDecoder().decode(value);
    } else if (optionNumber === URI_PORT_OPTION) {
      uriPort = uintFromBytes(value);
    } else if (optionNumber === URI_PATH_OPTION) {
      const segment = new TextDecoder().decode(value);
      if (segment.length === 0) throw new Error('Empty CoAP Uri-Path segment');
      path.push(segment);
    } else if (optionNumber === URI_QUERY_OPTION) {
      uriQuery.push(new TextDecoder().decode(value));
    } else if (optionNumber === CONTENT_FORMAT_OPTION) {
      contentFormat = uintFromBytes(value);
    } else if (optionNumber === ACCEPT_OPTION) {
      accept = uintFromBytes(value);
    } else if (optionNumber === OBSERVE_OPTION) {
      observe = uintFromBytes(value);
    } else if (optionNumber === OSCORE_OPTION) {
      oscore = value.slice();
    } else if (optionNumber === BLOCK1_OPTION) {
      block1 = decodeBlock(value);
    } else if (optionNumber === BLOCK2_OPTION) {
      block2 = decodeBlock(value);
    } else if (optionNumber === SIZE1_OPTION) {
      size1 = uintFromBytes(value);
    } else if (optionNumber === SIZE2_OPTION) {
      size2 = uintFromBytes(value);
    }
    seen.add(optionNumber);
    offset += lengthValue.value;
  }

  const message: CoapMessage = {
    type,
    messageId,
    token,
    path,
    payload,
    remote,
    receivedAt: Date.now(),
  };
  if (uriHost !== undefined) message.uriHost = uriHost;
  if (uriPort !== undefined) message.uriPort = uriPort;
  if (uriQuery.length > 0) message.uriQuery = uriQuery;
  if (contentFormat !== undefined) message.contentFormat = contentFormat;
  if (accept !== undefined) message.accept = accept;
  if (observe !== undefined) message.observe = observe;
  if (oscore !== undefined) message.oscore = oscore;
  if (block1 !== undefined) message.block1 = block1;
  if (block2 !== undefined) message.block2 = block2;
  if (size1 !== undefined) message.size1 = size1;
  if (size2 !== undefined) message.size2 = size2;
  const codeClass = code >> 5;
  if (codeClass === 0) {
    const method = CODE_METHODS[code];
    if (method) message.method = method;
  } else {
    message.responseCode = formatResponseCode(code);
  }
  return message;
}

function msgTypeCode(type: CoapMessageType): number {
  switch (type) {
    case 'CON': return 0;
    case 'NON': return 1;
    case 'ACK': return 2;
    case 'RST': return 3;
  }
}

function typeFromCode(code: number): CoapMessageType {
  switch (code & 0x03) {
    case 0: return 'CON';
    case 1: return 'NON';
    case 2: return 'ACK';
    default: return 'RST';
  }
}

function optionDeltaNibble(value: number): { nibble: number; extended: number[] } {
  if (value <= 12) return { nibble: value, extended: [] };
  if (value <= 268) return { nibble: 13, extended: [value - 13] };
  return { nibble: 14, extended: [(value - 269) >> 8, (value - 269) & 0xff] };
}

function optionLengthNibble(value: number): { nibble: number; extended: number[] } {
  if (value > MAX_OPTION_VALUE) throw new Error('CoAP option value exceeds 65804 bytes');
  if (value <= 12) return { nibble: value, extended: [] };
  if (value <= 268) return { nibble: 13, extended: [value - 13] };
  return { nibble: 14, extended: [(value - 269) >> 8, (value - 269) & 0xff] };
}

function readExtendedOptionValue(nibble: number, raw: Uint8Array, offset: number): { value: number; offset: number } {
  if (nibble <= 12) return { value: nibble, offset };
  if (nibble === 13) {
    if (offset >= raw.length) throw new Error('Truncated CoAP option delta/length');
    return { value: raw[offset] + 13, offset: offset + 1 };
  }
  if (nibble === 14) {
    if (offset + 1 >= raw.length) throw new Error('Truncated CoAP option delta/length');
    return { value: ((raw[offset] << 8) | raw[offset + 1]) + 269, offset: offset + 2 };
  }
  throw new Error('Invalid CoAP option delta/length nibble');
}

export function encodeBlock(block: import('./transport.js').CoapBlockOption): number {
  if (!Number.isInteger(block.num) || block.num < 0 || block.num > 0xfffff) throw new Error(`Invalid CoAP block number ${block.num}`);
  if (!Number.isInteger(block.sizeExponent) || block.sizeExponent < 0 || block.sizeExponent > 6) {
    throw new Error(`Invalid CoAP block size exponent ${block.sizeExponent}`);
  }
  return ((block.num & 0xfffff) << 4) | (block.more ? 0x08 : 0) | block.sizeExponent;
}

export function decodeBlock(value: Uint8Array): import('./transport.js').CoapBlockOption {
  const encoded = uintFromBytes(value);
  const sizeExponent = encoded & 0x07;
  if (sizeExponent === 7) throw new Error('Reserved CoAP block size exponent');
  return { num: encoded >>> 4, more: (encoded & 0x08) !== 0, sizeExponent };
}

function uintToBytes(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Invalid CoAP uint option value ${value}`);
  }
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
  if (value.length > 4) throw new Error('CoAP uint option exceeds 4 bytes');
  let result = 0;
  for (const byte of value) result = result * 256 + byte;
  return result;
}

export function formatResponseCode(code: number): string {
  return `${(code >> 5) & 0x07}.${String(code & 0x1f).padStart(2, '0')}`;
}

export function parseResponseCode(code: string): number {
  const match = /^([1-5])\.(\d{2})$/.exec(code);
  if (!match) throw new Error(`Invalid CoAP response code '${code}'`);
  const detail = Number(match[2]);
  if (detail > 31) throw new Error(`Invalid CoAP response code '${code}'`);
  return (Number(match[1]) << 5) | detail;
}
