// SPDX-License-Identifier: Apache-2.0
import React, { useMemo } from 'react'
import { useCaption, useEntities, useIsFetching } from '../state/store'

export default function InitialLoadOverlay(): JSX.Element | null {
  const entities = useEntities()
  const isFetching = useIsFetching()
  const caption = useCaption()

  const hasEntities = entities.length > 0
  const message = useMemo(() => {
    const trimmed = caption?.trim()
    if (trimmed) return trimmed
    return isFetching
      ? 'Loading knowledge graph data...'
      : 'Connect to a data source to begin exploring the graph.'
  }, [caption, isFetching])

  if (hasEntities) return null

  return (
    <>
      <style>
        {`
          @keyframes initial-load-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 900,
        }}
      >
        <div
          role="status"
          aria-live="polite"
          style={{
            pointerEvents: 'auto',
            background: 'rgba(0,0,0,0.82)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16,
            padding: '28px 32px',
            maxWidth: 420,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.92)',
            fontFamily: 'Inter, sans-serif',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>3D Knowledge Graph Navigator</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 18 }}>
            Initializing your exploration workspace…
          </div>
          {isFetching && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.15)',
                  borderTopColor: '#4ECDC4',
                  animation: 'initial-load-spin 1s linear infinite',
                }}
              />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Loading…</div>
            </div>
          )}
          <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: isFetching ? 4 : 12 }}>{message}</div>
          {!isFetching && !caption?.trim() && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              Use the data sources panel in the upper right corner to connect.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
