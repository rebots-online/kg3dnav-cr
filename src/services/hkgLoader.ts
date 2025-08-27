// SPDX-License-Identifier: Apache-2.0
import type { Entity, Relationship } from '../types/knowledge'
import { getEnvConfig } from '../config/env'

export type KnowledgeGraphResult = {
  knowledge_graph: { entities: Entity[]; relationships: Relationship[] }
  metadata: any
} | null

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
  const candidates = [HKG_MCP_BASE_URL, 'http://localhost:3000', 'http://localhost:8080', 'http://localhost:7860']
  for (const url of candidates) {
    try {
      const r = await tryFetch(`${url}/health`, { method: 'GET' }, 2000)
      if (r.ok) return url
    } catch (_) {
      // continue
    }
  }
  return null
}

export async function loadFromNeo4j(options: {
  limit?: number
  offset?: number
  entityTypes?: string[]
  searchQuery?: string
  maxConnections?: number
  centerEntity?: string | null
} = {}): Promise<KnowledgeGraphResult> {
  try {
    const base = await findWorkingMCPServer()
    if (!base) throw new Error('No MCP server available')
    const resp = await tryFetch(`${base}/mcp/neo4j/read_graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })
    if (!resp.ok) throw new Error(`Neo4j request failed: ${resp.status}`)
    const graphData = await resp.json()
    const entities: Entity[] = (graphData.entities || []).map((e: any) => ({
      name: e.name,
      type: e.entityType || 'OTHER',
      description: Array.isArray(e.observations) ? e.observations.join('; ') : e.name,
      uuid: e.uuid,
    }))
    const relationships: Relationship[] = (graphData.relationships || []).map((r: any) => ({
      source: r.from,
      target: r.to,
      relationship: r.relationType,
      uuid: r.uuid,
    }))
    return {
      knowledge_graph: { entities, relationships },
      metadata: {
        source: 'neo4j',
        timestamp: new Date().toISOString(),
        entity_count: entities.length,
        relationship_count: relationships.length,
        query_params: options,
        has_more: entities.length === (options.limit || 0),
        total_available: graphData.totalCount || entities.length,
      },
    }
  } catch (e) {
    console.error('Failed to load from Neo4j:', e)
    return null
  }
}

export async function loadFromQdrant(searchQuery = 'knowledge graph entities'): Promise<KnowledgeGraphResult> {
  try {
    const base = await findWorkingMCPServer()
    if (!base) throw new Error('No MCP server available')
    const resp = await tryFetch(`${base}/mcp/qdrant/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery }),
    })
    if (!resp.ok) throw new Error(`Qdrant request failed: ${resp.status}`)
    const data = await resp.json()
    const entities: Entity[] = []
    const relationships: Relationship[] = []
    ;(data || []).forEach((result: any) => {
      if (result?.metadata) {
        if (Array.isArray(result.metadata.entities)) entities.push(...result.metadata.entities)
        if (Array.isArray(result.metadata.relationships)) relationships.push(...result.metadata.relationships)
        if (result.metadata.entity_name) {
          entities.push({
            name: result.metadata.entity_name,
            type: result.metadata.entity_type || 'CONCEPT',
            description: result.information || result.metadata.description || '',
          })
        }
      }
    })
    return {
      knowledge_graph: { entities, relationships },
      metadata: {
        source: 'qdrant',
        search_query: searchQuery,
        timestamp: new Date().toISOString(),
        entity_count: entities.length,
        relationship_count: relationships.length,
      },
    }
  } catch (e) {
    console.error('Failed to load from Qdrant:', e)
    return null
  }
}

export async function loadFromPostgreSQL(): Promise<KnowledgeGraphResult> {
  try {
    const base = await findWorkingMCPServer()
    if (!base) throw new Error('No MCP server available')
    const resp = await tryFetch(`${base}/mcp/postgres/query_audit_logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'knowledge_graph_creation',
        limit: 50,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    })
    if (!resp.ok) throw new Error(`PostgreSQL request failed: ${resp.status}`)
    const auditLogs = await resp.json()
    const entities: Entity[] = []
    const relationships: Relationship[] = []
    ;(auditLogs || []).forEach((log: any) => {
      const kg = log?.metadata?.knowledge_graph
      if (kg?.entities) entities.push(...kg.entities)
      if (kg?.relationships) relationships.push(...kg.relationships)
    })
    return {
      knowledge_graph: { entities, relationships },
      metadata: {
        source: 'postgresql',
        audit_entries: Array.isArray(auditLogs) ? auditLogs.length : 0,
        timestamp: new Date().toISOString(),
        entity_count: entities.length,
        relationship_count: relationships.length,
      },
    }
  } catch (e) {
    console.error('Failed to load from PostgreSQL:', e)
    return null
  }
}

export async function loadFromHKG(dataSource: 'auto' | 'neo4j' | 'qdrant' | 'postgresql' = 'auto'): Promise<KnowledgeGraphResult> {
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

export async function loadCenteredSubgraph(centerEntity: string, maxDepth = 2, maxNodes = 200): Promise<KnowledgeGraphResult> {
  const result = await loadFromNeo4j({
    centerEntity,
    limit: maxNodes,
    maxConnections: Math.floor(maxNodes / 4),
  })
  if (result) {
    ;(result as any).metadata.view_type = 'centered_subgraph'
    ;(result as any).metadata.center_entity = centerEntity
    ;(result as any).metadata.max_depth = maxDepth
  }
  return result
}

export async function loadByEntityType(entityType: Entity['type'], limit = 300, offset = 0): Promise<KnowledgeGraphResult> {
  const result = await loadFromNeo4j({ entityTypes: [entityType], limit, offset, maxConnections: 30 })
  if (result) {
    ;(result as any).metadata.view_type = 'entity_type_view'
    ;(result as any).metadata.filtered_type = entityType
  }
  return result
}

export async function loadSearchResults(searchQuery: string, limit = 100): Promise<KnowledgeGraphResult> {
  const result = await loadFromNeo4j({ searchQuery, limit, maxConnections: 20 })
  if (result) {
    ;(result as any).metadata.view_type = 'search_results'
    ;(result as any).metadata.search_query = searchQuery
  }
  return result
}

export async function searchShardedHKG(searchTopic: string, options: {
  maxResultsPerShard?: number
  preferVectorSearch?: boolean
  includeAuditTrail?: boolean
  coordinateByUUID?: boolean
  shardTimeout?: number
} = {}): Promise<KnowledgeGraphResult> {
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
  let vectorResults: any[] = []
  let auditResults: any[] = []

  if (preferVectorSearch) {
    try {
      const qRes = await Promise.race([
        tryFetch(`${base}/mcp/qdrant/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchTopic, limit: maxResultsPerShard, similarity_threshold: 0.7 }),
        }),
        new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Qdrant timeout')), shardTimeout)),
      ])
      if (qRes.ok) {
        const qData = await qRes.json()
        vectorResults = qData.map((r: any) => ({ uuid: r?.metadata?.uuid || r?.id, ...r }))
        vectorResults.forEach((r) => r.uuid && vectorUUIDs.add(r.uuid))
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
          body: JSON.stringify({ action: 'knowledge_graph_creation', content: searchTopic, limit: maxResultsPerShard, startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }),
        }),
        new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('PostgreSQL timeout')), shardTimeout)),
      ])
      if (aRes.ok) {
        const aData = await aRes.json()
        auditResults = aData
          .map((log: any) => ({ uuid: log?.metadata?.uuid || log?.metadata?.knowledge_graph?.uuid, ...log }))
          .filter((r: any) => r.uuid)
        auditResults.forEach((r: any) => auditUUIDs.add(r.uuid))
      }
    } catch (e) {
      console.warn('PostgreSQL audit search failed:', (e as Error).message)
    }
  }

  let coordinatedEntities: Entity[] = []
  let coordinatedRelationships: Relationship[] = []

  if (coordinateByUUID) {
    const uuids = [...new Set([...vectorUUIDs, ...auditUUIDs])]
    if (uuids.length > 0) {
      try {
        const nRes = await tryFetch(`${base}/mcp/neo4j/search_nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchTopic, uuids, include_connected: true, max_depth: 2, limit: maxResultsPerShard * 2 }),
        })
        if (nRes.ok) {
          const nData = await nRes.json()
          coordinatedEntities = (nData.entities || []).map((e: any) => ({
            uuid: e.uuid,
            name: e.name,
            type: e.entityType || 'OTHER',
            description: Array.isArray(e.observations) ? e.observations.join('; ') : e.name,
            searchRelevance: uuids.includes(e.uuid) ? 'uuid_coordinated' : 'connected',
            vectorMatch: vectorUUIDs.has(e.uuid),
            auditMatch: auditUUIDs.has(e.uuid),
          }))
          coordinatedRelationships = (nData.relationships || []).map((r: any) => ({
            source: r.from,
            target: r.to,
            relationship: r.relationType,
            uuid: r.uuid,
          }))
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
        const fData = await fb.json()
        const fallbackEntities: Entity[] = (fData.entities || []).map((e: any) => ({
          uuid: e.uuid,
          name: e.name,
          type: e.entityType || 'OTHER',
          description: Array.isArray(e.observations) ? e.observations.join('; ') : e.name,
          searchRelevance: 'text_search',
        }))
        const known = new Set(coordinatedEntities.map((e) => e.uuid))
        coordinatedEntities.push(...fallbackEntities.filter((e) => !e.uuid || !known.has(e.uuid)))
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
    },
  }
}

export async function initializeHKG(options: { maxInitialNodes?: number; preferredTypes?: Entity['type'][]; source?: 'auto' | 'neo4j' | 'qdrant' | 'postgresql' } = {}): Promise<KnowledgeGraphResult> {
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

