// SPDX-License-Identifier: Apache-2.0
import type { Entity, Relationship, Layout } from '../types/knowledge'

export type Position = [number, number, number]

export interface PositionState {
  entities: Entity[]
  relationships: Relationship[]
  layout: Layout
}

function fibonacciSpherePoint(i: number, n: number, radius: number): Position {
  // Golden angle in radians
  const g = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - (i / (n - 1)) * 2 // y goes from 1 to -1
  const r = Math.sqrt(1 - y * y)
  const theta = g * i
  const x = Math.cos(theta) * r
  const z = Math.sin(theta) * r
  return [x * radius + 0.5, y * radius + 0.5, z * radius + 0.5]
}

function conceptCentricPositions(state: PositionState): Record<string, Position> {
  const { entities, relationships } = state
  const positions: Record<string, Position> = {}

  const concepts = entities.filter(e => e.type === 'CONCEPT')
  const others = entities.filter(e => e.type !== 'CONCEPT')

  // Place concepts in a central ring/sphere
  const radiusCenter = 0.3
  concepts.forEach((entity, i) => {
    const p = fibonacciSpherePoint(i, Math.max(concepts.length, 1), radiusCenter)
    positions[entity.name] = p
  })

  // Build adjacency for quick lookup
  const adj = new Map<string, Set<string>>()
  relationships.forEach(rel => {
    if (!adj.has(rel.source)) adj.set(rel.source, new Set())
    if (!adj.has(rel.target)) adj.set(rel.target, new Set())
    adj.get(rel.source)!.add(rel.target)
    adj.get(rel.target)!.add(rel.source)
  })

  // Place others near first related concept if any, else on outer ring
  const outerBase = 0.75
  others.forEach((entity, i) => {
    const rels = adj.get(entity.name) || new Set<string>()
    const relatedConcept = [...rels].find(name => concepts.find(c => c.name === name))
    if (relatedConcept && positions[relatedConcept]) {
      const [cx, cy, cz] = positions[relatedConcept]
      const angle = (i * 9871.514) % (Math.PI * 2) // pseudo-random but deterministic by index
      const offset = 0.15 + ((i * 0.017) % 0.1)
      positions[entity.name] = [
        cx + Math.cos(angle) * offset,
        cy + Math.sin(angle) * offset,
        cz + (((i * 0.023) % 0.1) - 0.05),
      ]
    } else {
      const angle = (i * 6121.233) % (Math.PI * 2)
      positions[entity.name] = [
        0.5 + Math.cos(angle) * outerBase,
        0.5 + Math.sin(angle) * outerBase,
        0.5 + (((i * 0.029) % 0.2) - 0.1),
      ]
    }
  })

  return positions
}

function spherePositions(state: PositionState): Record<string, Position> {
  const { entities } = state
  const positions: Record<string, Position> = {}
  const n = Math.max(entities.length, 1)
  const radius = 0.4
  entities.forEach((e, i) => {
    positions[e.name] = fibonacciSpherePoint(i, n, radius)
  })
  return positions
}

function gridPositions(state: PositionState): Record<string, Position> {
  const { entities } = state
  const positions: Record<string, Position> = {}
  const n = entities.length
  const gridSize = Math.max(1, Math.ceil(Math.sqrt(n)))
  entities.forEach((e, i) => {
    const gx = i % gridSize
    const gy = Math.floor(i / gridSize)
    const nx = gridSize > 1 ? gx / (gridSize - 1) : 0.5
    const ny = gridSize > 1 ? gy / (gridSize - 1) : 0.5
    positions[e.name] = [nx, ny, 0.5]
  })
  return positions
}

export function generatePositions(state: PositionState): Record<string, Position> {
  switch (state.layout) {
    case 'concept-centric':
      return conceptCentricPositions(state)
    case 'grid':
      return gridPositions(state)
    case 'sphere':
    default:
      return spherePositions(state)
  }
}

