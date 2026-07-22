export interface ModbusTransportPort {
  connect(host: string, port: number, options?: { timeout?: number }): Promise<void>;
  disconnect(): Promise<void>;
  readCoils(unitId: number, address: number, quantity: number): Promise<boolean[]>;
  readDiscreteInputs(unitId: number, address: number, quantity: number): Promise<boolean[]>;
  readHoldingRegisters(unitId: number, address: number, quantity: number): Promise<Uint16Array>;
  readInputRegisters(unitId: number, address: number, quantity: number): Promise<Uint16Array>;
  writeSingleCoil(unitId: number, address: number, value: boolean): Promise<void>;
  writeSingleRegister(unitId: number, address: number, value: number): Promise<void>;
  onError(handler: (err: Error) => void): () => void;
}

export interface ModbusFrame {
  unitId: number;
  functionCode: number;
  address: number;
  data: Uint8Array;
  receivedAt: number;
}

export interface ModbusRegister {
  address: number;
  value: number;
  unit?: string;
}
