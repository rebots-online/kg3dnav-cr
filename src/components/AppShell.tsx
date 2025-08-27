// SPDX-License-Identifier: Apache-2.0
import React, { useMemo, useState, useEffect } from 'react'
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

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1200)
    return () => clearTimeout(t)
  }, [])

  // Tauri event wiring (no-op on web)
  useEffect(() => {
    let unsubs: Array<() => void> = []
    async function wire() {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const u1 = await listen('about', () => setAboutOpen(true))
        const u2 = await listen('set-layout', (e) => {
          const val = (e.payload as any) as 'concept-centric' | 'sphere' | 'grid'
          const { setLayout } = await import('../state/actions')
          setLayout(val)
        })
        const u3 = await listen('toggle-xray', async () => {
          const { setXRayMode } = await import('../state/actions')
          const useStore = (await import('../state/store')).default
          const cur = useStore.getState().xRayMode
          setXRayMode(!cur)
        })
        const u4 = await listen('reset-camera', async () => {
          const { resetCamera } = await import('../state/actions')
          resetCamera()
        })
        const u5 = await listen('toggle-sidebar', async () => {
          const { toggleSidebar } = await import('../state/actions')
          toggleSidebar()
        })
        unsubs = [u1, u2, u3, u4, u5].map((u) => u as unknown as () => void)
      } catch (_) {
        // Web build: @tauri-apps/api not available, ignore
      }
    }
    void wire()
    return () => {
      unsubs.forEach((u) => {
        try { u() } catch (_) {}
      })
    }
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

