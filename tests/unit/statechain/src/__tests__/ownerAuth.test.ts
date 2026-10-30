/**
 * AUD-026 — parity of the client's owner-auth message with the SE server.
 *
 * Both sides must produce the identical canonical string; this pins the format
 * (the SE-server `ownerAuth` test asserts the same value).
 */

import { seRequestMessage } from '../httpClient';

describe('HttpSEClient owner-auth message (AUD-026 parity)', () => {
  it('matches the SE server canonical format', () => {
    expect(seRequestMessage('sc_1', 'blind-sign', 'n1', { b: '2', a: '1' }))
      .toBe('totem:se-request:v1|sc_1|blind-sign|n1|a=1&b=2');
  });
});
