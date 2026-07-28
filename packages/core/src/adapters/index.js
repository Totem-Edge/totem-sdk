"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopLifecycleAdapter = exports.DefaultTimerAdapter = exports.NoopMetrics = exports.ConsoleLogger = exports.NoopLogger = exports.WebSocketReadyState = void 0;
exports.createCancellationToken = createCancellationToken;
exports.createAdapterRegistry = createAdapterRegistry;
exports.WebSocketReadyState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
};
function createCancellationToken() {
    let cancelled = false;
    const callbacks = new Set();
    const token = {
        get cancelled() { return cancelled; },
        onCancel(callback) {
            if (cancelled) {
                callback();
                return () => { };
            }
            callbacks.add(callback);
            return () => callbacks.delete(callback);
        }
    };
    return {
        token,
        cancel() {
            if (!cancelled) {
                cancelled = true;
                callbacks.forEach(cb => cb());
                callbacks.clear();
            }
        }
    };
}
function createAdapterRegistry(adapters) {
    const required = [
        'storage', 'auth', 'websocket', 'http', 'config', 'logger', 'timer', 'crypto'
    ];
    for (const key of required) {
        if (!adapters[key]) {
            throw new Error(`Missing required adapter: ${key}`);
        }
    }
    return adapters;
}
class NoopLogger {
    debug(_message, ..._args) { }
    info(_message, ..._args) { }
    warn(_message, ..._args) { }
    error(_message, ..._args) { }
}
exports.NoopLogger = NoopLogger;
class ConsoleLogger {
    constructor(prefix = '[SDK]') {
        this.prefix = prefix;
    }
    debug(message, ...args) {
        console.debug(`${this.prefix} ${message}`, ...args);
    }
    info(message, ...args) {
        console.info(`${this.prefix} ${message}`, ...args);
    }
    warn(message, ...args) {
        console.warn(`${this.prefix} ${message}`, ...args);
    }
    error(message, ...args) {
        console.error(`${this.prefix} ${message}`, ...args);
    }
}
exports.ConsoleLogger = ConsoleLogger;
class NoopMetrics {
    increment(_name, _value, _tags) { }
    gauge(_name, _value, _tags) { }
    timing(_name, _durationMs, _tags) { }
    histogram(_name, _value, _tags) { }
}
exports.NoopMetrics = NoopMetrics;
class DefaultTimerAdapter {
    setTimeout(callback, ms) {
        return setTimeout(callback, ms);
    }
    setInterval(callback, ms) {
        return setInterval(callback, ms);
    }
    clearTimeout(handle) {
        clearTimeout(handle);
    }
    clearInterval(handle) {
        clearInterval(handle);
    }
    now() {
        return Date.now();
    }
}
exports.DefaultTimerAdapter = DefaultTimerAdapter;
class NoopLifecycleAdapter {
    onSuspend(_callback) {
        return () => { };
    }
    onResume(_callback) {
        return () => { };
    }
}
exports.NoopLifecycleAdapter = NoopLifecycleAdapter;
