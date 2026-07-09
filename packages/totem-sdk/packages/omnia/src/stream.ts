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

  constructor(private readonly _stream: IStreamTransport) {
    _stream.on('data', (chunk: Uint8Array) => {
      let msgs: ReturnType<typeof this._parser.push>;
      try {
        msgs = this._parser.push(chunk);
      } catch (err) {
        this._stream.close();
        return;
      }
      for (const msg of msgs) {
        for (const cb of this._listeners) {
          try { cb(msg); } catch { /* listener errors must not crash the stream */ }
        }
      }
    });
  }

  send(msg: OmniaMessage): void {
    this._stream.send(encodeOmniaMessage(msg));
  }

  onMessage(cb: (msg: OmniaMessage) => void): Unsubscribe {
    this._listeners.push(cb);
    return () => { this._listeners = this._listeners.filter(l => l !== cb); };
  }

  onClose(cb: () => void): void {
    this._stream.on('close', cb);
  }

  onError(cb: (err: Error) => void): void {
    this._stream.on('error', cb);
  }

  reset(): void {
    this._parser.reset();
    this._listeners = [];
  }

  destroy(): void {
    try { this._stream.close(); } catch { /* noop */ }
  }
}
