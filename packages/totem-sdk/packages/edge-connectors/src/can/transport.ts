export interface CanTransportPort {
  open(interfaceName: string): Promise<void>;
  close(): Promise<void>;
  send(id: number, data: Uint8Array, isExtended: boolean): Promise<void>;
  onFrame(handler: (frame: CanFrame) => void): () => void;
  onError(handler: (err: Error) => void): () => void;
}

export interface CanFrame {
  id: number;
  isExtended: boolean;
  isRtr: boolean;
  data: Uint8Array;
  dlc: number;
  receivedAt: number;
}

export interface CanSignal {
  name: string;
  value: number;
  unit?: string;
  raw: Uint8Array;
}
