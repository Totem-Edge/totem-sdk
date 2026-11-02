import {
  decodeFrames, decodeMessage, encodeCommandLong, encodeFrame, encodeHeartbeat,
  MESSAGE_IDS, MavlinkProtocolError,
} from '../codec.js';

function gpsPayload(lat: number, lon: number, altM: number, satellites: number): Uint8Array {
  const payload = new Uint8Array(30);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 1000, true);
  view.setInt32(8, Math.round(lat * 1e7), true);
  view.setInt32(12, Math.round(lon * 1e7), true);
  view.setInt32(16, Math.round(altM * 1000), true);
  view.setUint16(20, 80, true);
  view.setUint16(22, 120, true);
  view.setUint16(24, 1500, true);
  view.setUint16(26, 9000, true);
  payload[28] = 3;
  payload[29] = satellites;
  return payload;
}

describe('MAVLink codec', () => {
  it('round-trips a heartbeat frame with a valid CRC', () => {
    const frame = encodeHeartbeat(1, 1, 0);
    const decoded = decodeFrames(frame);
    expect(decoded.rest.length).toBe(0);
    expect(decoded.frames).toHaveLength(1);
    expect(decoded.frames[0]).toMatchObject({ version: 2, systemId: 1, componentId: 1, messageId: 0 });
    const message = decodeMessage(decoded.frames[0]);
    expect(message.name).toBe('HEARTBEAT');
    expect(message.decoded.systemStatus).toBe(4);
  });

  it('decodes concatenated frames and drops corrupt frames', () => {
    const gps = encodeFrame(2, 1, 1, 1, MESSAGE_IDS.GPS_RAW_INT, gpsPayload(48.1173, 11.5167, 545.4, 9));
    const attitudePayload = new Uint8Array(16);
    new DataView(attitudePayload.buffer).setInt16(4, 1234, true);
    new DataView(attitudePayload.buffer).setInt16(6, -2345, true);
    const attitude = encodeFrame(2, 2, 1, 1, MESSAGE_IDS.ATTITUDE, attitudePayload);
    const combined = Uint8Array.from([...gps, ...attitude]);
    const decoded = decodeFrames(combined);
    expect(decoded.frames.map((frame) => frame.messageId)).toEqual([MESSAGE_IDS.GPS_RAW_INT, MESSAGE_IDS.ATTITUDE]);
    const message = decodeMessage(decoded.frames[0]);
    expect(message.decoded.lat).toBeCloseTo(48.1173, 4);
    expect(message.decoded.lon).toBeCloseTo(11.5167, 4);
    expect(message.decoded.altM).toBeCloseTo(545.4, 3);
    expect(message.decoded.satellites).toBe(9);
    expect(decodeMessage(decoded.frames[1]).decoded.rollRad).toBeCloseTo(0.1234, 4);

    const corrupt = Uint8Array.from(gps);
    corrupt[10] ^= 0xff;
    expect(decodeFrames(Uint8Array.from([...corrupt, ...attitude])).frames.map((frame) => frame.messageId)).toEqual([MESSAGE_IDS.ATTITUDE]);
  });

  it('keeps incomplete frames as the remaining buffer', () => {
    const frame = encodeHeartbeat(1, 1, 0);
    const decoded = decodeFrames(frame.slice(0, frame.length - 2));
    expect(decoded.frames).toHaveLength(0);
    expect(decoded.rest.length).toBe(frame.length - 2);
  });

  it('rejects unknown message ids and oversized payloads on encode', () => {
    expect(() => encodeFrame(2, 0, 1, 1, 999999, new Uint8Array(1))).toThrow(MavlinkProtocolError);
    expect(() => encodeFrame(2, 0, 1, 1, MESSAGE_IDS.HEARTBEAT, new Uint8Array(256))).toThrow(MavlinkProtocolError);
  });

  it('encodes COMMAND_LONG with target and parameters', () => {
    const frame = encodeCommandLong(0, 1, 1, 42, 1, 400, [1, 2], 0);
    const message = decodeMessage(decodeFrames(frame).frames[0]);
    expect(message.name).toBe('COMMAND_LONG');
    expect(message.decoded).toEqual({});
  });
});
