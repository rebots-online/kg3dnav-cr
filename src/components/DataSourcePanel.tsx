// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useMemo, useState, useRef } from 'react'
import useStore from '../state/store'
import { loadKnowledgeGraphData } from '../state/actions'
import { initializeHKG, loadFromHKG, searchShardedHKG, loadSearchResults, loadByEntityType, loadCenteredSubgraph } from '../services/hkgLoader'

const DATA_SOURCES = {
  AUTO: 'auto',
  NEO4J: 'neo4j',
  QDRANT: 'qdrant',
  POSTGRES: 'postgresql',
  SHARDED_SEARCH: 'sharded_search',
  FILE: 'file',
} as const

export default function DataSourcePanel(): JSX.Element {
  const [activeSource, setActiveSource] = useState<typeof DATA_SOURCES[keyof typeof DATA_SOURCES]>(DATA_SOURCES.AUTO)
  const [status, setStatus] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [lastLoad, setLastLoad] = useState<any>(null)
  const [options, setOptions] = useState({ maxNodes: 200, entityType: 'all', searchQuery: '', centerEntity: '', useShardedSearch: true, shardedSearchTopic: '' })
  const isSidebarOpen = useStore.use.isSidebarOpen()

  useEffect(() => {
    const t = setTimeout(() => void load(DATA_SOURCES.AUTO), 800)
    return () => clearTimeout(t)
  }, [])

  async function load(source: typeof DATA_SOURCES[keyof typeof DATA_SOURCES]) {
    setIsLoading(true)
    setStatus((p) => ({ ...p, [source]: 'connecting' }))
    try {
      let result: any = null
      if (source === DATA_SOURCES.SHARDED_SEARCH && options.shardedSearchTopic) {
        result = await searchShardedHKG(options.shardedSearchTopic, { maxResultsPerShard: Math.floor(options.maxNodes / 3), preferVectorSearch: true, includeAuditTrail: true, coordinateByUUID: true })
      } else if (options.centerEntity) {
        result = await loadCenteredSubgraph(options.centerEntity, 2, options.maxNodes)
      } else if (options.searchQuery && options.useShardedSearch) {
        result = await searchShardedHKG(options.searchQuery, { maxResultsPerShard: Math.floor(options.maxNodes / 3), preferVectorSearch: true, includeAuditTrail: true, coordinateByUUID: true })
      } else if (options.searchQuery) {
        result = await loadSearchResults(options.searchQuery, options.maxNodes)
      } else if (options.entityType !== 'all') {
        result = await loadByEntityType(options.entityType as any, options.maxNodes)
      } else {
        result = await loadFromHKG(source === DATA_SOURCES.AUTO ? 'auto' : (source as any))
      }
      if (result && result.knowledge_graph?.entities?.length) {
        loadKnowledgeGraphData(result)
        setLastLoad(result)
        setStatus((p) => ({ ...p, [source]: 'connected' }))
      } else {
        setStatus((p) => ({ ...p, [source]: 'no_data' }))
      }
    } catch (e) {
      console.error('Data source load error:', e)
      setStatus((p) => ({ ...p, [source]: 'error' }))
    } finally {
      setIsLoading(false)
    }
  }

  const dataSources = useMemo(
    () => [
      { id: DATA_SOURCES.AUTO, name: 'Auto (Try All)', description: 'Automatically load from available sources' },
      { id: DATA_SOURCES.SHARDED_SEARCH, name: 'Sharded Search', description: 'Search across Qdrant→PostgreSQL→Neo4j with UUID coordination' },
      { id: DATA_SOURCES.NEO4J, name: 'Neo4j Graph', description: 'Knowledge graph from Neo4j database' },
      { id: DATA_SOURCES.QDRANT, name: 'Qdrant Vector', description: 'Vector search results from Qdrant' },
      { id: DATA_SOURCES.POSTGRES, name: 'PostgreSQL Audit', description: 'Recent KG activity from audit logs' },
      { id: DATA_SOURCES.FILE, name: 'File Upload', description: 'Upload JSON knowledge graph file' },
    ],
    []
  )

  function statusColor(s?: string) {
    return s === 'connected' ? '#4ECDC4' : s === 'connecting' ? '#F7DC6F' : s === 'error' ? '#FF6B6B' : s === 'no_data' ? '#FFA07A' : '#888'
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        background: 'rgba(0, 0, 0, 0.9)',
        padding: 20,
        borderRadius: 12,
        color: 'white',
        fontSize: 14,
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        minWidth: 320,
        maxWidth: 320,
        zIndex: 1000,
      }}
    >
      <div style={{ marginBottom: 15, fontWeight: 'bold', fontSize: 16, display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: 10 }}>🔗</span>
        hKG Data Sources
      </div>
      <div style={{ marginBottom: 15 }}>
        {dataSources.map((s) => (
          <label
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: 12,
              padding: 10,
              borderRadius: 8,
              cursor: 'pointer',
              background: activeSource === s.id ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
              border: activeSource === s.id ? '1px solid #4ECDC4' : '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              type="radio"
              name="dataSource"
              value={s.id}
              checked={activeSource === s.id}
              onChange={() => {
                setActiveSource(s.id as any)
                if (s.id !== DATA_SOURCES.FILE) void load(s.id as any)
              }}
              style={{ marginRight: 12, marginTop: 2, accentColor: '#4ECDC4' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {s.name}
                {status[s.id] && (
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 11 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor(status[s.id]), marginRight: 6 }} />
                    {status[s.id]}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.3 }}>{s.description}</div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ marginBottom: 15, padding: 12, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>📊 Loading Options</div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Max Nodes: {options.maxNodes}</label>
          <input
            type="range"
            min={50}
            max={1000}
            step={50}
            value={options.maxNodes}
            onChange={(e) => setOptions((p) => ({ ...p, maxNodes: parseInt((e.target as HTMLInputElement).value, 10) }))}
            style={{ width: '100%', accentColor: '#4ECDC4' }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Filter by Type:</label>
          <select
            value={options.entityType}
            onChange={(e) => setOptions((p) => ({ ...p, entityType: (e.target as HTMLSelectElement).value }))}
            style={{ width: '100%', padding: '4px 8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: 'white', fontSize: 12 }}
          >
            <option value="all">All Types</option>
            <option value="CONCEPT">Concepts</option>
            <option value="PERSON">Persons</option>
            <option value="ORGANIZATION">Organizations</option>
            <option value="LOCATION">Locations</option>
            <option value="EVENT">Events</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Search Query:</label>
          <input
            type="text"
            value={options.searchQuery}
            onChange={(e) => setOptions((p) => ({ ...p, searchQuery: (e.target as HTMLInputElement).value }))}
            placeholder="Search entities..."
            style={{ width: '100%', padding: '4px 8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: 'white', fontSize: 12 }}
          />
          <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={options.useShardedSearch}
              onChange={(e) => setOptions((p) => ({ ...p, useShardedSearch: (e.target as HTMLInputElement).checked }))}
              style={{ marginRight: 6, accentColor: '#4ECDC4' }}
            />
            Use Sharded Search (Vector→Audit→Graph coordination)
          </label>
        </div>
        {activeSource === DATA_SOURCES.SHARDED_SEARCH && (
          <div style={{ marginBottom: 10, padding: 8, background: 'rgba(78,205,196,0.1)', borderRadius: 6, border: '1px solid #4ECDC4' }}>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4, fontWeight: 500 }}>🔍 Sharded Search Topic:</label>
            <input
              type="text"
              value={options.shardedSearchTopic}
              onChange={(e) => setOptions((p) => ({ ...p, shardedSearchTopic: (e.target as HTMLInputElement).value }))}
              placeholder="e.g., 'artificial intelligence'..."
              style={{ width: '100%', padding: '6px 8px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, color: 'white', fontSize: 12 }}
            />
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 1.3 }}>
              Searches Qdrant vectors → PostgreSQL audit → coordinates by UUID in Neo4j
            </div>
          </div>
        )}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Center on Entity:</label>
          <input
            type="text"
            value={options.centerEntity}
            onChange={(e) => setOptions((p) => ({ ...p, centerEntity: (e.target as HTMLInputElement).value }))}
            placeholder="Entity name for subgraph..."
            style={{ width: '100%', padding: '4px 8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: 'white', fontSize: 12 }}
          />
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', padding: 10, background: 'rgba(247,220,111,0.1)', borderRadius: 8, border: '1px solid #F7DC6F', marginBottom: 15 }}>
          <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #F7DC6F', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 10 }} />
          Loading hKG data...
        </div>
      )}

      {lastLoad && (
        <div style={{ padding: 10, background: 'rgba(78,205,196,0.1)', borderRadius: 8, border: '1px solid #4ECDC4', fontSize: 12 }}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>Last Load: {lastLoad.metadata?.source}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)' }}>• {lastLoad.knowledge_graph.entities.length} entities</div>
          <div style={{ color: 'rgba(255,255,255,0.8)' }}>• {lastLoad.knowledge_graph.relationships.length} relationships</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 }}>{new Date(lastLoad.metadata?.timestamp || Date.now()).toLocaleTimeString()}</div>
        </div>
      )}

      <button
        onClick={() => void load(activeSource)}
        disabled={isLoading || activeSource === DATA_SOURCES.FILE}
        style={{ width: '100%', marginTop: 15, padding: 10, background: activeSource === DATA_SOURCES.FILE ? 'rgba(255, 255, 255, 0.1)' : '#4ECDC4', border: 'none', borderRadius: 8, color: activeSource === DATA_SOURCES.FILE ? 'rgba(255, 255, 255, 0.5)' : 'black', fontSize: 14, fontWeight: 500, cursor: activeSource === DATA_SOURCES.FILE || isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}
      >
        {isLoading ? 'Loading...' : 'Refresh Data'}
      </button>

      <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`}</style>
    </div>
  )
}

