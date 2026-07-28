/**
 * LoRaWAN transport port — injected by the caller.
 *
 * Supports OTAA (Over-The-Air Activation) and ABP (Activation By
 * Personalization). The caller provides the radio or network server.
 */

export interface LorawanTransportPort {
  /** Join the network via OTAA. */
  joinOtaa(devEui: string, appEui: string, appKey: string): Promise<void>;
  /** Activate via ABP with pre-provisioned keys. */
  activateAbp(devAddr: string, nwkSKey: string, appSKey: string): Promise<void>;
  /** Send a confirmed uplink (requires ACK). */
  sendConfirmed(port: number, data: Uint8Array): Promise<void>;
  /** Send an unconfirmed uplink (no ACK). */
  sendUnconfirmed(port: number, data: Uint8Array): Promise<void>;
  /** Register handler for downlink messages. */
  onDownlink(handler: (message: LorawanMessage) => void): () => void;
  /** Register handler for join/activation events. */
  onJoin(handler: (devAddr: string) => void): () => void;
  /** Register handler for errors. */
  onError(handler: (err: Error) => void): () => void;
}

export interface LorawanMessage {
  /** Application port (1-223). */
  port: number;
  /** Payload bytes. */
  payload: Uint8Array;
  /** Whether this was a confirmed message. */
  confirmed: boolean;
  /** Frame counter. */
  frameCounter: number;
  /** Signal-to-noise ratio in dB. */
  snr: number;
  /** Received signal strength in dBm. */
  rssi: number;
  /** Timestamp of receipt. */
  receivedAt: number;
}
