// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useMemo, useRef } from 'react'
import {
  logInfo,
  useLogEntries,
  useLogPanelState,
  useLogStore,
  type LogEntry,
} from '../state/logStore'

type ConnectionDebugSidebarProps = {
  initiallyOpen?: boolean
}

function levelColor(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return '#ff6b6b'
    case 'warn':
      return '#ffd93d'
    case 'info':
      return '#4ecdc4'
    default:
      return '#a0aec0'
  }
}

function formatTimestamp(ts: string) {
  try {
    const date = new Date(ts)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().replace('T', ' ').replace('Z', '')
    }
  } catch (_) {
    // ignore
  }
  return ts
}

export default function ConnectionDebugSidebar({ initiallyOpen }: ConnectionDebugSidebarProps) {
  const entries = useLogEntries()
  const {
    isVisible,
    dock,
    width,
    autoScroll,
    unreadErrorCount,
    setVisible,
    setDock,
    setWidth,
    setAutoScroll,
    clear,
    consumeErrorBadge,
  } = useLogPanelState()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (initiallyOpen) setVisible(true)
  }, [initiallyOpen, setVisible])

  useEffect(() => {
    const unsubscribe = useLogStore.subscribe(
      (state) => state.entries[state.entries.length - 1],
      (entry) => {
        if (entry?.level === 'error') {
          setVisible(true)
        }
      }
    )
    return () => {
      unsubscribe()
    }
  }, [setVisible])

  useEffect(() => {
    if (!autoScroll) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, autoScroll])

  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((records) => {
      for (const record of records) {
        setWidth(record.contentRect.width)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [setWidth])

  useEffect(() => {
    if (isVisible) consumeErrorBadge()
  }, [consumeErrorBadge, isVisible])

  const levelLegend = useMemo(
    () => (
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
        <span><span style={{ color: levelColor('debug') }}>●</span> debug</span>
        <span><span style={{ color: levelColor('info') }}>●</span> info</span>
        <span><span style={{ color: levelColor('warn') }}>●</span> warn</span>
        <span><span style={{ color: levelColor('error') }}>●</span> error</span>
      </div>
    ),
    []
  )

  return (
    <>
      <button
        onClick={() => {
          const next = !isVisible
          setVisible(next)
          if (next) {
            logInfo('debug-sidebar', 'Debug sidebar opened')
          }
        }}
        style={{
          position: 'absolute',
          top: 10,
          right: dock === 'right' ? width + 24 : undefined,
          left: dock === 'left' ? width + 24 : undefined,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          padding: '6px 12px',
          cursor: 'pointer',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        🪵 Logs
        {unreadErrorCount > 0 && (
          <span
            style={{
              background: '#ff6b6b',
              color: 'white',
              borderRadius: 999,
              fontSize: 11,
              padding: '1px 6px',
            }}
          >
            {unreadErrorCount}
          </span>
        )}
      </button>

      {isVisible && (
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            top: 50,
            bottom: 20,
            [dock]: 12,
            width,
            maxWidth: '90vw',
            background: 'rgba(10,10,10,0.92)',
            color: 'white',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            resize: 'horizontal',
            zIndex: 80,
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <header
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              background: 'linear-gradient(135deg, rgba(102,126,234,0.2), rgba(118,75,162,0.2))',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Connection Debug Log</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                Real-time trace of Neo4j/Qdrant/Postgres/LLM events
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDock(dock === 'right' ? 'left' : 'right')}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: 6,
                  fontSize: 12,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Dock: {dock === 'right' ? '➡️' : '⬅️'}
              </button>
              <button
                onClick={() => setVisible(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: 6,
                  fontSize: 12,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </header>

          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              gap: 12,
            }}
          >
            {levelLegend}
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                Auto-scroll
              </label>
              <button
                onClick={() => clear()}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: 6,
                  fontSize: 12,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 12,
              padding: '12px 16px',
            }}
          >
            {entries.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 40 }}>
                No log entries yet.
              </div>
            )}
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  paddingBottom: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{formatTimestamp(entry.timestamp)}</span>
                  <span
                    style={{
                      color: levelColor(entry.level),
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      fontSize: 11,
                    }}
                  >
                    {entry.level}
                  </span>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      color: 'rgba(255,255,255,0.75)',
                      fontSize: 11,
                    }}
                  >
                    {entry.source}
                  </span>
                </div>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{entry.message}</div>
                {entry.detail !== undefined && (
                  <pre
                    style={{
                      marginTop: 6,
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {JSON.stringify(entry.detail, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </>
  )
}

