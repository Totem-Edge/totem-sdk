import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { CanTransportPort, CanFrame, CanSignal } from './transport.js';

export interface CanGatewayConfig {
  runtime: EdgeRuntime;
  transport: CanTransportPort;
  interfaceName: string;
  signals?: CanSignalDef[];
}

export interface CanSignalDef {
  name: string;
  canId: number;
  isExtended: boolean;
  startBit: number;
  length: number;
  isSigned: boolean;
  isBigEndian: boolean;
  scale: number;
  offset: number;
  unit?: string;
}

export interface CanGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  send(id: number, data: Uint8Array, isExtended?: boolean): Promise<void>;
}

function extractBits(data: Uint8Array, startBit: number, length: number, bigEndian: boolean): number {
  let result = 0n;
  for (let i = 0; i < length; i++) {
    const bitIdx = bigEndian
      ? (startBit / 8 | 0) * 8 + 7 - (startBit % 8) - (i / 8 | 0) * 8 + (i % 8)
      : startBit + i;
    const byteIdx = (bitIdx / 8) | 0;
    const bitInByte = bitIdx % 8;
    if (byteIdx < data.length && ((data[byteIdx] >> bitInByte) & 1)) {
      result |= (1n << BigInt(i));
    }
  }
  return Number(result);
}

function signExtend(value: number, bits: number): number {
  const mask = 1 << (bits - 1);
  return (value ^ mask) - mask;
}

export function createCanGateway(config: CanGatewayConfig): CanGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let unsubFrame: (() => void) | undefined;
  let unsubError: (() => void) | undefined;

  function decodeSignals(frame: CanFrame): CanSignal[] {
    if (!config.signals) return [];
    return config.signals
      .filter(s => s.canId === frame.id && s.isExtended === frame.isExtended)
      .map(s => {
        const raw = extractBits(frame.data, s.startBit, s.length, s.isBigEndian);
        let value = s.isSigned ? signExtend(raw, s.length) : raw;
        value = value * s.scale + s.offset;
        return { name: s.name, value, unit: s.unit, raw: frame.data };
      });
  }

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.open(config.interfaceName);
      unsubFrame = config.transport.onFrame((frame) => {
        const signals = decodeSignals(frame);
        if (signals.length > 0 && config.runtime.ports.proof) {
          config.runtime.ports.proof.createProof({
            subject: `can:${config.interfaceName}`,
            claims: [{ canId: frame.id, signals, timestamp: frame.receivedAt }],
          }).catch(() => {});
        }
      });
      unsubError = config.transport.onError(() => { status = 'error'; });
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubFrame?.(); unsubError?.();
      await config.transport.close();
      status = 'stopped';
    },

    async send(id, data, isExtended = false): Promise<void> {
      await config.transport.send(id, data, isExtended);
    },
  };
}
