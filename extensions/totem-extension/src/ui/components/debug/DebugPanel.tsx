/**
 * TOTEM DESIGNER DEBUG PANEL
 * Collapsible sidebar showing real-time logs, Chrome API calls, and network activity
 * Designer mode only - never appears in production builds
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDebugLog, LogEntry, LogLevel } from '../../contexts/DebugLogContext';
import { Typography, Button } from '../atoms';
import '../../theme/axia-tokens.css';

export function DebugPanel() {
  const { logs, filters, setFilters, clearLogs, getFilteredLogs } = useDebugLog();
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('totem_debug_panel_open');
    return saved ? JSON.parse(saved) : true;
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('[DebugPanel] Mounted! isOpen:', isOpen, 'logs:', logs.length);
  }, []);

  const filteredLogs = getFilteredLogs();

  // Persist panel open state
  useEffect(() => {
    localStorage.setItem('totem_debug_panel_open', JSON.stringify(isOpen));
  }, [isOpen]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  const getLogCounts = () => {
    return {
      all: logs.length,
      log: logs.filter(l => l.level === 'log').length,
      warn: logs.filter(l => l.level === 'warn').length,
      error: logs.filter(l => l.level === 'error').length,
      info: logs.filter(l => l.level === 'info').length,
    };
  };

  const counts = getLogCounts();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  };

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'error': return '#EF4444';
      case 'warn': return '#F59E0B';
      case 'info': return '#3B82F6';
      default: return 'var(--text-primary)';
    }
  };

  const getLevelBadgeStyle = (level: LogLevel) => ({
    backgroundColor: level === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                     level === 'warn' ? 'rgba(245, 158, 11, 0.1)' :
                     level === 'info' ? 'rgba(59, 130, 246, 0.1)' :
                     'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${getLevelColor(level)}`,
    color: getLevelColor(level),
    padding: '2px 6px',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  });

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%) rotate(-90deg)',
          transformOrigin: 'right center',
          padding: 'var(--space-1) var(--space-2)',
          background: 'var(--bg-elevated)',
          border: '2px solid var(--axia-aqua)',
          borderRight: 'none',
          color: 'var(--axia-aqua)',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          cursor: 'pointer',
          zIndex: 9999,
        }}
      >
        Debug Logs ({logs.length})
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: '400px',
      background: 'var(--bg-base)',
      borderLeft: '2px solid var(--axia-aqua)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      fontFamily: 'var(--font-mono)',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-2)',
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-elevated)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
          <Typography variant="body" bold uppercase color="accent">
            🔧 Debug Console
          </Typography>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-lg)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        <Typography variant="caption" color="muted" style={{ fontSize: 'var(--text-2xs)' }}>
          Designer Mode Only • {filteredLogs.length} / {logs.length} logs
        </Typography>
      </div>

      {/* Log Stats */}
      <div style={{
        padding: 'var(--space-1-5)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        gap: 'var(--space-1)',
        flexWrap: 'wrap',
      }}>
        {(['all', 'log', 'warn', 'error', 'info'] as const).map(level => (
          <button
            key={level}
            onClick={() => setFilters({ level: level === 'all' ? 'all' : level })}
            style={{
              background: filters.level === level ? 'var(--axia-aqua)' : 'var(--bg-elevated)',
              border: `1px solid ${filters.level === level ? 'var(--axia-aqua)' : 'var(--border-default)'}`,
              color: filters.level === level ? 'var(--bg-base)' : 'var(--text-muted)',
              padding: '4px 8px',
              fontSize: 'var(--text-2xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {level} ({counts[level]})
          </button>
        ))}
      </div>

      {/* Logs List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-1)',
        fontSize: 'var(--text-xs)',
        lineHeight: 1.4,
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ padding: 'var(--space-2)', textAlign: 'center', color: 'var(--text-muted)' }}>
            No logs yet. Console output will appear here.
          </div>
        ) : (
          filteredLogs.map(log => (
            <LogEntryRow key={log.id} log={log} formatTime={formatTime} getLevelBadgeStyle={getLevelBadgeStyle} />
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer Controls */}
      <div style={{
        padding: 'var(--space-1-5)',
        borderTop: '1px solid var(--border-default)',
        background: 'var(--bg-elevated)',
        display: 'flex',
        gap: 'var(--space-1)',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={clearLogs}
          style={{
            flex: 1,
            padding: 'var(--space-1)',
            background: 'transparent',
            border: '1px solid var(--border-default)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-2xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={{
            flex: 1,
            padding: 'var(--space-1)',
            background: autoScroll ? 'var(--axia-aqua)' : 'transparent',
            border: `1px solid ${autoScroll ? 'var(--axia-aqua)' : 'var(--border-default)'}`,
            color: autoScroll ? 'var(--bg-base)' : 'var(--text-muted)',
            fontSize: 'var(--text-2xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}

function LogEntryRow({ log, formatTime, getLevelBadgeStyle }: {
  log: LogEntry;
  formatTime: (ts: number) => string;
  getLevelBadgeStyle: (level: LogLevel) => any;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => log.data && setExpanded(!expanded)}
      style={{
        padding: 'var(--space-1)',
        marginBottom: '2px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        cursor: log.data ? 'pointer' : 'default',
        transition: 'all 0.1s',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          {formatTime(log.timestamp)}
        </span>
        
        <span style={getLevelBadgeStyle(log.level)}>
          {log.level}
        </span>

        {log.tag && (
          <span style={{
            fontSize: '10px',
            color: 'var(--axia-aqua)',
            fontWeight: 600,
          }}>
            {log.tag}
          </span>
        )}

        <span style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
        }}>
          [{log.source}]
        </span>
      </div>

      <div style={{
        marginTop: '4px',
        color: 'var(--text-primary)',
        wordBreak: 'break-word',
      }}>
        {log.message}
      </div>

      {log.data && expanded && (
        <pre style={{
          marginTop: '4px',
          padding: 'var(--space-1)',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-accent)',
          fontSize: '10px',
          color: 'var(--text-muted)',
          overflowX: 'auto',
          maxHeight: '200px',
        }}>
          {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
