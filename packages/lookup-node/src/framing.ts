/**
 * FrameParser for the lookup protocol (server-side).
 * Identical logic to the one in @totemsdk/lookup-client.
 * Uses peekFrameLength + decodeMessage from @totemsdk/lookup-protocol.
 */

import { decodeMessage, peekFrameLength } from '@totemsdk/lookup-protocol';
import type { LookupMessage } from '@totemsdk/lookup-protocol';

export class FrameParser {
  private _buf = new Uint8Array(0);

  push(chunk: Uint8Array): LookupMessage[] {
    const combined = new Uint8Array(this._buf.length + chunk.length);
    combined.set(this._buf);
    combined.set(chunk, this._buf.length);
    this._buf = combined;

    const messages: LookupMessage[] = [];
    while (this._buf.length >= 4) {
      const bodyLen = peekFrameLength(this._buf);
      if (bodyLen === null || this._buf.length < 4 + bodyLen) break;
      messages.push(decodeMessage(this._buf.slice(0, 4 + bodyLen)));
      this._buf = this._buf.slice(4 + bodyLen);
    }
    return messages;
  }

  reset(): void {
    this._buf = new Uint8Array(0);
  }
}
