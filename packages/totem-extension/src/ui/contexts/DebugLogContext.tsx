/**
 * TOTEM DESIGNER DEBUG LOG CONTEXT
 * Centralized logging system for Designer mode only
 * Captures console logs, Chrome API calls, and network events
 * 
 * PRODUCTION SAFETY: This file conditionally loads dev code to avoid bundling it in production.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// PRODUCTION SAFETY: Conditionally load broadcast channel helpers
// In production, these will be no-op functions to avoid bundling dev code
let broadcastLog: ((entry: any) => void) | null = null;
let broadcastHeartbeat: (() => void) | null = null;
let closeDebugChannel: (() => void) | null = null;


export type LogLevel = 'log' | 'warn' | 'error' | 'info';
export type LogSource = 'console' | 'chrome-api' | 'network' | 'component' | 'mock-chrome';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  tag?: string;
  message: string;
  data?: any;
}

export interface LogFilters {
  level: LogLevel | 'all';
  tag: string;
  search: string;
}

export interface DebugLogContextValue {
  logs: LogEntry[];
  filters: LogFilters;
  pushLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setFilters: (filters: Partial<LogFilters>) => void;
  getFilteredLogs: () => LogEntry[];
}

const DebugLogContext = createContext<DebugLogContextValue | null>(null);

const MAX_LOGS = 1000;

function safeStringify(obj: any, maxDepth: number = 3): string {
  const seen = new WeakSet();
  
  const replacer = (depth: number) => (key: string, value: any) => {
    if (depth > maxDepth) {
      return '[Max Depth Reached]';
    }
    
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }
    
    return value;
  };
  
  try {
    return JSON.stringify(obj, replacer(0), 2);
  } catch (err) {
    return String(obj);
  }
}

export function DebugLogProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filters, setFiltersState] = useState<LogFilters>({
    level: 'all',
    tag: '',
    search: ''
  });
  const logIdCounter = useRef(0);
  const originalConsole = useRef<{
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
  } | null>(null);
  const isInterceptingRef = useRef(false);

  const pushLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newEntry: LogEntry = {
      ...entry,
      id: `log-${logIdCounter.current++}`,
      timestamp: Date.now(),
    };

    setLogs(prevLogs => {
      const updated = [...prevLogs, newEntry];
      if (updated.length > MAX_LOGS) {
        return updated.slice(updated.length - MAX_LOGS);
      }
      return updated;
    });

    // Broadcast to debug viewer window via BroadcastChannel (dev only)
    if (broadcastLog) {
      try {
        broadcastLog(newEntry);
      } catch (error) {
        // Silently fail if BroadcastChannel not supported
      }
    }
  }, []);

  // Set up heartbeat for debug viewer connection status (dev only)
  useEffect(() => {
    if (!broadcastHeartbeat || !closeDebugChannel) return;

    const heartbeatInterval = setInterval(() => {
      if (broadcastHeartbeat) {
        try {
          broadcastHeartbeat();
        } catch (error) {
          // Silently fail if BroadcastChannel not supported
        }
      }
    }, 2000);

    return () => {
      clearInterval(heartbeatInterval);
      if (closeDebugChannel) {
        closeDebugChannel();
      }
    };
  }, []);

  // Intercept console methods on mount
  useEffect(() => {
    // Guard against double-wrapping
    if (isInterceptingRef.current) return;
    isInterceptingRef.current = true;

    // Store original methods
    originalConsole.current = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
    };

    // Extract tag from message if it follows pattern [TagName]
    const extractTag = (args: any[]): { tag?: string; cleanArgs: any[] } => {
      if (args.length === 0) return { cleanArgs: args };
      
      const firstArg = String(args[0]);
      const tagMatch = firstArg.match(/^\[([^\]]+)\]/);
      
      if (tagMatch) {
        return {
          tag: tagMatch[0],
          cleanArgs: [firstArg.replace(/^\[([^\]]+)\]\s*/, ''), ...args.slice(1)]
        };
      }
      
      return { cleanArgs: args };
    };

    // Wrap console.log
    console.log = function(...args: any[]) {
      const { tag, cleanArgs } = extractTag(args);
      pushLog({
        level: 'log',
        source: 'console',
        tag,
        message: cleanArgs.map(arg => 
          typeof arg === 'object' ? safeStringify(arg, 2) : String(arg)
        ).join(' '),
        data: cleanArgs.length > 1 || typeof cleanArgs[0] === 'object' ? cleanArgs : undefined
      });
      originalConsole.current!.log(...args);
    };

    // Wrap console.warn
    console.warn = function(...args: any[]) {
      const { tag, cleanArgs } = extractTag(args);
      pushLog({
        level: 'warn',
        source: 'console',
        tag,
        message: cleanArgs.map(arg => 
          typeof arg === 'object' ? safeStringify(arg, 2) : String(arg)
        ).join(' '),
        data: cleanArgs.length > 1 || typeof cleanArgs[0] === 'object' ? cleanArgs : undefined
      });
      originalConsole.current!.warn(...args);
    };

    // Wrap console.error
    console.error = function(...args: any[]) {
      const { tag, cleanArgs } = extractTag(args);
      pushLog({
        level: 'error',
        source: 'console',
        tag,
        message: cleanArgs.map(arg => 
          typeof arg === 'object' ? safeStringify(arg, 2) : String(arg)
        ).join(' '),
        data: cleanArgs.length > 1 || typeof cleanArgs[0] === 'object' ? cleanArgs : undefined
      });
      originalConsole.current!.error(...args);
    };

    // Wrap console.info
    console.info = function(...args: any[]) {
      const { tag, cleanArgs } = extractTag(args);
      pushLog({
        level: 'info',
        source: 'console',
        tag,
        message: cleanArgs.map(arg => 
          typeof arg === 'object' ? safeStringify(arg, 2) : String(arg)
        ).join(' '),
        data: cleanArgs.length > 1 || typeof cleanArgs[0] === 'object' ? cleanArgs : undefined
      });
      originalConsole.current!.info(...args);
    };

    console.log('[DebugLogProvider] Console interception active ✓');


    // Cleanup: restore original console methods and clear mock Chrome logger on unmount
    return () => {
      if (originalConsole.current) {
        console.log = originalConsole.current.log;
        console.warn = originalConsole.current.warn;
        console.error = originalConsole.current.error;
        console.info = originalConsole.current.info;
        isInterceptingRef.current = false;
        console.log('[DebugLogProvider] Console interception disabled');
      }
      
    };
  }, [pushLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    logIdCounter.current = 0;
  }, []);

  const setFilters = useCallback((newFilters: Partial<LogFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const getFilteredLogs = useCallback(() => {
    return logs.filter(log => {
      if (filters.level !== 'all' && log.level !== filters.level) {
        return false;
      }
      
      if (filters.tag && log.tag && !log.tag.toLowerCase().includes(filters.tag.toLowerCase())) {
        return false;
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const messageMatch = log.message.toLowerCase().includes(searchLower);
        const tagMatch = log.tag?.toLowerCase().includes(searchLower);
        const dataMatch = log.data ? safeStringify(log.data).toLowerCase().includes(searchLower) : false;
        
        if (!messageMatch && !tagMatch && !dataMatch) {
          return false;
        }
      }
      
      return true;
    });
  }, [logs, filters]);

  const value: DebugLogContextValue = {
    logs,
    filters,
    pushLog,
    clearLogs,
    setFilters,
    getFilteredLogs
  };

  return (
    <DebugLogContext.Provider value={value}>
      {children}
    </DebugLogContext.Provider>
  );
}

export function useDebugLog() {
  const context = useContext(DebugLogContext);
  if (!context) {
    throw new Error('useDebugLog must be used within DebugLogProvider');
  }
  return context;
}

export { safeStringify };
