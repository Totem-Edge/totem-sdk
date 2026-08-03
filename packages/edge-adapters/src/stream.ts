/**
 * EdgeStreamPort adapter — wraps @totemsdk/stream-transport's IStreamTransport
 * as a first-class EdgeStreamPort for EdgeRuntimePorts.stream.
 */

import type { EdgeStreamPort } from '@totemsdk/edge';
import type { IStreamTransport } from '@totemsdk/stream-transport';

export function createStreamPortAdapter(transport: IStreamTransport): EdgeStreamPort {
  return {
    async send(data: Uint8Array): Promise<void> {
      await transport.send(data);
    },
    onData(handler: (data: Uint8Array) => void): () => void {
      return transport.onData(handler);
    },
    onClose(handler: () => void): () => void {
      return transport.onClose(handler);
    },
    onError(handler: (err: Error) => void): () => void {
      return transport.onError(handler);
    },
    close(): void {
      void transport.close();
    },
  };
}
