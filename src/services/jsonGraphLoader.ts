// SPDX-License-Identifier: Apache-2.0
import type { KnowledgeGraphResult } from './hkgLoader'
import type { Entity, Relationship } from '../types/knowledge'

const ENTITY_TYPE_OPTIONS: ReadonlyArray<Entity['type']> = [
  'CONCEPT',
  'PERSON',
  'ORGANIZATION',
  'LOCATION',
  'EVENT',
  'OTHER',
]

const SEARCH_RELEVANCE_VALUES = new Set<Entity['searchRelevance']>([
  'uuid_coordinated',
  'vector_semantic',
  'audit_activity',
  'text_search',
])

function coerceEntity(input: unknown, index: number): Entity {
  if (!input || typeof input !== 'object') throw new Error(`Entity at index ${index} is not an object`)
  const record = input as Record<string, unknown>
  const rawName = record.name ?? record.title ?? ''
  const name = typeof rawName === 'string' ? rawName.trim() : String(rawName).trim()
  if (!name) throw new Error(`Entity at index ${index} is missing a name`)
  const rawType = record.type ?? record.entityType ?? 'CONCEPT'
  const typeCandidate = typeof rawType === 'string' ? rawType.toUpperCase() : String(rawType).toUpperCase()
  const entityType = ENTITY_TYPE_OPTIONS.includes(typeCandidate as Entity['type'])
    ? (typeCandidate as Entity['type'])
    : 'OTHER'
  const description = Array.isArray(record.observations)
    ? record.observations.filter((item): item is string => typeof item === 'string').join('; ')
    : typeof record.description === 'string'
      ? record.description
      : undefined
  const entity: Entity = { name, type: entityType, description }
  if (typeof record.uuid === 'string') entity.uuid = record.uuid
  if (typeof record.searchRelevance === 'string' && SEARCH_RELEVANCE_VALUES.has(record.searchRelevance as Entity['searchRelevance'])) {
    entity.searchRelevance = record.searchRelevance as Entity['searchRelevance']
  }
  if (typeof record.vectorMatch === 'boolean') entity.vectorMatch = record.vectorMatch
  if (typeof record.auditMatch === 'boolean') entity.auditMatch = record.auditMatch
  if (record.spatial_media && typeof record.spatial_media === 'object') {
    entity.spatial_media = record.spatial_media as Entity['spatial_media']
  }
  return entity
}

function coerceRelationship(input: unknown, index: number): Relationship {
  if (!input || typeof input !== 'object') throw new Error(`Relationship at index ${index} is not an object`)
  const record = input as Record<string, unknown>
  const source = typeof record.source === 'string' ? record.source : typeof record.from === 'string' ? record.from : ''
  const target = typeof record.target === 'string' ? record.target : typeof record.to === 'string' ? record.to : ''
  if (!source.trim() || !target.trim()) {
    throw new Error(`Relationship at index ${index} must include source and target`)
  }
  const rawRelationship = record.relationship ?? record.type ?? record.label ?? 'RELATED_TO'
  const relationship = typeof rawRelationship === 'string' ? rawRelationship : String(rawRelationship)
  const rel: Relationship = { source: source.trim(), target: target.trim(), relationship }
  if (typeof record.uuid === 'string') rel.uuid = record.uuid
  return rel
}

export function parseKnowledgeGraphJson(raw: unknown): KnowledgeGraphResult {
  if (!raw || typeof raw !== 'object') throw new Error('Knowledge graph JSON must be an object')
  const container = raw as Record<string, unknown>
  const maybeGraph = (container.knowledge_graph as Record<string, unknown> | undefined) ?? container
  const entitiesRaw = maybeGraph.entities ?? []
  const relationshipsRaw = maybeGraph.relationships ?? []
  if (!Array.isArray(entitiesRaw)) throw new Error('knowledge_graph.entities must be an array')
  if (!Array.isArray(relationshipsRaw)) throw new Error('knowledge_graph.relationships must be an array')

  const entities = entitiesRaw.map(coerceEntity)
  const relationships = relationshipsRaw.map(coerceRelationship)

  const timestamp = new Date().toISOString()
  return {
    knowledge_graph: { entities, relationships },
    metadata: {
      source: 'json_upload',
      imported_at: timestamp,
      timestamp,
      entity_count: entities.length,
      relationship_count: relationships.length,
    },
  }
}

export async function loadGraphFromJsonFile(file: File): Promise<KnowledgeGraphResult> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new Error(`Invalid JSON: ${(err as Error).message}`)
  }
  const result = parseKnowledgeGraphJson(parsed)
  const timestamp = new Date().toISOString()
  const endpoint = `file://${encodeURIComponent(file.name)}`
  result.metadata = {
    connection_mode: 'file_upload',
    endpoint,
    ...result.metadata,
    source: result.metadata?.source ?? 'json_upload',
    imported_at: result.metadata?.imported_at ?? timestamp,
    timestamp: result.metadata?.timestamp ?? timestamp,
    source_file_name: file.name,
    source_file_size: file.size,
    source_file_last_modified: file.lastModified,
  }
  return result
}
