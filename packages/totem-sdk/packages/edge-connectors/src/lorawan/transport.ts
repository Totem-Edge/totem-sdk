export interface LorawanTransportPort {
  joinOtaa(devEui: string, appEui: string, appKey: string): Promise<void>;
  activateAbp(devAddr: string, nwkSKey: string, appSKey: string): Promise<void>;
  sendConfirmed(port: number, data: Uint8Array): Promise<void>;
  sendUnconfirmed(port: number, data: Uint8Array): Promise<void>;
  onDownlink(handler: (message: LorawanMessage) => void): () => void;
  onJoin(handler: (devAddr: string) => void): () => void;
  onError(handler: (err: Error) => void): () => void;
}

export interface LorawanMessage {
  port: number;
  payload: Uint8Array;
  confirmed: boolean;
  frameCounter: number;
  snr: number;
  rssi: number;
  receivedAt: number;
}
