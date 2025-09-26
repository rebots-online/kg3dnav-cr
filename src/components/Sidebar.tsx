// SPDX-License-Identifier: Apache-2.0
import React, { useMemo, useState } from 'react'
import useStore, {
  useIsSidebarOpen,
  useEntities,
  useHighlightEntities,
  useTargetEntity,
  useSearchQuery,
  useEntityTypeFilter,
} from '../state/store'
import { analyzeEntity, followRelationship, setTargetEntity } from '../state/actions'

function colorFor(type: string) {
  const m: Record<string, string> = {
    PERSON: '#FF6B6B',
    ORGANIZATION: '#4ECDC4',
    LOCATION: '#45B7D1',
    CONCEPT: '#96CEB4',
    EVENT: '#FFEAA7',
    OTHER: '#DDA0DD',
  }
  return m[type] || '#CCCCCC'
}

export default function Sidebar(): JSX.Element | null {
  const isOpen = useIsSidebarOpen()
  const entities = useEntities()
  const highlightEntities = useHighlightEntities()
  const targetEntity = useTargetEntity()
  const searchQuery = useSearchQuery()
  const entityTypeFilter = useEntityTypeFilter()
  const getEntityConnections = (name: string) => useStore.getState().getEntityConnections(name)

  const [sortBy, setSortBy] = useState<'name' | 'type' | 'connections'>('name')

  if (!isOpen) return null

  const filtered = useMemo(() => {
    return entities
      .filter((e) => {
        const matchesSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.description?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = entityTypeFilter === 'all' || e.type === entityTypeFilter
        return matchesSearch && matchesType
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        if (sortBy === 'type') return a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
        const ca = getEntityConnections(a.name).length
        const cb = getEntityConnections(b.name).length
        return cb - ca
      })
  }, [entities, searchQuery, entityTypeFilter, sortBy])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 350,
        height: '100vh',
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(10px)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        padding: 20,
        overflowY: 'auto',
        zIndex: 1000,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'white', fontSize: 18, fontWeight: 'bold', margin: '0 0 10px 0' }}>Knowledge Graph Entities</h2>
        <div style={{ color: '#CCC', fontSize: 14, marginBottom: 15 }}>
          {filtered.length} of {entities.length} entities
          {searchQuery && ` (filtered by "${searchQuery}")`}
          {entityTypeFilter !== 'all' && ` (${entityTypeFilter} only)`}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['name', 'type', 'connections'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              style={{
                background: sortBy === opt ? '#4ECDC4' : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 15,
                padding: '6px 12px',
                color: 'white',
                fontSize: 12,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div style={{ paddingBottom: 100 }}>
        {filtered.length === 0 ? (
          <div style={{ color: '#888', fontSize: 14, textAlign: 'center', marginTop: 50 }}>No entities match current filters</div>
        ) : (
          filtered.map((entity) => {
            const connections = getEntityConnections(entity.name)
            const isTarget = targetEntity === entity.name
            const isHighlighted = highlightEntities.includes(entity.name)
            return (
              <div
                key={entity.name}
                style={{
                  background: isTarget ? 'rgba(78,205,196,0.3)' : isHighlighted ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isTarget ? '#4ECDC4' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 10,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onClick={() => setTargetEntity(entity.name)}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ width: 12, height: 12, backgroundColor: colorFor(entity.type), borderRadius: '50%', marginRight: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontWeight: 'bold', fontSize: 14, marginBottom: 2 }}>{entity.name}</div>
                    <div style={{ color: '#CCC', fontSize: 12 }}>{entity.type} • {connections.length} connections</div>
                  </div>
                </div>
                {entity.description && (
                  <div style={{ color: '#AAA', fontSize: 12, marginBottom: 8, lineHeight: 1.4 }}>{entity.description}</div>
                )}
                {connections.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={(e) => { e.stopPropagation(); analyzeEntity(entity.name) }} style={{ background: 'rgba(78,205,196,0.2)', border: '1px solid #4ECDC4', borderRadius: 15, padding: '4px 8px', color: '#4ECDC4', fontSize: 10, cursor: 'pointer' }}>analyze</button>
                  </div>
                )}
                {connections.length > 0 && (
                  <div style={{ marginTop: 10, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ color: 'white', fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>Relationships:</div>
                    {connections.slice(0, 5).map((rel, idx) => {
                      const target = rel.source === entity.name ? rel.target : rel.source
                      return (
                        <div key={idx} style={{ color: '#CCC', fontSize: 11, marginBottom: 4, cursor: 'pointer', padding: 4, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} onClick={(e) => { e.stopPropagation(); followRelationship(rel.relationship, entity.name, target) }}>
                          <span style={{ color: '#4ECDC4' }}>{rel.relationship}</span>
                          {' → '}
                          <span>{target}</span>
                        </div>
                      )
                    })}
                    {connections.length > 5 && <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>+{connections.length - 5} more relationships</div>}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

