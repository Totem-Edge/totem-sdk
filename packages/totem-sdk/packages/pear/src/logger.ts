/**
 * @totemsdk/pear — Logger
 *
 * `createLogger(name)` returns a simple logger that routes output to:
 *   - Pear's built-in debug channel (`globalThis.Pear.debug`) when running
 *     inside a Pear app
 *   - `globalThis.console` (stderr on Node.js/Bare) otherwise
 *
 * Bare-compatible: no `process.env`, no `__dirname`, no `require`.
 */

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function _write(level: LogLevel, prefix: string, message: string, args: unknown[]): void {
  const tag = `[${prefix}]`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pear = (globalThis as any).Pear as
    | { debug?: (...a: unknown[]) => void }
    | undefined;

  if (pear?.debug && (level === 'debug' || level === 'info')) {
    pear.debug(tag, message, ...args);
    return;
  }

  const consoleFn =
    level === 'error'
      ? globalThis.console?.error
      : level === 'warn'
        ? globalThis.console?.warn
        : level === 'debug'
          ? globalThis.console?.debug ?? globalThis.console?.log
          : globalThis.console?.log;

  consoleFn?.call(globalThis.console, tag, message, ...args);
}

/**
 * Create a named logger scoped to a component.
 *
 * @param name — Component name shown in every log line, e.g. 'BareKVStore'
 */
export function createLogger(name: string): Logger {
  return {
    info: (msg, ...args) => _write('info', name, msg, args),
    warn: (msg, ...args) => _write('warn', name, msg, args),
    error: (msg, ...args) => _write('error', name, msg, args),
    debug: (msg, ...args) => _write('debug', name, msg, args),
  };
}
