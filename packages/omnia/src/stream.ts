/**
 * OmniaStream — typed message layer over an IStreamTransport.
 *
 * Wraps an IStreamTransport with OmniaFrameParser so consumers receive typed
 * OmniaMessage objects rather than raw bytes.
 */

import { OmniaFrameParser, encodeOmniaMessage } from './framing.js';
import type { IStreamTransport } from '@totemsdk/stream-transport';
import type { OmniaMessage, Unsubscribe } from './messaging-types.js';

export class OmniaStream {
  private readonly _parser = new OmniaFrameParser();
  private _listeners: ((msg: OmniaMessage) => void)[] = [];
  private readonly _unsubData: () => void;

  constructor(private readonly _stream: IStreamTransport) {
    this._unsubData = _stream.onData((chunk: Uint8Array) => {
      if (process.env.OMNIA_DEBUG) console.error('[omnia-stream] recv bytes', chunk.length);
      let msgs: ReturnType<typeof this._parser.push>;
      try {
        msgs = this._parser.push(chunk);
      } catch (err) {
        if (process.env.OMNIA_DEBUG) console.error('[omnia-stream] frame error', err);
        void this._stream.close();
        return;
      }
      if (process.env.OMNIA_DEBUG) {
        for (const msg of msgs) console.error('[omnia-stream] recv', msg.type);
      }
      for (const msg of msgs) {
        for (const cb of this._listeners) {
          try { cb(msg); } catch { /* listener errors must not crash the stream */ }
        }
      }
    });
  }

  async send(msg: OmniaMessage): Promise<void> {
    const bytes = encodeOmniaMessage(msg);
    if (process.env.OMNIA_DEBUG) {
      console.error('[omnia-stream] send', msg.type, 'bytes', bytes.length, 'state', this._stream.state);
    }
    await this._stream.send(bytes);
  }

  onMessage(cb: (msg: OmniaMessage) => void): Unsubscribe {
    this._listeners.push(cb);
    return () => { this._listeners = this._listeners.filter(l => l !== cb); };
  }

  onClose(cb: () => void): Unsubscribe {
    return this._stream.onClose(cb);
  }

  onError(cb: (err: Error) => void): Unsubscribe {
    return this._stream.onError(cb);
  }

  reset(): void {
    this._parser.reset();
    this._listeners = [];
  }

  /**
   * Stop delivering data to listeners and drop them, without closing the
   * underlying transport. Used when a peer rebinds to a newer connection: the
   * superseded socket stays owned by hyperswarm (which destroys the loser),
   * but must not keep feeding frames to the peer.
   */
  detach(): void {
    this._unsubData();
    this._listeners = [];
  }

  destroy(): void {
    this.detach();
    void this._stream.close();
  }
}
