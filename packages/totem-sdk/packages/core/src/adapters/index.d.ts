/**
 * @module @totemsdk/core/adapters
 * Platform-agnostic adapter interfaces for SDK portability
 *
 * These interfaces enable the SDK to work across multiple platforms:
 * - Browser (Chrome Extensions, web apps)
 * - Node.js (server-side, CLI tools)
 * - React Native (mobile apps) - follow-up
 *
 * Each platform provides its own implementation of these adapters.
 */
export interface StorageAdapter {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<boolean>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
    has(key: string): Promise<boolean>;
}
export interface AuthTokenProvider {
    getToken(): Promise<string | null>;
    setToken(token: string): Promise<void>;
    clearToken(): Promise<void>;
    onTokenChange(callback: (token: string | null) => void): () => void;
    isAuthenticated(): Promise<boolean>;
}
export type BinaryData = Uint8Array | ArrayBuffer;
export interface WebSocketFactoryOptions {
    pingIntervalMs?: number;
    pongTimeoutMs?: number;
    maxPayloadBytes?: number;
}
export interface WebSocketOpenEvent {
    type: 'open';
}
export interface WebSocketCloseEvent {
    type: 'close';
    code: number;
    reason: string;
    wasClean: boolean;
}
export interface WebSocketMessageEvent {
    type: 'message';
    data: string | BinaryData;
}
export interface WebSocketErrorEvent {
    type: 'error';
    message?: string;
    error?: Error;
}
export type WebSocketEventMap = {
    open: WebSocketOpenEvent;
    close: WebSocketCloseEvent;
    message: WebSocketMessageEvent;
    error: WebSocketErrorEvent;
};
export interface WebSocketFactory {
    create(url: string, protocols?: string[], options?: WebSocketFactoryOptions): WebSocketClient;
    dispose(): void;
}
export interface WebSocketClient {
    readonly readyState: number;
    readonly url: string;
    send(data: string | BinaryData): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    addEventListener<K extends keyof WebSocketEventMap>(event: K, listener: (ev: WebSocketEventMap[K]) => void): void;
    removeEventListener<K extends keyof WebSocketEventMap>(event: K, listener: (ev: WebSocketEventMap[K]) => void): void;
    removeAllListeners(): void;
    onopen: ((ev: WebSocketOpenEvent) => void) | null;
    onclose: ((ev: WebSocketCloseEvent) => void) | null;
    onmessage: ((ev: WebSocketMessageEvent) => void) | null;
    onerror: ((ev: WebSocketErrorEvent) => void) | null;
}
export declare const WebSocketReadyState: {
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
};
export interface CancellationToken {
    readonly cancelled: boolean;
    onCancel(callback: () => void): () => void;
}
export interface CancellationTokenSource {
    readonly token: CancellationToken;
    cancel(): void;
}
export declare function createCancellationToken(): CancellationTokenSource;
export interface HttpClient {
    get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
    post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
    put<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
    delete<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}
export interface HttpRequestOptions {
    headers?: Record<string, string>;
    timeout?: number;
    cancellationToken?: CancellationToken;
}
export interface HttpResponse<T> {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: T;
}
export interface ConfigProvider {
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    set<T>(key: string, value: T): void;
    has(key: string): boolean;
    getAll(): Record<string, unknown>;
    readonly apiUrl: string;
    readonly wsUrl: string;
    readonly network: 'mainnet' | 'testnet' | 'devnet';
    readonly apiKey?: string;
}
export interface LoggerAdapter {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}
export interface MetricsAdapter {
    increment(name: string, value?: number, tags?: Record<string, string>): void;
    gauge(name: string, value: number, tags?: Record<string, string>): void;
    timing(name: string, durationMs: number, tags?: Record<string, string>): void;
    histogram(name: string, value: number, tags?: Record<string, string>): void;
}
export interface TimerAdapter {
    setTimeout(callback: () => void, ms: number): TimerHandle;
    setInterval(callback: () => void, ms: number): TimerHandle;
    clearTimeout(handle: TimerHandle): void;
    clearInterval(handle: TimerHandle): void;
    now(): number;
}
export type TimerHandle = ReturnType<typeof setTimeout>;
export interface CryptoAdapter {
    randomBytes(length: number): Uint8Array;
    sha256(data: Uint8Array): Uint8Array;
    sha256Async(data: Uint8Array): Promise<Uint8Array>;
}
export interface AdapterRegistry {
    storage: StorageAdapter;
    auth: AuthTokenProvider;
    websocket: WebSocketFactory;
    http: HttpClient;
    config: ConfigProvider;
    logger: LoggerAdapter;
    metrics?: MetricsAdapter;
    timer: TimerAdapter;
    crypto: CryptoAdapter;
}
export declare function createAdapterRegistry(adapters: Partial<AdapterRegistry>): AdapterRegistry;
export declare class NoopLogger implements LoggerAdapter {
    debug(_message: string, ..._args: unknown[]): void;
    info(_message: string, ..._args: unknown[]): void;
    warn(_message: string, ..._args: unknown[]): void;
    error(_message: string, ..._args: unknown[]): void;
}
export declare class ConsoleLogger implements LoggerAdapter {
    private prefix;
    constructor(prefix?: string);
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}
export declare class NoopMetrics implements MetricsAdapter {
    increment(_name: string, _value?: number, _tags?: Record<string, string>): void;
    gauge(_name: string, _value: number, _tags?: Record<string, string>): void;
    timing(_name: string, _durationMs: number, _tags?: Record<string, string>): void;
    histogram(_name: string, _value: number, _tags?: Record<string, string>): void;
}
export declare class DefaultTimerAdapter implements TimerAdapter {
    setTimeout(callback: () => void, ms: number): TimerHandle;
    setInterval(callback: () => void, ms: number): TimerHandle;
    clearTimeout(handle: TimerHandle): void;
    clearInterval(handle: TimerHandle): void;
    now(): number;
}
export interface LifecycleAdapter {
    onSuspend(callback: () => void): () => void;
    onResume?(callback: () => void): () => void;
}
export declare class NoopLifecycleAdapter implements LifecycleAdapter {
    onSuspend(_callback: () => void): () => void;
    onResume(_callback: () => void): () => void;
}
