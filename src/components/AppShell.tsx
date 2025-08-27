// SPDX-License-Identifier: Apache-2.0
import React, { useMemo, useState } from 'react'
import Canvas3D from './Canvas3D'
import Sidebar from './Sidebar'
import DataSourcePanel from './DataSourcePanel'
import AINavigationChat from './AINavigationChat'
import { getBuildInfo } from '../config/buildInfo'

export default function AppShell(): JSX.Element {
  const buildInfo = useMemo(() => getBuildInfo(), [])
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <main style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Canvas3D />
      <Sidebar />
      <DataSourcePanel />
      <AINavigationChat />

      {/* Header with stats and About */}
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8 }}>
        <button
          onClick={() => setAboutOpen(true)}
          style={{
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            padding: '8px 12px',
            cursor: 'pointer',
          }}
          title={`v${buildInfo.semver} • build ${buildInfo.epoch} • ${buildInfo.gitSha.substring(0,7)}`}
        >
          About
        </button>
      </div>

      {/* Inline About modal (simple) */}
      {aboutOpen && (
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
          onClick={() => setAboutOpen(false)}
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
            <div>Build: {buildInfo.epoch}</div>
            <div>Commit: {buildInfo.gitSha}</div>
            <div>Built: {buildInfo.builtAtIso}</div>
            <div style={{ marginTop: 12, fontSize: 13, color: '#ccc' }}>
              Navigate knowledge graphs in immersive 3D space with sharded search and UUID coordination.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setAboutOpen(false)}
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
      )}
    </main>
  )
}

