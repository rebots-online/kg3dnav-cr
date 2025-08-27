// SPDX-License-Identifier: Apache-2.0
import React from 'react'
import { Billboard, Text, Sphere, Box } from '@react-three/drei'
import { motion } from 'framer-motion-3d'
import { setTargetEntity } from '../state/actions'
import type { Entity } from '../types/knowledge'

function getEntityShape(entityType: Entity['type']): 'sphere' | 'box' {
  switch (entityType) {
    case 'ORGANIZATION':
      return 'box'
    default:
      return 'sphere'
  }
}

function getEntityColor(entityType: Entity['type']): string {
  const map: Record<Entity['type'], string> = {
    PERSON: '#FF6B6B',
    ORGANIZATION: '#4ECDC4',
    LOCATION: '#45B7D1',
    CONCEPT: '#96CEB4',
    EVENT: '#FFEAA7',
    OTHER: '#DDA0DD',
  }
  return map[entityType] || '#CCCCCC'
}

export default function KnowledgeNode({
  entity,
  x = 0,
  y = 0,
  z = 0,
  highlight,
  dim,
  xRayMode,
}: {
  entity: Entity
  x?: number
  y?: number
  z?: number
  highlight: boolean
  dim: boolean
  xRayMode: boolean
}): JSX.Element {
  const entityShape = getEntityShape(entity.type)
  let entityColor = getEntityColor(entity.type)
  const opacity = highlight ? 1 : dim ? 0.1 : 0.8

  const isShardedResult = !!entity.searchRelevance
  const isUUIDCoordinated = entity.searchRelevance === 'uuid_coordinated'
  const hasVectorMatch = !!entity.vectorMatch
  const hasAuditMatch = !!entity.auditMatch

  if (isUUIDCoordinated) entityColor = '#FFD700'
  else if (isShardedResult) entityColor = '#4ECDC4'

  let nodeSize = entity.type === 'CONCEPT' ? 0.2 : 0.15
  if (isUUIDCoordinated) nodeSize *= 1.2

  return (
    <motion.group
      onClick={(e: any) => {
        e.stopPropagation()
        setTargetEntity(entity.name)
      }}
      position={[x, y, z].map((n) => n * 500) as any}
      animate={{ x: x * 600, y: y * 600, z: z * 600, transition: { duration: 1, ease: 'circInOut' } }}
      whileHover={{ scale: 1.2 }}
      style={{ cursor: 'pointer' } as any}
    >
      {entityShape === 'sphere' ? (
        <Sphere args={[nodeSize]} scale={[1, 1, 1]}>
          <motion.meshStandardMaterial
            color={entityColor}
            initial={{ opacity: 0 } as any}
            animate={{ opacity } as any}
            transition={{ duration: 0.5 } as any}
            emissive={highlight ? entityColor : '#000000'}
            emissiveIntensity={highlight ? 0.3 : 0}
            wireframe={xRayMode}
          />
        </Sphere>
      ) : (
        <Box args={[nodeSize * 2, nodeSize * 2, nodeSize * 2]}>
          <motion.meshStandardMaterial
            color={entityColor}
            initial={{ opacity: 0 } as any}
            animate={{ opacity } as any}
            transition={{ duration: 0.5 } as any}
            emissive={highlight ? entityColor : '#000000'}
            emissiveIntensity={highlight ? 0.3 : 0}
            wireframe={xRayMode}
          />
        </Box>
      )}

      <Billboard>
        <Text fontSize={0.08} color="white" anchorX="center" anchorY="middle" position={[0, -0.4, 0]} maxWidth={2} fillOpacity={xRayMode ? 1 : highlight ? 1 : 0.8}>
          {entity.name}
        </Text>
      </Billboard>
      <Billboard>
        <Text fontSize={0.05} color="#CCCCCC" anchorX="center" anchorY="middle" position={[0, -0.55, 0]} maxWidth={2} fillOpacity={xRayMode ? 1 : 0.6}>
          ({entity.type})
        </Text>
      </Billboard>

      {entity.spatial_media?.has_3d_scene && (
        <motion.group animate={{ rotateY: Math.PI * 2, transition: { duration: 4, repeat: Infinity, ease: 'linear' } }}>
          <Sphere args={[nodeSize * 0.3]} position={[0, nodeSize + 0.1, 0]}>
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
          </Sphere>
        </motion.group>
      )}

      {hasVectorMatch && (
        <Sphere args={[nodeSize * 0.15]} position={[nodeSize + 0.05, nodeSize + 0.05, 0]}>
          <meshStandardMaterial color="#9B59B6" emissive="#9B59B6" emissiveIntensity={0.6} />
        </Sphere>
      )}

      {hasAuditMatch && (
        <Box args={[nodeSize * 0.3, nodeSize * 0.1, nodeSize * 0.1]} position={[-nodeSize - 0.05, nodeSize + 0.05, 0]}>
          <meshStandardMaterial color="#E67E22" emissive="#E67E22" emissiveIntensity={0.6} />
        </Box>
      )}

      {isShardedResult && (
        <Billboard>
          <Text fontSize={0.03} color={isUUIDCoordinated ? '#FFD700' : '#4ECDC4'} anchorX="center" anchorY="middle" position={[0, -0.7, 0]} maxWidth={2} fillOpacity={0.9}>
            {entity.searchRelevance === 'uuid_coordinated'
              ? '🔗 UUID'
              : entity.searchRelevance === 'vector_semantic'
              ? '🔍 Vector'
              : entity.searchRelevance === 'audit_activity'
              ? '📝 Audit'
              : '🔎 Text'}
          </Text>
        </Billboard>
      )}

      {entity.description && (
        <Billboard>
          <Text fontSize={0.04} color="#AAAAAA" anchorX="center" anchorY="top" position={[0, 0.4, 0]} maxWidth={3} fillOpacity={highlight ? 0.9 : 0} visible={highlight}>
            {entity.description}
          </Text>
        </Billboard>
      )}
    </motion.group>
  )
}

