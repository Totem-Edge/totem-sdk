/**
 * gRPC transport port — injected by the caller.
 *
 * Uses @totemsdk/stream-transport's IStreamTransport for the underlying
 * bidirectional byte pipe. gRPC framing (HTTP/2 + protobuf) is handled
 * by the caller's codec layer.
 */

import type { IStreamTransport } from '@totemsdk/stream-transport';

export type GrpcTransportPort = IStreamTransport;

export interface GrpcMessage {
  /** Fully qualified service/method name (e.g. "/package.Service/Method"). */
  path: string;
  /** Serialized protobuf payload. */
  payload: Uint8Array;
  /** Whether this is a response to a previous request. */
  isResponse: boolean;
  /** Correlation ID for request/response matching. */
  requestId?: string;
  /** Timestamp of receipt. */
  receivedAt: number;
}
