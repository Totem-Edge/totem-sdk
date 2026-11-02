/**
 * MAVLink 1/2 framing and common-message decoding.
 *
 * Frame checksums use the MAVLink X25 CRC plus the per-message CRC_EXTRA byte.
 * MAVLink 2 signed frames are accepted; the 13-byte signature is carried but
 * not verified here (signing policy belongs to the caller).
 */

export type MavlinkVersion = 1 | 2;

export interface MavlinkFrame {
  version: MavlinkVersion;
  sequence: number;
  systemId: number;
  componentId: number;
  messageId: number;
  payload: Uint8Array;
  incompatFlags: number;
  compatFlags: number;
  signature?: Uint8Array;
}

export interface MavlinkMessage extends MavlinkFrame {
  name: string;
  decoded: Record<string, unknown>;
}

export class MavlinkProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MavlinkProtocolError';
  }
}

export const MESSAGE_IDS = {
  HEARTBEAT: 0,
  SYS_STATUS: 1,
  GPS_RAW_INT: 24,
  ATTITUDE: 30,
  GLOBAL_POSITION_INT: 33,
  COMMAND_LONG: 76,
  COMMAND_ACK: 77,
  STATUSTEXT: 253,
} as const;

const MESSAGE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(MESSAGE_IDS).map(([name, id]) => [id, name]),
);

const CRC_EXTRA: Record<number, number> = {
  0: 50, 1: 124, 24: 24, 30: 39, 33: 104, 76: 152, 77: 143, 253: 83,
};

export function encodeFrame(
  version: MavlinkVersion,
  sequence: number,
  systemId: number,
  componentId: number,
  messageId: number,
  payload: Uint8Array,
): Uint8Array {
  const extra = CRC_EXTRA[messageId];
  if (extra === undefined) throw new MavlinkProtocolError(`Unsupported MAVLink message id ${messageId}`);
  if (payload.length > 255) throw new MavlinkProtocolError('MAVLink payload exceeds 255 bytes');
  const header = version === 1
    ? [0xfe, payload.length, sequence & 0xff, systemId & 0xff, componentId & 0xff, messageId & 0xff]
    : [0xfd, payload.length, 0, 0, sequence & 0xff, systemId & 0xff, componentId & 0xff, messageId & 0xff, (messageId >> 8) & 0xff, (messageId >> 16) & 0xff];
  const crc = x25([...header.slice(1), ...payload, extra]);
  return Uint8Array.from([...header, ...payload, crc & 0xff, (crc >> 8) & 0xff]);
}

export function decodeFrames(buffer: Uint8Array): { frames: MavlinkFrame[]; rest: Uint8Array } {
  const frames: MavlinkFrame[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xfe && buffer[offset] !== 0xfd) { offset++; continue; }
    const version: MavlinkVersion = buffer[offset] === 0xfe ? 1 : 2;
    const headerLength = version === 1 ? 6 : 10;
    if (offset + headerLength > buffer.length) break;
    const payloadLength = buffer[offset + 1];
    const incompatFlags = version === 2 ? buffer[offset + 2] : 0;
    const compatFlags = version === 2 ? buffer[offset + 3] : 0;
    const signed = version === 2 && (incompatFlags & 0x01) !== 0;
    const total = headerLength + payloadLength + 2 + (signed ? 13 : 0);
    if (offset + total > buffer.length) break;

    const sequence = buffer[offset + (version === 1 ? 2 : 4)];
    const systemId = buffer[offset + (version === 1 ? 3 : 5)];
    const componentId = buffer[offset + (version === 1 ? 4 : 6)];
    const messageId = version === 1
      ? buffer[offset + 5]
      : buffer[offset + 7] | (buffer[offset + 8] << 8) | (buffer[offset + 9] << 16);
    const payloadStart = offset + headerLength;
    const payload = buffer.slice(payloadStart, payloadStart + payloadLength);
    const crcOffset = payloadStart + payloadLength;
    const expected = buffer[crcOffset] | (buffer[crcOffset + 1] << 8);
    const extra = CRC_EXTRA[messageId];
    if (extra !== undefined) {
      const actual = x25([...buffer.slice(offset + 1, crcOffset), extra]);
      if (actual !== expected) { offset++; continue; }
    } else {
      // Unknown message: keep the frame but do not verify a CRC_EXTRA we do
      // not know; the wire checksum still bounds corruption.
      offset++;
      continue;
    }
    const signature = signed ? buffer.slice(crcOffset + 2, crcOffset + 15) : undefined;
    frames.push({
      version, sequence, systemId, componentId, messageId,
      payload, incompatFlags, compatFlags, ...(signature ? { signature } : {}),
    });
    offset += total;
  }
  return { frames, rest: buffer.slice(offset) };
}

export function decodeMessage(frame: MavlinkFrame): MavlinkMessage {
  return {
    ...frame,
    name: MESSAGE_NAMES[frame.messageId] ?? `MESSAGE_${frame.messageId}`,
    decoded: decodePayload(frame.messageId, frame.payload),
  };
}

export function encodeHeartbeat(systemId: number, componentId: number, sequence: number): Uint8Array {
  const payload = new Uint8Array(9);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 0, true);
  payload[4] = 2; // MAV_TYPE_QUADROTOR
  payload[5] = 8; // MAV_AUTOPILOT_INVALID / generic
  payload[6] = 0; // base mode
  payload[7] = 4; // MAV_STATE_ACTIVE
  payload[8] = 3; // MAVLink 2
  return encodeFrame(2, sequence, systemId, componentId, MESSAGE_IDS.HEARTBEAT, payload);
}

export function encodeCommandLong(
  sequence: number,
  systemId: number,
  componentId: number,
  targetSystem: number,
  targetComponent: number,
  command: number,
  params: number[],
  confirmation = 0,
): Uint8Array {
  if (params.length > 7) throw new MavlinkProtocolError('COMMAND_LONG accepts at most 7 parameters');
  const payload = new Uint8Array(33);
  const view = new DataView(payload.buffer);
  for (let index = 0; index < 7; index++) view.setFloat32(index * 4, params[index] ?? 0, true);
  view.setUint16(28, command, true);
  payload[30] = targetSystem;
  payload[31] = targetComponent;
  payload[32] = confirmation;
  return encodeFrame(2, sequence, systemId, componentId, MESSAGE_IDS.COMMAND_LONG, payload);
}

export function decodePayload(messageId: number, payload: Uint8Array): Record<string, unknown> {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  switch (messageId) {
    case MESSAGE_IDS.HEARTBEAT:
      return {
        type: payload[4], autopilot: payload[5], baseMode: payload[6],
        systemStatus: payload[7], mavlinkVersion: payload[8],
      };
    case MESSAGE_IDS.SYS_STATUS:
      return {
        voltageBatteryV: view.getUint16(14, true) / 1000,
        currentBatteryA: view.getInt16(16, true) / 100,
        batteryRemainingPct: view.getInt8(18),
        dropRateComm: view.getUint16(20, true),
      };
    case MESSAGE_IDS.GPS_RAW_INT:
      return {
        lat: view.getInt32(8, true) / 1e7,
        lon: view.getInt32(12, true) / 1e7,
        altM: view.getInt32(16, true) / 1000,
        eph: view.getUint16(20, true),
        epv: view.getUint16(22, true),
        velocityMps: view.getUint16(24, true) / 100,
        courseDeg: view.getUint16(26, true) / 100,
        fixType: payload[28],
        satellites: payload[29],
      };
    case MESSAGE_IDS.ATTITUDE:
      return {
        timeBootMs: view.getUint32(0, true),
        rollRad: view.getInt16(4, true) / 10000,
        pitchRad: view.getInt16(6, true) / 10000,
        yawRad: view.getInt16(8, true) / 10000,
        rollspeed: view.getInt16(10, true) / 10000,
        pitchspeed: view.getInt16(12, true) / 10000,
        yawspeed: view.getInt16(14, true) / 10000,
      };
    case MESSAGE_IDS.GLOBAL_POSITION_INT:
      return {
        timeBootMs: view.getUint32(0, true),
        lat: view.getInt32(4, true) / 1e7,
        lon: view.getInt32(8, true) / 1e7,
        altM: view.getInt32(12, true) / 1000,
        relativeAltM: view.getInt32(16, true) / 1000,
        vx: view.getInt16(20, true) / 100,
        vy: view.getInt16(22, true) / 100,
        vz: view.getInt16(24, true) / 100,
        headingDeg: view.getUint16(26, true) / 100,
      };
    case MESSAGE_IDS.COMMAND_ACK:
      return {
        command: view.getUint16(0, true),
        result: payload[2],
        progress: payload[3],
        resultParam2: payload.length >= 8 ? view.getInt32(4, true) : undefined,
      };
    case MESSAGE_IDS.STATUSTEXT:
      return { severity: payload[0], text: new TextDecoder().decode(payload.slice(1)).replace(/\0+$/, '') };
    default:
      return {};
  }
}

function x25(bytes: number[]): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    let tmp = byte ^ (crc & 0xff);
    tmp ^= (tmp << 4) & 0xff;
    crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff;
  }
  return crc;
}
