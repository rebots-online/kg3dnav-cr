// SPDX-License-Identifier: Apache-2.0
import React from 'react'
import type { BuildInfo } from '../types/knowledge'
import { formatVersionBuildForDisplay } from '../config/buildInfo'

export default function SplashScreen({ buildInfo }: { buildInfo: BuildInfo }): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        zIndex: 1500,
      }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.85)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 24,
          color: 'white',
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          minWidth: 320,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>3D Knowledge Graph Navigator</div>
        <div style={{ fontSize: 14, color: '#ccc', marginBottom: 4 }}>
          {formatVersionBuildForDisplay(buildInfo.versionBuild)}
        </div>
        <div style={{ fontSize: 14, color: '#ccc', marginBottom: 4 }}>v{buildInfo.semver}</div>
        <div style={{ fontSize: 14, color: '#ccc' }}>build {buildInfo.buildNumber}</div>
      </div>
    </div>
  )
}
