// SPDX-License-Identifier: Apache-2.0
import React from 'react'
import { Canvas } from '@react-three/fiber'
import { setTargetEntity } from '../state/actions'
import Scene3D from './Scene3D'

export default function Canvas3D(): JSX.Element {
  return (
    <Canvas
      camera={{ position: [0, 0, 300], near: 0.1, far: 10000 }}
      onPointerMissed={() => setTargetEntity(null)}
      style={{ background: 'linear-gradient(to bottom, #0a0a0a, #1a1a2e)' }}
    >
      <Scene3D />
    </Canvas>
  )
}

