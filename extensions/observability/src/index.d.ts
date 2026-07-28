export interface InitOptions {
  dappId: string;
  endpoint?: string;
  hmacSecret?: string;
  sampleRate?: { ok?: number; error?: number };
  optOut?: boolean;
  axiaHosts?: RegExp[];
  clientVersion?: string;
}

export interface ObsEvent {
  kind: string;
  outcome?: 'ok' | 'error';
  latency_ms?: number;
  error_class?: string;
  region?: string;
  trace_id?: string;
  force?: boolean;
}

export function init(opts: InitOptions): void;
export function track(event: ObsEvent): void;
export function flush(): Promise<void>;
export function shutdown(): void;
export function fetchWithTrace(input: RequestInfo, init?: RequestInit): Promise<Response>;
export function makeTraceparent(): string;
export function wrapTotemProvider<T extends { request: (...a: any[]) => any }>(provider: T): T;
export function attachProvider<T extends { request: (...a: any[]) => any }>(provider: T): T;

declare const _default: {
  init: typeof init;
  track: typeof track;
  flush: typeof flush;
  shutdown: typeof shutdown;
  fetchWithTrace: typeof fetchWithTrace;
  makeTraceparent: typeof makeTraceparent;
  wrapTotemProvider: typeof wrapTotemProvider;
  attachProvider: typeof attachProvider;
};
export default _default;
