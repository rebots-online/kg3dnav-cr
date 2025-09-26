// SPDX-License-Identifier: Apache-2.0
import useStore from './store'
import type { Entity, Relationship, Layout } from '../types/knowledge'

// Layout actions
export const setLayout = (layout: Layout) => {
  const s = useStore.getState()
  s.setLayout(layout)
  s.generateEntityPositions()
  s.setResetCam(true)
}

// Entity selection and highlighting
export const setTargetEntity = (entityName: string | null) => {
  const s = useStore.getState()
  s.setTargetEntity(entityName)
  if (entityName) {
    const entity = s.entities.find((e) => e.name === entityName)
    if (entity) {
      const description = entity.description || `${entity.type} entity`
      const connections = s.getEntityConnections(entityName).length
      s.setCaption(`${entity.name} (${entity.type}) - ${connections} connections - ${description}`)
    }
  } else {
    s.setCaption('')
  }
}

// Search and filtering
export const sendQuery = (query: string) => {
  const s = useStore.getState()
  s.setSearchQuery(query)
  s.setFetching(true)
  const matchingEntities = s.entities
    .filter(
      (entity) =>
        entity.name.toLowerCase().includes(query.toLowerCase()) ||
        (entity.description?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
        entity.type.toLowerCase().includes(query.toLowerCase())
    )
    .map((e) => e.name)

  const related = new Set(matchingEntities)
  matchingEntities.forEach((name) => s.getRelatedEntities(name).forEach((r) => related.add(r)))
  s.setHighlightEntities([...related])
  setTimeout(() => s.setFetching(false), 300)
}

export const clearQuery = () => {
  const s = useStore.getState()
  s.setSearchQuery('')
  s.setHighlightEntities([])
  s.setTargetEntity(null)
  s.setCaption('')
}

// X-ray mode toggle
export const setXRayMode = (enabled: boolean) => useStore.getState().setXRayMode(enabled)

// Sidebar toggle
export const toggleSidebar = () => {
  const s = useStore.getState()
  s.setSidebarOpen(!s.isSidebarOpen)
}

// Entity type filtering
export const setEntityTypeFilter = (entityType: 'all' | Entity['type']) => {
  const s = useStore.getState()
  s.setEntityTypeFilter(entityType)
  if (entityType !== 'all') {
    const filtered = s.entities.filter((e) => e.type === entityType).map((e) => e.name)
    s.setHighlightEntities(filtered)
  } else {
    s.setHighlightEntities([])
  }
}

// Rich media actions
export const enterRichMediaMode = (entityName: string) => {
  const s = useStore.getState()
  const entity = s.entities.find((e) => e.name === entityName)
  if (entity?.spatial_media?.has_3d_scene) {
    s.setRichMediaMode(true)
    s.setActiveScene(entity.spatial_media)
    s.setCaption(`Exploring 3D scene: ${entityName}`)
  }
}

export const exitRichMediaMode = () => {
  const s = useStore.getState()
  s.setRichMediaMode(false)
  s.setActiveScene(null)
  s.setCaption('')
}

// Relationship navigation
export const followRelationship = (relationshipType: string, fromEntity: string, toEntity: string) => {
  const s = useStore.getState()
  s.setHighlightEntities([fromEntity, toEntity])
  s.setTargetEntity(toEntity)
  s.setCaption(`Following ${relationshipType}: ${fromEntity} → ${toEntity}`)
}

// Knowledge graph loading
export const loadKnowledgeGraphData = (payload: {
  knowledge_graph: { entities: Entity[]; relationships: Relationship[] }
  metadata?: Record<string, unknown>
}) => {
  const s = useStore.getState()
  s.setFetching(true)
  try {
    s.loadKnowledgeGraph(payload)
    s.setCaption(
      `Loaded ${s.entities.length} entities and ${s.relationships.length} relationships` // uses current state after load
    )
  } catch (err) {
    console.error('Error loading knowledge graph:', err)
    s.setCaption('Error loading knowledge graph data')
  } finally {
    s.setFetching(false)
  }
}

// Camera and navigation
export const resetCamera = () => {
  const s = useStore.getState()
  s.setTargetEntity(null)
  s.setResetCam(true)
  s.setCaption('')
}

// Entity analysis
export const analyzeEntity = (entityName: string) => {
  const s = useStore.getState()
  const entity = s.entities.find((e) => e.name === entityName)
  if (entity) {
    const connections = s.getEntityConnections(entityName)
    const related = s.getRelatedEntities(entityName)
    s.setHighlightEntities([entityName, ...related])
    s.setTargetEntity(entityName)
    const analysisText = [
      `${entity.name} (${entity.type})`,
      entity.description || 'No description available',
      `Connected to ${related.length} other entities`,
      `Relationships: ${connections.map((r) => r.relationship).join(', ')}`,
    ].join(' | ')
    s.setCaption(analysisText)
  }
}

// Bulk operations
export const highlightEntityType = (entityType: Entity['type']) => {
  const s = useStore.getState()
  const names = s.entities.filter((e) => e.type === entityType).map((e) => e.name)
  s.setHighlightEntities(names)
  s.setCaption(`Highlighting all ${entityType} entities (${names.length} total)`)
}

export const clearAllHighlights = () => {
  const s = useStore.getState()
  s.setHighlightEntities([])
  s.setTargetEntity(null)
  s.setCaption('')
}

export const highlightEntities = (entityNames: string[]) => {
  const s = useStore.getState()
  s.setHighlightEntities(entityNames)
  if (entityNames.length > 0) {
    const firstThree = entityNames.slice(0, 3).join(', ')
    const more = entityNames.length > 3 ? ` and ${entityNames.length - 3} more` : ''
    s.setCaption(`Highlighted: ${firstThree}${more}`)
  }
}

