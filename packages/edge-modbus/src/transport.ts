/**
 * Modbus transport port — injected by the caller.
 *
 * Supports Modbus TCP (port 502) and Modbus RTU (serial).
 * The caller provides the actual socket/serial implementation.
 */

export interface ModbusTransportPort {
  /** Open the connection. */
  connect(): Promise<void>;
  /** Close the connection. */
  disconnect(): Promise<void>;
  /** Send a raw Modbus frame and receive the response. */
  sendFrame(frame: Uint8Array): Promise<Uint8Array>;
  /** Register a handler for unsolicited/inbound frames. */
  onFrame(handler: (frame: Uint8Array) => void): () => void;
  /** Register a handler for connection errors. */
  onError(handler: (err: Error) => void): () => void;
}

export interface ModbusMessage {
  /** Unit/slave ID (1-247). */
  unitId: number;
  /** Modbus function code (1-6, 15, 16). */
  functionCode: number;
  /** Starting address (0-based). */
  address: number;
  /** Register/coil count or value. */
  value: number | number[];
  /** Raw frame bytes. */
  raw: Uint8Array;
  /** Timestamp of receipt. */
  receivedAt: number;
}
