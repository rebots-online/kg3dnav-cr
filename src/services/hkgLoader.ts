// SPDX-License-Identifier: Apache-2.0
import type { Entity, Relationship } from '../types/knowledge'
import { getEnvConfig } from '../config/env'
import useSettingsStore, {
  ConnectionMode,
  getServiceConfigSnapshot,
  MCP_DEFAULT,
} from '../state/settingsStore'

export type KnowledgeGraphMetadata = {
  source?: string
  timestamp?: string
  entity_count?: number
  relationship_count?: number
  connection_mode?: ConnectionMode
  endpoint?: string
  [key: string]: unknown
}

export type KnowledgeGraphResponse = {
  knowledge_graph: { entities: Entity[]; relationships: Relationship[] }
  metadata: KnowledgeGraphMetadata
}

export type KnowledgeGraphResult = KnowledgeGraphResponse | null

type Neo4jLoadOptions = {
  limit?: number
  offset?: number
  entityTypes?: string[]
  searchQuery?: string
  maxConnections?: number
  centerEntity?: string | null
}

type RawNeo4jEntity = {
  name?: string
  entityType?: string
  observations?: unknown
  uuid?: string
}

type RawNeo4jRelationship = {
  from?: string
  to?: string
  relationType?: string
  uuid?: string
}

type RawNeo4jGraph = {
  entities?: RawNeo4jEntity[]
  relationships?: RawNeo4jRelationship[]
  totalCount?: number
}

type RawQdrantMetadata = {
  entities?: Entity[]
  relationships?: Relationship[]
  entity_name?: string
  entity_type?: string
  description?: string
  uuid?: string
}

type RawQdrantResult = {
  metadata?: RawQdrantMetadata
  information?: string
  id?: string
}

type RawPostgresLog = {
  metadata?: {
    knowledge_graph?: {
      entities?: Entity[]
      relationships?: Relationship[]
      uuid?: string
    }
    uuid?: string
  }
}

type VectorSearchResult = RawQdrantResult & { uuid?: string }
type AuditSearchResult = RawPostgresLog & { uuid?: string }

const ENTITY_TYPE_VALUES: ReadonlyArray<Entity['type']> = [
  'CONCEPT',
  'PERSON',
  'ORGANIZATION',
  'LOCATION',
  'EVENT',
  'OTHER',
]

function normalizeEntityType(value: unknown): Entity['type'] {
  if (typeof value === 'string') {
    const upper = value.toUpperCase()
    if ((ENTITY_TYPE_VALUES as ReadonlyArray<string>).includes(upper)) {
      return upper as Entity['type']
    }
  }
  return 'OTHER'
}

function coerceDescription(observations: unknown, fallback: string): string {
  if (Array.isArray(observations)) {
    const parts = observations.filter((item): item is string => typeof item === 'string')
    if (parts.length > 0) return parts.join('; ')
  }
  return fallback
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeEntities(input: unknown): Entity[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (!isPlainObject(item)) return null
      const record = item as Record<string, unknown>
      const nameRaw = record.name ?? record.title
      const name = typeof nameRaw === 'string' ? nameRaw : null
      if (!name) return null
      const typeSource = record.type ?? record.entityType
      const type = normalizeEntityType(typeSource)
      const description =
        typeof record.description === 'string' && record.description.trim().length > 0
          ? record.description
          : coerceDescription(record.observations, name)

      const entity: Entity = {
        name,
        type,
      }

      if (description) entity.description = description
      if (typeof record.uuid === 'string') entity.uuid = record.uuid
      if (isPlainObject(record.spatial_media)) {
        entity.spatial_media = record.spatial_media as Entity['spatial_media']
      }
      const relevance = record.searchRelevance
      if (
        relevance === 'uuid_coordinated' ||
        relevance === 'vector_semantic' ||
        relevance === 'audit_activity' ||
        relevance === 'text_search'
      ) {
        entity.searchRelevance = relevance
      }
      if (typeof record.vectorMatch === 'boolean') entity.vectorMatch = record.vectorMatch
      if (typeof record.auditMatch === 'boolean') entity.auditMatch = record.auditMatch

      return entity
    })
    .filter((entity): entity is Entity => Boolean(entity))
}

function normalizeRelationships(input: unknown): Relationship[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (!isPlainObject(item)) return null
      const record = item as Record<string, unknown>
      const source =
        typeof record.source === 'string'
          ? record.source
          : typeof record.from === 'string'
            ? record.from
            : null
      const target =
        typeof record.target === 'string' ? record.target : typeof record.to === 'string' ? record.to : null
      if (!source || !target) return null
      const relType =
        typeof record.relationship === 'string'
          ? record.relationship
          : typeof record.relationType === 'string'
            ? record.relationType
            : 'RELATED_TO'
      const relationship: Relationship = {
        source,
        target,
        relationship: relType,
      }
      if (typeof record.uuid === 'string') relationship.uuid = record.uuid
      return relationship
    })
    .filter((rel): rel is Relationship => Boolean(rel))
}

function mergeMetadata(base: KnowledgeGraphMetadata, incoming: unknown): KnowledgeGraphMetadata {
  const merged: KnowledgeGraphMetadata = { ...base }
  if (isPlainObject(incoming)) {
    for (const [key, value] of Object.entries(incoming)) {
      if (value !== undefined) {
        merged[key] = value as unknown
      }
    }
  }
  return merged
}

function normalizeKnowledgeGraphResponse(
  raw: unknown,
  metaBase: KnowledgeGraphMetadata
): KnowledgeGraphResult | null {
  if (!isPlainObject(raw)) return null
  const kgCandidate = (raw as { knowledge_graph?: unknown }).knowledge_graph
  if (!isPlainObject(kgCandidate)) return null

  const entities = normalizeEntities((kgCandidate as { entities?: unknown }).entities)
  const relationships = normalizeRelationships((kgCandidate as { relationships?: unknown }).relationships)
  const metadata = mergeMetadata(metaBase, (raw as { metadata?: unknown }).metadata)
  metadata.entity_count = entities.length
  metadata.relationship_count = relationships.length
  if (!metadata.timestamp) metadata.timestamp = new Date().toISOString()

  return {
    knowledge_graph: { entities, relationships },
    metadata,
  }
}

function sanitizeBaseUrl(base?: string | null): string | null {
  if (!base) return null
  const trimmed = base.trim()
  return trimmed ? trimmed.replace(/\/$/, '') : null
}

function basicAuthHeader(username?: string, password?: string): string | null {
  if (!username || !password) return null
  const value = `${username}:${password}`
  try {
    if (typeof btoa === 'function') return `Basic ${btoa(value)}`
  } catch (_) {
    // ignore and try Buffer fallback
  }
  try {
    const maybeBuffer = (
      globalThis as { Buffer?: { from(value: string, encoding: string): { toString(enc: string): string } } }
    ).Buffer
    if (maybeBuffer) return `Basic ${maybeBuffer.from(value, 'utf-8').toString('base64')}`
  } catch (_) {
    // no-op
  }
  return null
}

async function tryFetch(input: RequestInfo, init?: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(input, { ...init, signal: controller.signal })
    return res
  } finally {
    clearTimeout(id)
  }
}

export async function findWorkingMCPServer(): Promise<string | null> {
  const { HKG_MCP_BASE_URL } = getEnvConfig()
  const settings = useSettingsStore.getState()
  const defaults = [
    MCP_DEFAULT,
    'http://localhost:49160',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:7860',
  ]
  const candidates = [settings.getMCPBaseUrl(), HKG_MCP_BASE_URL, ...defaults]
    .filter((url): url is string => !!url)
    .map((url) => url.replace(/\/$/, ''))
  const seen = new Set<string>()
  for (const url of candidates) {
    if (seen.has(url)) continue
    seen.add(url)
    try {
      const r = await tryFetch(`${url}/health`, { method: 'GET' }, 2000)
      if (r.ok) return url
    } catch (_) {
      // continue searching
    }
  }
  return null
}

function mapNeo4jGraph(
  graphData: unknown,
  options: Neo4jLoadOptions,
  mode: ConnectionMode,
  endpoint: string
): KnowledgeGraphResult {
  const baseMetadata: KnowledgeGraphMetadata = {
    source: 'neo4j',
    timestamp: new Date().toISOString(),
    query_params: options,
    connection_mode: mode,
    endpoint,
  }

  const normalized = normalizeKnowledgeGraphResponse(graphData, baseMetadata)
  if (normalized) {
    normalized.metadata.query_params = options
    normalized.metadata.connection_mode = mode
    normalized.metadata.endpoint = endpoint
    normalized.metadata.source = 'neo4j'
    normalized.metadata.has_more =
      Boolean(options.limit) && normalized.knowledge_graph.entities.length === (options.limit ?? 0)
    if (isPlainObject(graphData) && typeof (graphData as { totalCount?: number }).totalCount === 'number') {
      normalized.metadata.total_available = (graphData as { totalCount: number }).totalCount
    }
    if (typeof normalized.metadata.total_available !== 'number') {
      normalized.metadata.total_available = normalized.metadata.entity_count
    }
    return normalized
  }

  const rawGraph = (graphData ?? {}) as RawNeo4jGraph & { metadata?: KnowledgeGraphMetadata }
  const entities = normalizeEntities(rawGraph.entities)
  const relationships = normalizeRelationships(rawGraph.relationships)
  const metadata = mergeMetadata(baseMetadata, rawGraph.metadata)
  metadata.entity_count = entities.length
  metadata.relationship_count = relationships.length
  metadata.has_more = Boolean(options.limit) && entities.length === (options.limit ?? 0)
  metadata.total_available = typeof rawGraph.totalCount === 'number' ? rawGraph.totalCount : entities.length
  if (!metadata.timestamp) metadata.timestamp = new Date().toISOString()

  return {
    knowledge_graph: { entities, relationships },
    metadata,
  }
}

export async function loadFromNeo4j(options: Neo4jLoadOptions = {}): Promise<KnowledgeGraphResult> {
  const settings = useSettingsStore.getState()
  const serviceConfig = getServiceConfigSnapshot('neo4j')
  const perServiceBase = settings.mode === 'perService' ? sanitizeBaseUrl(serviceConfig.baseUrl) : null
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = basicAuthHeader(serviceConfig.username, serviceConfig.password)
  if (auth) headers.Authorization = auth
  const payload = JSON.stringify(options)

  if (perServiceBase) {
    const endpoint = `${perServiceBase}/mcp/neo4j/read_graph`
    try {
      const resp = await tryFetch(endpoint, { method: 'POST', headers, body: payload }, 8000)
      if (!resp.ok) throw new Error(`Neo4j request failed: ${resp.status}`)
      const graphData = await resp.json()
      return mapNeo4jGraph(graphData, options, 'perService', endpoint)
    } catch (err) {
      console.warn('Neo4j per-service fetch failed:', err)
    }
  }

  try {
    const base = await findWorkingMCPServer()
    if (!base) throw new Error('No MCP server available')
    const endpoint = `${base}/mcp/neo4j/read_graph`
    const resp = await tryFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })
    if (!resp.ok) throw new Error(`Neo4j request failed: ${resp.status}`)
    const graphData = await resp.json()
    return mapNeo4jGraph(graphData, options, 'unified', endpoint)
  } catch (e) {
    console.error('Failed to load from Neo4j:', e)
    return null
  }
}

export async function loadFromQdrant(
  searchQuery = 'knowledge graph entities'
): Promise<KnowledgeGraphResult> {
  const settings = useSettingsStore.getState()
  const serviceConfig = getServiceConfigSnapshot('qdrant')
  const perServiceBase = settings.mode === 'perService' ? sanitizeBaseUrl(serviceConfig.baseUrl) : null
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (serviceConfig.apiKey) headers['api-key'] = serviceConfig.apiKey

  if (perServiceBase) {
    const endpoint = `${perServiceBase}/mcp/qdrant/find`
    try {
      const resp = await tryFetch(
        endpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: searchQuery }),
        },
        8000
      )
      if (!resp.ok) throw new Error(`Qdrant request failed: ${resp.status}`)
      const data = (await resp.json()) as RawQdrantResult[]
      return mapQdrantResults(data, searchQuery, 'perService', endpoint)
    } catch (err) {
      console.warn('Qdrant per-service fetch failed:', err)
    }
  }

  try {
    const base = await findWorkingMCPServer()
    if (!base) throw new Error('No MCP server available')
    const endpoint = `${base}/mcp/qdrant/find`
    const resp = await tryFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery }),
    })
    if (!resp.ok) throw new Error(`Qdrant request failed: ${resp.status}`)
    const data = (await resp.json()) as RawQdrantResult[]
    return mapQdrantResults(data, searchQuery, 'unified', endpoint)
  } catch (e) {
    console.error('Failed to load from Qdrant:', e)
    return null
  }
}

function mapQdrantResults(
  raw: unknown,
  searchQuery: string,
  mode: ConnectionMode,
  endpoint: string
): KnowledgeGraphResult {
  const baseMetadata: KnowledgeGraphMetadata = {
    source: 'qdrant',
    search_query: searchQuery,
    timestamp: new Date().toISOString(),
    connection_mode: mode,
    endpoint,
  }

  const normalized = normalizeKnowledgeGraphResponse(raw, baseMetadata)
  if (normalized) {
    normalized.metadata.source = 'qdrant'
    normalized.metadata.search_query = searchQuery
    normalized.metadata.connection_mode = mode
    normalized.metadata.endpoint = endpoint
    if (!normalized.metadata.timestamp) normalized.metadata.timestamp = new Date().toISOString()
    return normalized
  }

  const entities: Entity[] = []
  const relationships: Relationship[] = []

  const data = Array.isArray(raw) ? (raw as RawQdrantResult[]) : []

  data.forEach((result) => {
    const metadata = result.metadata
    if (metadata) {
      if (Array.isArray(metadata.entities)) {
        entities.push(
          ...normalizeEntities(
            metadata.entities.map((entity) => ({
              ...entity,
              vectorMatch: true,
            }))
          )
        )
      }
      if (Array.isArray(metadata.relationships)) {
        relationships.push(...normalizeRelationships(metadata.relationships))
      }
      if (typeof metadata.entity_name === 'string') {
        entities.push({
          name: metadata.entity_name,
          type: normalizeEntityType(metadata.entity_type),
          description:
            typeof result.information === 'string'
              ? result.information
              : typeof metadata.description === 'string'
                ? metadata.description
                : '',
          uuid: typeof metadata.uuid === 'string' ? metadata.uuid : undefined,
          vectorMatch: true,
        })
      }
    }
  })

  const metadata = { ...baseMetadata }
  metadata.entity_count = entities.length
  metadata.relationship_count = relationships.length

  return {
    knowledge_graph: { entities, relationships },
    metadata,
  }
}

export async function loadFromPostgreSQL(): Promise<KnowledgeGraphResult> {
  const settings = useSettingsStore.getState()
  const serviceConfig = getServiceConfigSnapshot('postgres')
  const perServiceBase = settings.mode === 'perService' ? sanitizeBaseUrl(serviceConfig.baseUrl) : null
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = basicAuthHeader(serviceConfig.username, serviceConfig.password)
  if (auth) headers.Authorization = auth
  const body = JSON.stringify({
    action: 'knowledge_graph_creation',
    limit: 50,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  if (perServiceBase) {
    const endpoint = `${perServiceBase}/mcp/postgres/query_audit_logs`
    try {
      const resp = await tryFetch(endpoint, { method: 'POST', headers, body }, 8000)
      if (!resp.ok) throw new Error(`PostgreSQL request failed: ${resp.status}`)
      const auditLogs = (await resp.json()) as RawPostgresLog[]
      return mapPostgresResults(auditLogs, 'perService', endpoint)
    } catch (err) {
      console.warn('PostgreSQL per-service fetch failed:', err)
    }
  }

  try {
    const base = await findWorkingMCPServer()
    if (!base) throw new Error('No MCP server available')
    const endpoint = `${base}/mcp/postgres/query_audit_logs`
    const resp = await tryFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!resp.ok) throw new Error(`PostgreSQL request failed: ${resp.status}`)
    const auditLogs = (await resp.json()) as RawPostgresLog[]
    return mapPostgresResults(auditLogs, 'unified', endpoint)
  } catch (e) {
    console.error('Failed to load from PostgreSQL:', e)
    return null
  }
}

function mapPostgresResults(raw: unknown, mode: ConnectionMode, endpoint: string): KnowledgeGraphResult {
  const baseMetadata: KnowledgeGraphMetadata = {
    source: 'postgresql',
    timestamp: new Date().toISOString(),
    connection_mode: mode,
    endpoint,
  }

  const normalized = normalizeKnowledgeGraphResponse(raw, baseMetadata)
  if (normalized) {
    normalized.metadata.source = 'postgresql'
    normalized.metadata.connection_mode = mode
    normalized.metadata.endpoint = endpoint
    if (!normalized.metadata.timestamp) normalized.metadata.timestamp = new Date().toISOString()
    return normalized
  }

  const entities: Entity[] = []
  const relationships: Relationship[] = []
  const auditLogs = Array.isArray(raw) ? (raw as RawPostgresLog[]) : []

  auditLogs.forEach((log) => {
    const knowledgeGraph = log.metadata?.knowledge_graph
    if (knowledgeGraph) {
      if (Array.isArray(knowledgeGraph.entities)) {
        entities.push(...normalizeEntities(knowledgeGraph.entities))
      }
      if (Array.isArray(knowledgeGraph.relationships)) {
        relationships.push(...normalizeRelationships(knowledgeGraph.relationships))
      }
    }
  })

  const metadata = { ...baseMetadata }
  metadata.audit_entries = auditLogs.length
  metadata.entity_count = entities.length
  metadata.relationship_count = relationships.length

  return {
    knowledge_graph: { entities, relationships },
    metadata,
  }
}

export async function loadFromHKG(
  dataSource: 'auto' | 'neo4j' | 'qdrant' | 'postgresql' = 'auto'
): Promise<KnowledgeGraphResult> {
  switch (dataSource) {
    case 'neo4j':
      return loadFromNeo4j()
    case 'qdrant':
      return loadFromQdrant()
    case 'postgresql':
      return loadFromPostgreSQL()
    case 'auto':
    default: {
      let r = await loadFromNeo4j({ limit: 500 })
      if (!r || !r.knowledge_graph.entities.length) r = await loadFromQdrant()
      if (!r || !r.knowledge_graph.entities.length) r = await loadFromPostgreSQL()
      return r
    }
  }
}

export async function loadCenteredSubgraph(
  centerEntity: string,
  maxDepth = 2,
  maxNodes = 200
): Promise<KnowledgeGraphResult> {
  const result = await loadFromNeo4j({
    centerEntity,
    limit: maxNodes,
    maxConnections: Math.floor(maxNodes / 4),
  })
  if (result) {
    result.metadata = {
      ...result.metadata,
      view_type: 'centered_subgraph',
      center_entity: centerEntity,
      max_depth: maxDepth,
    }
  }
  return result
}

export async function loadByEntityType(
  entityType: Entity['type'],
  limit = 300,
  offset = 0
): Promise<KnowledgeGraphResult> {
  const result = await loadFromNeo4j({ entityTypes: [entityType], limit, offset, maxConnections: 30 })
  if (result) {
    result.metadata = {
      ...result.metadata,
      view_type: 'entity_type_view',
      filtered_type: entityType,
    }
  }
  return result
}

export async function loadSearchResults(searchQuery: string, limit = 100): Promise<KnowledgeGraphResult> {
  const result = await loadFromNeo4j({ searchQuery, limit, maxConnections: 20 })
  if (result) {
    result.metadata = {
      ...result.metadata,
      view_type: 'search_results',
      search_query: searchQuery,
    }
  }
  return result
}

export async function searchShardedHKG(
  searchTopic: string,
  options: {
    maxResultsPerShard?: number
    preferVectorSearch?: boolean
    includeAuditTrail?: boolean
    coordinateByUUID?: boolean
    shardTimeout?: number
  } = {}
): Promise<KnowledgeGraphResult> {
  const {
    maxResultsPerShard = 50,
    preferVectorSearch = true,
    includeAuditTrail = true,
    coordinateByUUID = true,
    shardTimeout = 5000,
  } = options
  const base = await findWorkingMCPServer()
  if (!base) return null

  const vectorUUIDs = new Set<string>()
  const auditUUIDs = new Set<string>()
  let vectorResults: VectorSearchResult[] = []
  let auditResults: AuditSearchResult[] = []

  if (preferVectorSearch) {
    try {
      const qRes = await Promise.race([
        tryFetch(`${base}/mcp/qdrant/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchTopic, limit: maxResultsPerShard, similarity_threshold: 0.7 }),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Qdrant timeout')), shardTimeout)
        ),
      ])
      if (qRes.ok) {
        const qData = (await qRes.json()) as RawQdrantResult[]
        vectorResults = qData
          .map<VectorSearchResult>((entry) => ({
            ...entry,
            uuid:
              typeof entry.metadata?.uuid === 'string'
                ? entry.metadata.uuid
                : typeof entry.id === 'string'
                  ? entry.id
                  : undefined,
          }))
          .filter((result): result is VectorSearchResult => typeof result.uuid === 'string')
        vectorResults.forEach((result) => {
          if (result.uuid) vectorUUIDs.add(result.uuid)
        })
      }
    } catch (e) {
      console.warn('Qdrant vector search failed:', (e as Error).message)
    }
  }

  if (includeAuditTrail) {
    try {
      const aRes = await Promise.race([
        tryFetch(`${base}/mcp/postgres/query_audit_logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'knowledge_graph_creation',
            content: searchTopic,
            limit: maxResultsPerShard,
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('PostgreSQL timeout')), shardTimeout)
        ),
      ])
      if (aRes.ok) {
        const aData = (await aRes.json()) as RawPostgresLog[]
        auditResults = aData
          .map<AuditSearchResult>((log) => ({
            ...log,
            uuid:
              typeof log.metadata?.uuid === 'string'
                ? log.metadata.uuid
                : typeof log.metadata?.knowledge_graph?.uuid === 'string'
                  ? log.metadata.knowledge_graph.uuid
                  : undefined,
          }))
          .filter((log): log is AuditSearchResult => typeof log.uuid === 'string')
        auditResults.forEach((log) => {
          if (log.uuid) auditUUIDs.add(log.uuid)
        })
      }
    } catch (e) {
      console.warn('PostgreSQL audit search failed:', (e as Error).message)
    }
  }

  let coordinatedEntities: Entity[] = []
  let coordinatedRelationships: Relationship[] = []

  if (coordinateByUUID) {
    const uuids = Array.from(new Set<string>([...vectorUUIDs.values(), ...auditUUIDs.values()]))
    if (uuids.length > 0) {
      try {
        const nRes = await tryFetch(`${base}/mcp/neo4j/search_nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchTopic,
            uuids,
            include_connected: true,
            max_depth: 2,
            limit: maxResultsPerShard * 2,
          }),
        })
        if (nRes.ok) {
          const nData = (await nRes.json()) as RawNeo4jGraph
          const rawEntities = Array.isArray(nData.entities) ? nData.entities : []
          coordinatedEntities = rawEntities.map((raw) => {
            const name = typeof raw.name === 'string' ? raw.name : 'Unknown'
            const uuid = typeof raw.uuid === 'string' ? raw.uuid : undefined
            return {
              name,
              type: normalizeEntityType(raw.entityType),
              description: coerceDescription(raw.observations, name),
              uuid,
              searchRelevance: uuid && uuids.includes(uuid) ? 'uuid_coordinated' : 'connected',
              vectorMatch: uuid ? vectorUUIDs.has(uuid) : false,
              auditMatch: uuid ? auditUUIDs.has(uuid) : false,
            }
          })
          const rawRelationships = Array.isArray(nData.relationships) ? nData.relationships : []
          coordinatedRelationships = rawRelationships
            .map((raw) => ({
              source: typeof raw.from === 'string' ? raw.from : '',
              target: typeof raw.to === 'string' ? raw.to : '',
              relationship: typeof raw.relationType === 'string' ? raw.relationType : 'RELATED_TO',
              uuid: typeof raw.uuid === 'string' ? raw.uuid : undefined,
            }))
            .filter((rel) => rel.source && rel.target)
        }
      } catch (e) {
        console.warn('Neo4j coordination failed:', (e as Error).message)
      }
    }
  }

  if (coordinatedEntities.length < 10) {
    try {
      const fb = await tryFetch(`${base}/mcp/neo4j/search_nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTopic, limit: maxResultsPerShard }),
      })
      if (fb.ok) {
        const fData = (await fb.json()) as RawNeo4jGraph
        const fallbackEntities: Entity[] = (Array.isArray(fData.entities) ? fData.entities : []).map(
          (raw) => {
            const name = typeof raw.name === 'string' ? raw.name : 'Unknown'
            return {
              uuid: typeof raw.uuid === 'string' ? raw.uuid : undefined,
              name,
              type: normalizeEntityType(raw.entityType),
              description: coerceDescription(raw.observations, name),
              searchRelevance: 'text_search',
            }
          }
        )
        const known = new Set(
          coordinatedEntities.map((e) => e.uuid).filter((id): id is string => Boolean(id))
        )
        coordinatedEntities.push(
          ...fallbackEntities.filter((entity) => !entity.uuid || !known.has(entity.uuid))
        )
      }
    } catch (e) {
      console.warn('Fallback Neo4j search failed:', (e as Error).message)
    }
  }

  return {
    knowledge_graph: { entities: coordinatedEntities, relationships: coordinatedRelationships },
    metadata: {
      source: 'sharded_hkg_search',
      search_topic: searchTopic,
      timestamp: new Date().toISOString(),
      view_type: 'sharded_search_results',
      entity_count: coordinatedEntities.length,
      relationship_count: coordinatedRelationships.length,
      vector_results: vectorResults.length,
      audit_results: auditResults.length,
    },
  }
}
export async function initializeHKG(
  options: {
    maxInitialNodes?: number
    preferredTypes?: Entity['type'][]
    source?: 'auto' | 'neo4j' | 'qdrant' | 'postgresql'
  } = {}
): Promise<KnowledgeGraphResult> {
  const { maxInitialNodes = 200, preferredTypes = ['CONCEPT'], source = 'auto' } = options
  let data: KnowledgeGraphResult = null
  if (preferredTypes.length > 0) {
    data = await loadByEntityType(preferredTypes[0], maxInitialNodes)
  }
  if (!data || !data.knowledge_graph.entities.length) {
    data = await loadFromHKG(source)
  }
  return data
}
