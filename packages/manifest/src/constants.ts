export const MANIFEST_VERSION = 1 as const;

export const MANIFEST_TYPE_BYTE = {
  app: 0x01,
  capability: 0x02,
  dapp: 0x03,
  'edge-service': 0x04,
} as const satisfies Record<string, number>;

export const MANIFEST_BYTE_TO_TYPE: Record<number, string> = {
  0x01: 'app',
  0x02: 'capability',
  0x03: 'dapp',
  0x04: 'edge-service',
};
