// SPDX-License-Identifier: Apache-2.0
import React from 'react'
import type { BuildInfo } from '../types/knowledge'

export default function AboutModal({ buildInfo, onClose }: { buildInfo: BuildInfo; onClose: () => void }): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          background: 'rgba(10,10,10,0.95)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12,
          padding: 20,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <h2 style={{ marginTop: 0 }}>3D Knowledge Graph Navigator</h2>
        <div>Version: v{buildInfo.semver}</div>
        <div>Build: {buildInfo.buildNumber} (epoch minutes {buildInfo.epochMinutes})</div>
        <div>Commit: {buildInfo.gitSha}</div>
        <div>Built: {buildInfo.builtAtIso}</div>
        <div style={{ marginTop: 12, fontSize: 13, color: '#ccc' }}>
          Navigate knowledge graphs in immersive 3D space with sharded search and UUID coordination.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

