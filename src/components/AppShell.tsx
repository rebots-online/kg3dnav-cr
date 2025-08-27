// SPDX-License-Identifier: Apache-2.0
import React, { useMemo, useState } from 'react'
import Canvas3D from './Canvas3D'
import Sidebar from './Sidebar'
import DataSourcePanel from './DataSourcePanel'
import AINavigationChat from './AINavigationChat'
import { getBuildInfo } from '../config/buildInfo'
import AboutModal from './AboutModal'
import SplashScreen from './SplashScreen'

export default function AppShell(): JSX.Element {
  const buildInfo = useMemo(() => getBuildInfo(), [])
  const [aboutOpen, setAboutOpen] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  React.useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1200)
    return () => clearTimeout(t)
  }, [])

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

      {showSplash && <SplashScreen epoch={buildInfo.epoch} />}
      {aboutOpen && <AboutModal buildInfo={buildInfo} onClose={() => setAboutOpen(false)} />}
    </main>
  )
}

