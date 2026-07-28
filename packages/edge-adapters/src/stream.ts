/**
 * EdgeStreamPort adapter — wraps @totemsdk/stream-transport's IStreamTransport
 * as a first-class EdgeStreamPort for EdgeRuntimePorts.stream.
 */

import type { EdgeStreamPort } from '@totemsdk/edge';
import type { IStreamTransport } from '@totemsdk/stream-transport';

export function createStreamPortAdapter(transport: IStreamTransport): EdgeStreamPort {
  return {
    send(data: Uint8Array): void {
      transport.send(data);
    },
    onData(handler: (data: Uint8Array) => void): () => void {
      transport.on('data', handler);
      return () => {};
    },
    onClose(handler: () => void): () => void {
      transport.on('close', handler);
      return () => {};
    },
    onError(handler: (err: Error) => void): () => void {
      transport.on('error', handler);
      return () => {};
    },
    close(): void {
      transport.close();
    },
  };
}
