/**
 * CAN bus transport port — injected by the caller.
 *
 * Supports socketcan (Linux), PCAN, or any CAN interface.
 * Frames use 11-bit or 29-bit arbitration IDs.
 */

export interface CanTransportPort {
  /** Open the CAN interface. */
  open(interfaceName: string): Promise<void>;
  /** Close the CAN interface. */
  close(): Promise<void>;
  /** Send a CAN frame. */
  send(id: number, data: Uint8Array, isExtended: boolean): Promise<void>;
  /** Register a handler for received CAN frames. */
  onFrame(handler: (frame: CanFrame) => void): () => void;
  /** Register a handler for interface errors. */
  onError(handler: (err: Error) => void): () => void;
}

export interface CanFrame {
  /** 11-bit or 29-bit arbitration ID. */
  id: number;
  /** Whether this is an extended (29-bit) frame. */
  isExtended: boolean;
  /** Whether this is a remote transmission request. */
  isRtr: boolean;
  /** Data bytes (0-8). */
  data: Uint8Array;
  /** Data length code. */
  dlc: number;
  /** Timestamp of receipt. */
  receivedAt: number;
}

export interface CanSignal {
  /** Signal name from DBC file. */
  name: string;
  /** Decoded value. */
  value: number;
  /** Unit string (e.g. "rpm", "°C"). */
  unit?: string;
  /** Raw bytes. */
  raw: Uint8Array;
}
