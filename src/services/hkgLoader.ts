// SPDX-License-Identifier: Apache-2.0
import type { Driver, Session } from 'neo4j-driver'
import type { Entity, Relationship } from '../types/knowledge'
import { getEnvConfig } from '../config/env'
import useSettingsStore, {
  ConnectionMode,
  DEFAULT_SERVICE_ENDPOINTS,
  getServiceConfigSnapshot,
  MCP_DEFAULT,
  normalizeNeo4jUri,
} from '../state/settingsStore'
import { logDebug, logError, logInfo, logWarn } from '../state/logStore'

type Neo4jDriverModule = typeof import('neo4j-driver')

let cachedNeo4jModule: Neo4jDriverModule | null = null

function describeError(error: unknown) {
  if (error instanceof Error) {
    const payload: Record<string, unknown> = {
      message: error.message,
    }
    if (typeof (error as { code?: unknown }).code === 'string') {
      payload.code = (error as { code?: string }).code
    }
    if (error.stack) payload.stack = error.stack
    return payload
  }
  return { message: String(error) }
}

async function loadNeo4jDriver(context: { endpoint: string }): Promise<Neo4jDriverModule | null> {
  if (cachedNeo4jModule) return cachedNeo4jModule
  try {
    logDebug('neo4j', 'Attempting dynamic import of neo4j-driver', {
      endpoint: context.endpoint,
    })
    const specifier = 'neo4j-driver'
    const mod = await import(/* @vite-ignore */ specifier)
    cachedNeo4jModule = mod
    logDebug('neo4j', 'neo4j-driver module loaded', { endpoint: context.endpoint })
    return mod
  } catch (error) {
    const detail = describeError(error)
    logError('neo4j', 'Failed to load neo4j-driver module', {
      endpoint: context.endpoint,
      ...detail,
      suggestion: 'Ensure desktop build dependencies are installed or use MCP fallback',
    })
    return null
  }
}

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
  description?: string
  spatial_media?: Entity['spatial_media']
  elementId?: string
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

function deriveHttpEndpointFromBolt(boltEndpoint: string): string | null {
  try {
    const httpCandidate = boltEndpoint.replace(/^bolt(\+s)?/i, 'http$1')
    const url = new URL(httpCandidate)
    if (!url.port) {
      url.port = url.protocol === 'https:' ? '7473' : '7474'
    } else if (url.port === '7687') {
      url.port = url.protocol === 'https:' ? '7473' : '7474'
    }
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch (_) {
    return null
  }
}

async function attemptNeo4jHttpPing(boltEndpoint: string) {
  const httpEndpoint = deriveHttpEndpointFromBolt(boltEndpoint)
  if (!httpEndpoint) return
  try {
    logDebug('neo4j', 'Attempting Neo4j HTTP ping', { endpoint: httpEndpoint })
    const response = await tryFetch(httpEndpoint, { method: 'GET' }, 3000)
    logInfo('neo4j', 'Neo4j HTTP ping response', {
      endpoint: httpEndpoint,
      status: response.status,
      ok: response.ok,
    })
  } catch (error) {
    logError('neo4j', 'Neo4j HTTP ping failed', {
      endpoint: httpEndpoint,
      ...describeError(error),
    })
  }
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

async function createNeo4jDriver(
  uri: string,
  username: string | undefined,
  password: string | undefined
): Promise<Driver> {
  const neo4j = await loadNeo4jDriver({ endpoint: uri })
  if (!neo4j) {
    throw new Error('neo4j-driver module is unavailable in this runtime')
  }
  const user = typeof username === 'string' ? username : ''
  const pass = typeof password === 'string' ? password : ''
  const authToken = neo4j.auth.basic(user, pass)
  return neo4j.driver(uri, authToken, { disableLosslessIntegers: true })
}

async function verifyNeo4jConnectivity(driver: Driver, endpoint: string, timeoutMs = 5000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      driver.verifyConnectivity(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out verifying connectivity to ${endpoint}`)),
          timeoutMs
        )
      }),
    ])
  } finally {
    if (typeof timer !== 'undefined') {
      clearTimeout(timer)
    }
  }
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
  logDebug('mcp', 'Searching for MCP server', { candidates })
  for (const url of candidates) {
    if (seen.has(url)) continue
    seen.add(url)
    logDebug('mcp', 'Checking MCP /health', { url })
    try {
      const r = await tryFetch(`${url}/health`, { method: 'GET' }, 2000)
      if (r.ok) {
        logInfo('mcp', 'Found responsive MCP server', { url })
        return url
      }
      logWarn('mcp', 'MCP health check returned non-200', { url, status: r.status })
    } catch (err) {
      logWarn('mcp', 'MCP health check failed', {
        url,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  logWarn('mcp', 'Unable to locate MCP server', { attempted: Array.from(seen.values()) })
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
  const rawBolt = sanitizeBaseUrl(serviceConfig.baseUrl) ?? DEFAULT_SERVICE_ENDPOINTS.neo4j
  const boltEndpoint = normalizeNeo4jUri(rawBolt)
  if (!boltEndpoint) {
    logError('neo4j', 'Neo4j Bolt endpoint is not configured', {})
    return null
  }

  const username = typeof serviceConfig.username === 'string' ? serviceConfig.username.trim() : ''
  const password = typeof serviceConfig.password === 'string' ? serviceConfig.password.trim() : ''
  const database =
    typeof serviceConfig.database === 'string' && serviceConfig.database.trim().length > 0
      ? serviceConfig.database.trim()
      : 'neo4j'

  const sanitizedOptions = {
    limit: options.limit ?? null,
    offset: options.offset ?? null,
    entityTypes: Array.isArray(options.entityTypes) ? options.entityTypes : null,
    searchQuery: options.searchQuery ?? null,
    centerEntity: options.centerEntity ?? null,
    maxConnections: options.maxConnections ?? null,
  }
  logInfo('neo4j', 'Initializing Neo4j graph load', {
    endpoint: boltEndpoint,
    database,
    mode: settings.mode,
    options: sanitizedOptions,
  })

  let driver: Driver | null = null
  let session: Session | null = null

  try {
    driver = await createNeo4jDriver(boltEndpoint, username, password)
    logDebug('neo4j', 'Neo4j driver instantiated', { endpoint: boltEndpoint })
    logInfo('neo4j', 'Verifying Neo4j connectivity', {
      endpoint: boltEndpoint,
      username: username || null,
    })
    await verifyNeo4jConnectivity(driver, boltEndpoint)
    logInfo('neo4j', 'Neo4j connectivity verified', { endpoint: boltEndpoint })
    session = driver.session({ database })
    logDebug('neo4j', 'Neo4j session opened', { endpoint: boltEndpoint, database })

    const limit =
      typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0
        ? Math.floor(options.limit)
        : 200
    const offset =
      typeof options.offset === 'number' && Number.isFinite(options.offset) && options.offset > 0
        ? Math.floor(options.offset)
        : 0
    const normalizedEntityTypes = Array.isArray(options.entityTypes)
      ? options.entityTypes
          .map((type) => (typeof type === 'string' ? type.trim().toUpperCase() : null))
          .filter((type): type is string => Boolean(type))
      : []
    const searchQuery =
      typeof options.searchQuery === 'string' && options.searchQuery.trim().length > 0
        ? options.searchQuery.trim()
        : null
    const centerEntity =
      typeof options.centerEntity === 'string' && options.centerEntity.trim().length > 0
        ? options.centerEntity.trim()
        : null
    const explicitMaxConnections =
      typeof options.maxConnections === 'number' && Number.isFinite(options.maxConnections)
        ? Math.max(0, Math.floor(options.maxConnections))
        : null

    const nodeFilters: string[] = []
    if (normalizedEntityTypes.length > 0) {
      nodeFilters.push(
        'ANY(type IN $entityTypes WHERE type = toUpper(COALESCE(n.entityType, head(labels(n)))))'
      )
    }
    if (searchQuery) {
      nodeFilters.push('toLower(n.name) CONTAINS toLower($searchQuery)')
    }
    if (centerEntity) {
      nodeFilters.push('(n.name = $centerEntity OR EXISTS { MATCH (n)-[*1..2]-(c { name: $centerEntity }) })')
    }
    const whereClause = nodeFilters.length > 0 ? `WHERE ${nodeFilters.join(' AND ')}` : ''

    const nodeResult = await session.run(
      `
        MATCH (n)
        ${whereClause}
        RETURN {
          elementId: elementId(n),
          name: COALESCE(n.name, elementId(n)),
          entityType: toUpper(COALESCE(n.entityType, head(labels(n)))),
          description: n.description,
          observations: n.observations,
          uuid: COALESCE(n.uuid, elementId(n)),
          spatial_media: n.spatial_media
        } AS node
        SKIP $offset
        LIMIT $limit
      `,
      {
        limit,
        offset,
        entityTypes: normalizedEntityTypes.length > 0 ? normalizedEntityTypes : null,
        searchQuery,
        centerEntity,
      }
    )

    const rawNodes = nodeResult.records
      .map((record) => record.get('node'))
      .filter((node): node is Record<string, unknown> => isPlainObject(node))

    const idToName = new Map<string, string>()
    const entities: RawNeo4jEntity[] = rawNodes.map((node) => {
      const elementId = typeof node.elementId === 'string' ? node.elementId : undefined
      const name = typeof node.name === 'string' ? node.name : elementId
      if (elementId && name) idToName.set(elementId, name)
      const entityType =
        typeof node.entityType === 'string' && node.entityType.length > 0 ? node.entityType : undefined
      const description = typeof node.description === 'string' ? node.description : undefined
      const uuid = typeof node.uuid === 'string' ? node.uuid : elementId
      const observations = node.observations
      const spatialMedia = isPlainObject(node.spatial_media)
        ? (node.spatial_media as Entity['spatial_media'])
        : undefined
      return {
        name: name ?? 'Unknown',
        entityType,
        description,
        observations,
        uuid: uuid ?? undefined,
        spatial_media: spatialMedia,
        elementId,
      }
    })

    const nodeIds = entities
      .map((entity) => entity.elementId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    const relationshipLimit =
      explicitMaxConnections !== null && explicitMaxConnections > 0
        ? explicitMaxConnections
        : Math.max(nodeIds.length * 4, 100)

    logDebug('neo4j', 'Resolved Neo4j query parameters', {
      endpoint: boltEndpoint,
      limit,
      offset,
      entityTypes: normalizedEntityTypes,
      searchQuery,
      centerEntity,
      requestedMaxConnections: options.maxConnections ?? null,
      appliedMaxConnections: relationshipLimit,
    })

    let relationships: RawNeo4jRelationship[] = []
    if (nodeIds.length > 0) {
      const relationshipResult = await session.run(
        `
          MATCH (n)-[r]-(m)
          WHERE elementId(n) IN $nodeIds AND elementId(m) IN $nodeIds
          RETURN {
            sourceId: elementId(n),
            targetId: elementId(m),
            relationType: type(r),
            uuid: COALESCE(r.uuid, elementId(r)),
            sourceName: COALESCE(n.name, elementId(n)),
            targetName: COALESCE(m.name, elementId(m))
          } AS relationship
          LIMIT $maxConnections
        `,
        { nodeIds, maxConnections: relationshipLimit }
      )

      relationships = relationshipResult.records
        .map((record) => record.get('relationship'))
        .filter((rel): rel is Record<string, unknown> => isPlainObject(rel))
        .map((rel) => {
          const sourceId = typeof rel.sourceId === 'string' ? rel.sourceId : undefined
          const targetId = typeof rel.targetId === 'string' ? rel.targetId : undefined
          const fromName =
            typeof rel.sourceName === 'string'
              ? rel.sourceName
              : sourceId
                ? idToName.get(sourceId)
                : undefined
          const toName =
            typeof rel.targetName === 'string'
              ? rel.targetName
              : targetId
                ? idToName.get(targetId)
                : undefined
          const relationType =
            typeof rel.relationType === 'string' && rel.relationType.length > 0
              ? rel.relationType
              : 'RELATED_TO'
          const uuid = typeof rel.uuid === 'string' ? rel.uuid : undefined
          return {
            from: fromName,
            to: toName,
            relationType,
            uuid,
          }
        })
        .filter((rel): rel is RawNeo4jRelationship => Boolean(rel.from && rel.to))
    }

    const rawGraph: RawNeo4jGraph = {
      entities,
      relationships,
      totalCount: entities.length,
    }

    const result = mapNeo4jGraph(rawGraph, options, settings.mode, boltEndpoint)
    if (result) {
      logInfo('neo4j', 'Neo4j load succeeded', {
        endpoint: boltEndpoint,
        entities: result.knowledge_graph.entities.length,
        relationships: result.knowledge_graph.relationships.length,
        mode: settings.mode,
      })
    } else {
      logWarn('neo4j', 'Neo4j load returned empty result', { endpoint: boltEndpoint })
    }
    return result
  } catch (error) {
    const detail = describeError(error)
    logError('neo4j', 'Neo4j load failed', {
      endpoint: boltEndpoint,
      ...detail,
      suggestion: 'Falling back to MCP /mcp/neo4j/search_nodes',
    })
    await attemptNeo4jHttpPing(boltEndpoint)
    return null
  } finally {
    try {
      await session?.close()
    } catch (closeError) {
      logWarn('neo4j', 'Failed closing Neo4j session', {
        endpoint: boltEndpoint,
        ...describeError(closeError),
      })
    }
    try {
      await driver?.close()
    } catch (closeError) {
      logWarn('neo4j', 'Failed closing Neo4j driver', {
        endpoint: boltEndpoint,
        ...describeError(closeError),
      })
    }
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

  logInfo('qdrant', 'Loading Qdrant knowledge graph slice', {
    searchQuery,
    mode: settings.mode,
    perServiceEndpoint: perServiceBase ?? null,
  })

  if (perServiceBase) {
    const endpoint = `${perServiceBase}/mcp/qdrant/find`
    try {
      logDebug('qdrant', 'Issuing per-service Qdrant request', { endpoint, searchQuery })
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
      const result = mapQdrantResults(data, searchQuery, 'perService', endpoint)
      if (result) {
        logInfo('qdrant', 'Qdrant per-service load succeeded', {
          endpoint,
          entities: result.knowledge_graph.entities.length,
          relationships: result.knowledge_graph.relationships.length,
        })
      }
      return result
    } catch (err) {
      logWarn('qdrant', 'Qdrant per-service fetch failed', {
        endpoint,
        error: err instanceof Error ? err.message : String(err),
      })
      console.warn('Qdrant per-service fetch failed:', err)
    }
  }

  try {
    const base = await findWorkingMCPServer()
    if (!base) throw new Error('No MCP server available')
    const endpoint = `${base}/mcp/qdrant/find`
    logDebug('qdrant', 'Issuing MCP Qdrant request', { endpoint, searchQuery })
    const resp = await tryFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery }),
    })
    if (!resp.ok) throw new Error(`Qdrant request failed: ${resp.status}`)
    const data = (await resp.json()) as RawQdrantResult[]
    const result = mapQdrantResults(data, searchQuery, 'unified', endpoint)
    if (result) {
      logInfo('qdrant', 'Qdrant unified load succeeded', {
        endpoint,
        entities: result.knowledge_graph.entities.length,
        relationships: result.knowledge_graph.relationships.length,
      })
    }
    return result
  } catch (e) {
    logError('qdrant', 'Failed to load from Qdrant', {
      searchQuery,
      error: e instanceof Error ? e.message : String(e),
    })
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

  logInfo('postgres', 'Loading recent audit trail knowledge graph', {
    mode: settings.mode,
    perServiceEndpoint: perServiceBase ?? null,
  })

  if (perServiceBase) {
    const endpoint = `${perServiceBase}/mcp/postgres/query_audit_logs`
    try {
      logDebug('postgres', 'Issuing per-service Postgres request', { endpoint })
      const resp = await tryFetch(endpoint, { method: 'POST', headers, body }, 8000)
      if (!resp.ok) throw new Error(`PostgreSQL request failed: ${resp.status}`)
      const auditLogs = (await resp.json()) as RawPostgresLog[]
      const result = mapPostgresResults(auditLogs, 'perService', endpoint)
      if (result) {
        logInfo('postgres', 'Postgres per-service load succeeded', {
          endpoint,
          entities: result.knowledge_graph.entities.length,
          relationships: result.knowledge_graph.relationships.length,
        })
      }
      return result
    } catch (err) {
      logWarn('postgres', 'Postgres per-service fetch failed', {
        endpoint,
        error: err instanceof Error ? err.message : String(err),
      })
      console.warn('PostgreSQL per-service fetch failed:', err)
    }
  }

  try {
    const base = await findWorkingMCPServer()
    if (!base) throw new Error('No MCP server available')
    const endpoint = `${base}/mcp/postgres/query_audit_logs`
    logDebug('postgres', 'Issuing MCP Postgres request', { endpoint })
    const resp = await tryFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!resp.ok) throw new Error(`PostgreSQL request failed: ${resp.status}`)
    const auditLogs = (await resp.json()) as RawPostgresLog[]
    const result = mapPostgresResults(auditLogs, 'unified', endpoint)
    if (result) {
      logInfo('postgres', 'Postgres unified load succeeded', {
        endpoint,
        entities: result.knowledge_graph.entities.length,
        relationships: result.knowledge_graph.relationships.length,
      })
    }
    return result
  } catch (e) {
    logError('postgres', 'Failed to load from PostgreSQL', {
      error: e instanceof Error ? e.message : String(e),
    })
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
  logInfo('hkg', 'Loading knowledge graph via requested source', { dataSource })
  switch (dataSource) {
    case 'neo4j':
      return loadFromNeo4j()
    case 'qdrant':
      return loadFromQdrant()
    case 'postgresql':
      return loadFromPostgreSQL()
    case 'auto':
    default: {
      logDebug('hkg', 'Auto mode attempting Neo4j first', {})
      let r = await loadFromNeo4j({ limit: 500 })
      if (!r || !r.knowledge_graph.entities.length) {
        logWarn('hkg', 'Neo4j auto load returned no entities — falling back to Qdrant', {})
        r = await loadFromQdrant()
      }
      if (!r || !r.knowledge_graph.entities.length) {
        logWarn('hkg', 'Qdrant auto load returned no entities — falling back to PostgreSQL', {})
        r = await loadFromPostgreSQL()
      }
      if (r) {
        logInfo('hkg', 'Auto mode load completed', {
          entities: r.knowledge_graph.entities.length,
          relationships: r.knowledge_graph.relationships.length,
          source: r.metadata?.source ?? 'unknown',
        })
      } else {
        logError('hkg', 'Auto mode failed to load knowledge graph', {})
      }
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
  if (!base) {
    logError('sharded-hkg', 'No MCP server available for sharded search', { searchTopic })
    return null
  }

  logInfo('sharded-hkg', 'Executing sharded HKG search', {
    searchTopic,
    maxResultsPerShard,
    preferVectorSearch,
    includeAuditTrail,
    coordinateByUUID,
    shardTimeout,
    base,
  })

  const vectorUUIDs = new Set<string>()
  const auditUUIDs = new Set<string>()
  let vectorResults: VectorSearchResult[] = []
  let auditResults: AuditSearchResult[] = []

  if (preferVectorSearch) {
    try {
      logDebug('sharded-hkg', 'Starting Qdrant shard search', { base, searchTopic, maxResultsPerShard })
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
        logInfo('sharded-hkg', 'Qdrant shard search completed', {
          base,
          results: vectorResults.length,
          uniqueUUIDs: vectorUUIDs.size,
        })
      }
    } catch (e) {
      logWarn('sharded-hkg', 'Qdrant vector search failed', {
        error: e instanceof Error ? e.message : String(e),
      })
      console.warn('Qdrant vector search failed:', (e as Error).message)
    }
  }

  if (includeAuditTrail) {
    try {
      logDebug('sharded-hkg', 'Starting PostgreSQL audit shard search', {
        base,
        searchTopic,
        maxResultsPerShard,
      })
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
        logInfo('sharded-hkg', 'PostgreSQL audit shard search completed', {
          base,
          results: auditResults.length,
          uniqueUUIDs: auditUUIDs.size,
        })
      }
    } catch (e) {
      logWarn('sharded-hkg', 'PostgreSQL audit search failed', {
        error: e instanceof Error ? e.message : String(e),
      })
      console.warn('PostgreSQL audit search failed:', (e as Error).message)
    }
  }

  let coordinatedEntities: Entity[] = []
  let coordinatedRelationships: Relationship[] = []

  if (coordinateByUUID) {
    const uuids = Array.from(new Set<string>([...vectorUUIDs.values(), ...auditUUIDs.values()]))
    if (uuids.length > 0) {
      try {
        logDebug('sharded-hkg', 'Coordinating Neo4j entities for shard results', {
          base,
          uuids: uuids.length,
          searchTopic,
        })
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
          logInfo('sharded-hkg', 'Neo4j coordination completed', {
            entities: coordinatedEntities.length,
            relationships: coordinatedRelationships.length,
          })
        }
      } catch (e) {
        logWarn('sharded-hkg', 'Neo4j coordination failed', {
          error: e instanceof Error ? e.message : String(e),
        })
        console.warn('Neo4j coordination failed:', (e as Error).message)
      }
    }
  }

  if (coordinatedEntities.length < 10) {
    try {
      logDebug('sharded-hkg', 'Executing fallback Neo4j search', {
        base,
        searchTopic,
        maxResultsPerShard,
      })
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
        logInfo('sharded-hkg', 'Fallback Neo4j search added entities', {
          fallbackEntities: fallbackEntities.length,
          totalEntities: coordinatedEntities.length,
        })
      }
    } catch (e) {
      logWarn('sharded-hkg', 'Fallback Neo4j search failed', {
        error: e instanceof Error ? e.message : String(e),
      })
      console.warn('Fallback Neo4j search failed:', (e as Error).message)
    }
  }

  const result: KnowledgeGraphResult = {
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
  logInfo('sharded-hkg', 'Sharded HKG search completed', {
    entities: result.knowledge_graph.entities.length,
    relationships: result.knowledge_graph.relationships.length,
    vectorResults: vectorResults.length,
    auditResults: auditResults.length,
  })
  return result
}
export async function initializeHKG(
  options: {
    maxInitialNodes?: number
    preferredTypes?: Entity['type'][]
    source?: 'auto' | 'neo4j' | 'qdrant' | 'postgresql'
  } = {}
): Promise<KnowledgeGraphResult> {
  const { maxInitialNodes = 200, preferredTypes = ['CONCEPT'], source = 'auto' } = options
  logInfo('hkg', 'Initializing HKG', {
    maxInitialNodes,
    preferredTypes,
    source,
  })
  let data: KnowledgeGraphResult = null
  if (preferredTypes.length > 0) {
    logDebug('hkg', 'Attempting preferred type bootstrap', {
      type: preferredTypes[0],
      limit: maxInitialNodes,
    })
    data = await loadByEntityType(preferredTypes[0], maxInitialNodes)
  }
  if (!data || !data.knowledge_graph.entities.length) {
    logWarn('hkg', 'Preferred type bootstrap empty, falling back to general load', {})
    data = await loadFromHKG(source)
  }
  if (data) {
    logInfo('hkg', 'HKG initialization complete', {
      entities: data.knowledge_graph.entities.length,
      relationships: data.knowledge_graph.relationships.length,
      source: data.metadata?.source ?? 'unknown',
    })
  }
  return data
}
