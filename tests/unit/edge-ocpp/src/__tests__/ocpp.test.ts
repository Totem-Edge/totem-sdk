import {
  encodeCall, encodeCallError, encodeCallResult, OcppError, OcppProtocolError, parseOcppFrame,
} from '../ocpp.js';

describe('OCPP-J framing', () => {
  it('round-trips CALL, CALLRESULT and CALLERROR', () => {
    expect(parseOcppFrame(encodeCall('m1', 'BootNotification', { chargePointVendor: 'Totem' }))).toEqual({
      type: 2, messageId: 'm1', action: 'BootNotification', payload: { chargePointVendor: 'Totem' },
    });
    expect(parseOcppFrame(encodeCallResult('m1', { status: 'Accepted' }))).toEqual({
      type: 3, messageId: 'm1', payload: { status: 'Accepted' },
    });
    expect(parseOcppFrame(encodeCallError('m1', 'NotSupported', 'no handler', { action: 'X' }))).toEqual({
      type: 4, messageId: 'm1', errorCode: 'NotSupported', errorDescription: 'no handler', errorDetails: { action: 'X' },
    });
  });

  it('rejects malformed frames', () => {
    for (const raw of [
      'not json',
      '{}',
      '[]',
      '[2]',
      '[2,"id","Action"]',
      '[2,"","Action",{}]',
      '[2,"id","",{}]',
      '[2,"id","Action",[]]',
      '[3,"id",[]]',
      '[4,"id","Bogus","desc",{}]',
      '[4,"id","NotSupported"]',
      '[5,"id",{}]',
    ]) {
      expect(() => parseOcppFrame(raw)).toThrow(OcppProtocolError);
    }
  });

  it('exposes OCPP errors with code and details', () => {
    const error = new OcppError('SecurityError', 'rejected', { reason: 'auth' });
    expect(error.code).toBe('SecurityError');
    expect(error.details).toEqual({ reason: 'auth' });
  });
});
