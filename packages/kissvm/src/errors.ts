export class KissvmLimitError extends Error {
  readonly type = 'limit' as const;
  constructor(message: string) {
    super(message);
    this.name = 'KissvmLimitError';
  }
}

export class KissvmRuntimeError extends Error {
  readonly type = 'runtime' as const;
  constructor(message: string) {
    super(message);
    this.name = 'KissvmRuntimeError';
  }
}

export class ReturnSignal {
  constructor(public readonly value: unknown) {}
}
