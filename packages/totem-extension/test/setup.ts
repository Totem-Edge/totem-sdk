// Mock chrome API for testing
Object.assign(global, {
  chrome: {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined)
      }
    }
  },
  crypto: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      importKey: jest.fn(),
      deriveKey: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn()
    }
  },
  btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
  atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
  TextEncoder: class TextEncoder {
    encode(str: string): Uint8Array {
      return new Uint8Array(Buffer.from(str, 'utf-8'));
    }
  },
  TextDecoder: class TextDecoder {
    decode(arr: Uint8Array): string {
      return Buffer.from(arr).toString('utf-8');
    }
  }
});