// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { TrackballControls } from '@react-three/drei'
import useStore from '../state/store'
import { animate } from 'framer-motion'
import KnowledgeNode from './KnowledgeNode'

function RelationshipLine({ relationship, entityPositions }: { relationship: { source: string; target: string }; entityPositions: Record<string, [number, number, number]> }) {
  const sourcePos = entityPositions[relationship.source]
  const targetPos = entityPositions[relationship.target]
  if (!sourcePos || !targetPos) return null
  const points = [
    [sourcePos[0] * 600, sourcePos[1] * 600, sourcePos[2] * 600],
    [targetPos[0] * 600, targetPos[1] * 600, targetPos[2] * 600],
  ]
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={new Float32Array(points.flat())} itemSize={3} count={2} />
      </bufferGeometry>
      <lineBasicMaterial color="#444444" opacity={0.6} transparent />
    </line>
  )
}

export default function Scene3D(): JSX.Element {
  const entities = useStore.use.entities()
  const relationships = useStore.use.relationships()
  const entityPositions = useStore.use.entityPositions()
  const layout = useStore.use.layout()
  const highlightEntities = useStore.use.highlightEntities()
  const targetEntity = useStore.use.targetEntity()
  const xRayMode = useStore.use.xRayMode()
  const resetCam = useStore.use.resetCam()
  const { camera } = useThree()
  const groupRef = useRef<any>()
  const controlsRef = useRef<any>()
  const [isAutoRotating, setIsAutoRotating] = useState(false)
  const inactivityTimerRef = useRef<any>(null)
  const rotationVelocityRef = useRef(0)

  const cameraDistance = 25
  const targetSpeed = 0.05
  const acceleration = 0.5

  const restartInactivityTimer = () => {
    clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => setIsAutoRotating(true), 15000)
  }

  const handleInteractionStart = () => {
    setIsAutoRotating(false)
    clearTimeout(inactivityTimerRef.current)
    rotationVelocityRef.current = 0
  }
  const handleInteractionEnd = () => restartInactivityTimer()

  // Camera animation to target entity
  useEffect(() => {
    if (targetEntity && entityPositions && layout && camera && controlsRef.current && groupRef.current) {
      setIsAutoRotating(false)
      clearTimeout(inactivityTimerRef.current)
      rotationVelocityRef.current = 0

      const entityPos = entityPositions[targetEntity]
      if (!entityPos) return
      const entityLocalX = (entityPos[0] - 0.5) * 600
      const entityLocalY = (entityPos[1] - 0.5) * 600
      const entityLocalZ = ((entityPos[2] || 0) - 0.5) * 600

      const groupRotationY = groupRef.current.rotation.y
      const groupPositionZ = groupRef.current.position.z
      const targetEntityWorldVec = {
        x: entityLocalX * Math.cos(groupRotationY) - entityLocalZ * Math.sin(groupRotationY),
        y: entityLocalY,
        z: entityLocalX * Math.sin(groupRotationY) + entityLocalZ * Math.cos(groupRotationY) + groupPositionZ,
      }

      const duration = 0.8
      const ease = 'easeInOut'

      const currentTarget = controlsRef.current.target.clone()
      const animateTarget = [
        animate(currentTarget.x, targetEntityWorldVec.x, { duration, ease, onUpdate: (v) => (controlsRef.current.target.x = v) }),
        animate(currentTarget.y, targetEntityWorldVec.y, { duration, ease, onUpdate: (v) => (controlsRef.current.target.y = v) }),
        animate(currentTarget.z, targetEntityWorldVec.z, { duration, ease, onUpdate: (v) => (controlsRef.current.target.z = v) }),
      ]

      const offsetDirection = camera.position.clone().sub(controlsRef.current.target)
      if (offsetDirection.lengthSq() === 0) offsetDirection.set(0, 0, 1)
      offsetDirection.normalize().multiplyScalar(cameraDistance)
      const targetCamera = {
        x: targetEntityWorldVec.x + offsetDirection.x,
        y: targetEntityWorldVec.y + offsetDirection.y,
        z: targetEntityWorldVec.z + offsetDirection.z,
      }

      const animateCamera = [
        animate(camera.position.x, targetCamera.x, { duration, ease, onUpdate: (v) => (camera.position.x = v) }),
        animate(camera.position.y, targetCamera.y, { duration, ease, onUpdate: (v) => (camera.position.y = v) }),
        animate(camera.position.z, targetCamera.z, { duration, ease, onUpdate: (v) => (camera.position.z = v) }),
      ]

      Promise.all([...animateTarget, ...animateCamera].map((a) => a.finished)).then(() => {
        camera.position.set(targetCamera.x, targetCamera.y, targetCamera.z)
        controlsRef.current.target.set(targetEntityWorldVec.x, targetEntityWorldVec.y, targetEntityWorldVec.z)
      })
    } else if (!targetEntity) {
      restartInactivityTimer()
    }
  }, [targetEntity, entityPositions, layout, camera])

  // Layout transition reset (camera & group)
  useEffect(() => {
    const controls = controlsRef.current
    const duration = 0.8
    const ease = 'easeInOut'
    const targetLayoutPosition: [number, number, number] = [0, 0, 300]
    const targetControlsTarget: [number, number, number] = [0, 0, 0]

    if (controls && camera) {
      const currentTarget = controls.target.clone()
      const anims = [
        animate(camera.position.x, targetLayoutPosition[0], { duration, ease, onUpdate: (v) => (camera.position.x = v) }),
        animate(camera.position.y, targetLayoutPosition[1], { duration, ease, onUpdate: (v) => (camera.position.y = v) }),
        animate(camera.position.z, targetLayoutPosition[2], { duration, ease, onUpdate: (v) => (camera.position.z = v) }),
        animate(currentTarget.x, targetControlsTarget[0], { duration, ease, onUpdate: (v) => (controlsRef.current.target.x = v) }),
        animate(currentTarget.y, targetControlsTarget[1], { duration, ease, onUpdate: (v) => (controlsRef.current.target.y = v) }),
        animate(currentTarget.z, targetControlsTarget[2], { duration, ease, onUpdate: (v) => (controlsRef.current.target.z = v) }),
      ]
      Promise.all(anims.map((a) => a.finished)).then(() => {
        camera.position.set(...targetLayoutPosition)
        controlsRef.current.target.set(...targetControlsTarget)
      })
    }

    if (groupRef.current) {
      animate(groupRef.current.position.z, layout === 'grid' ? 150 : 0, {
        duration,
        ease,
        onUpdate: (v) => (groupRef.current.position.z = v),
      })
      ;(['x', 'y', 'z'] as const).forEach((axis) => {
        animate(groupRef.current.rotation[axis], 0, { duration, ease, onUpdate: (v) => (groupRef.current.rotation[axis] = v) })
      })
    }

    useStore.setState((s) => ({ ...s, resetCam: false }))
  }, [layout, camera, resetCam])

  useFrame((_, delta) => {
    let currentVelocity = rotationVelocityRef.current
    if (isAutoRotating) currentVelocity += (targetSpeed - currentVelocity) * acceleration * delta
    else currentVelocity += (0 - currentVelocity) * acceleration * delta
    rotationVelocityRef.current = currentVelocity
    if (groupRef.current && Math.abs(currentVelocity) > 0.0001 && layout !== 'grid') {
      groupRef.current.rotation.y += currentVelocity * delta
    }
    controlsRef.current?.update()
  })

  const hasData = entities.length > 0

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />

      <TrackballControls
        ref={controlsRef as any}
        onStart={() => handleInteractionStart()}
        onEnd={() => handleInteractionEnd()}
        minDistance={10}
        maxDistance={1000}
        noPan={false}
        panSpeed={0.8}
        rotateSpeed={1.0}
        zoomSpeed={0.8}
      />

      {!hasData && (
        <group>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.5]} />
            <meshStandardMaterial color="#4ECDC4" transparent opacity={0.6} wireframe />
          </mesh>
          <mesh position={[0, -1.5, 0]}>
            <boxGeometry args={[4, 0.1, 1]} />
            <meshStandardMaterial color="#444444" />
          </mesh>
        </group>
      )}

      <group ref={groupRef as any}>
        {relationships.map((rel, idx) => (
          <RelationshipLine key={`${rel.source}-${rel.target}-${idx}`} relationship={rel} entityPositions={entityPositions} />
        ))}
        {entities.map((entity) => {
          const isHighlighted = highlightEntities.includes(entity.name)
          const entityPos = entityPositions[entity.name]
          if (!entityPos) return null
          return (
            <KnowledgeNode
              key={entity.name}
              entity={entity}
              x={entityPos[0] - 0.5}
              y={entityPos[1] - 0.5}
              z={(entityPos[2] || 0) - 0.5}
              highlight={isHighlighted || (targetEntity && targetEntity === entity.name)}
              dim={(highlightEntities.length > 0 && !isHighlighted) || (targetEntity && targetEntity !== entity.name)}
              xRayMode={xRayMode}
            />
          )
        })}
      </group>
    </>
  )
}

