// SPDX-License-Identifier: Apache-2.0
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Entity, Relationship, Layout } from '../types/knowledge'
import { generatePositions, type Position } from '../services/layoutEngine'

export type ProcessingMethod = 'single' | 'sharded'

export interface AppState {
  // Knowledge graph data
  entities: Entity[]
  relationships: Relationship[]
  entityPositions: Record<string, Position>

  // Layout and visualization
  layout: Layout
  xRayMode: boolean

  // Navigation and interaction
  targetEntity: string | null
  highlightEntities: string[]
  selectedRelationships: Relationship[]

  // UI state
  isSidebarOpen: boolean
  caption: string
  isFetching: boolean
  resetCam: boolean

  // Search and filtering
  searchQuery: string
  entityTypeFilter: 'all' | Entity['type']

  // Rich media
  richMediaMode: boolean
  activeScene: unknown | null

  // Knowledge graph metadata
  knowledgeGraphId: string | null
  processingMethod: ProcessingMethod

  // Mutators
  setEntities: (entities: Entity[]) => void
  setRelationships: (relationships: Relationship[]) => void
  setEntityPositions: (positions: Record<string, Position>) => void
  setLayout: (layout: Layout) => void
  setXRayMode: (x: boolean) => void
  setTargetEntity: (name: string | null) => void
  setHighlightEntities: (names: string[]) => void
  setSidebarOpen: (isOpen: boolean) => void
  setCaption: (caption: string) => void
  setFetching: (b: boolean) => void
  setResetCam: (b: boolean) => void
  setSearchQuery: (q: string) => void
  setEntityTypeFilter: (f: 'all' | Entity['type']) => void
  setRichMediaMode: (b: boolean) => void
  setActiveScene: (scene: unknown | null) => void

  // Derived helpers
  getFilteredEntities: () => Entity[]
  getRelatedEntities: (name: string) => string[]
  getEntityConnections: (name: string) => Relationship[]

  // Bulk ops
  loadKnowledgeGraph: (
    payload: {
      knowledge_graph: { entities: Entity[]; relationships: Relationship[] }
      metadata?: Record<string, unknown>
    }
  ) => void
  generateEntityPositions: () => void
}

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    entities: [],
    relationships: [],
    entityPositions: {},

    layout: 'sphere',
    xRayMode: false,

    targetEntity: null,
    highlightEntities: [],
    selectedRelationships: [],

    isSidebarOpen: false,
    caption: '',
    isFetching: false,
    resetCam: false,

    searchQuery: '',
    entityTypeFilter: 'all',

    richMediaMode: false,
    activeScene: null,

    knowledgeGraphId: null,
    processingMethod: 'single',

    setEntities: (entities) => set({ entities }),
    setRelationships: (relationships) => set({ relationships }),
    setEntityPositions: (positions) => set({ entityPositions: positions }),
    setLayout: (layout) => set({ layout }),
    setXRayMode: (x) => set({ xRayMode: x }),
    setTargetEntity: (name) => set({ targetEntity: name }),
    setHighlightEntities: (names) => set({ highlightEntities: names }),
    setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
    setCaption: (caption) => set({ caption }),
    setFetching: (b) => set({ isFetching: b }),
    setResetCam: (b) => set({ resetCam: b }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    setEntityTypeFilter: (f) => set({ entityTypeFilter: f }),
    setRichMediaMode: (b) => set({ richMediaMode: b }),
    setActiveScene: (scene) => set({ activeScene: scene }),

    getFilteredEntities: () => {
      const { entities, searchQuery, entityTypeFilter } = get()
      return entities.filter((entity) => {
        const matchesSearch =
          !searchQuery ||
          entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (entity.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
        const matchesType = entityTypeFilter === 'all' || entity.type === entityTypeFilter
        return matchesSearch && matchesType
      })
    },

    getRelatedEntities: (name: string) => {
      const { relationships } = get()
      const s = new Set<string>()
      relationships.forEach((r) => {
        if (r.source === name) s.add(r.target)
        if (r.target === name) s.add(r.source)
      })
      return [...s]
    },

    getEntityConnections: (name: string) => {
      const { relationships } = get()
      return relationships.filter((r) => r.source === name || r.target === name)
    },

    loadKnowledgeGraph: (payload) => {
      const entities = payload?.knowledge_graph?.entities ?? []
      const relationships = payload?.knowledge_graph?.relationships ?? []
      const metadata = payload?.metadata ?? {}
      set({
        entities,
        relationships,
        knowledgeGraphId: metadata?.uuid ?? null,
        processingMethod: metadata?.hkg_metadata?.processing_method ?? 'single',
      })
      get().generateEntityPositions()
    },

    generateEntityPositions: () => {
      const s = get()
      const positions = generatePositions({
        entities: s.entities,
        relationships: s.relationships,
        layout: s.layout,
      })
      set({ entityPositions: positions })
    },
  }))
)

type StoreWithSelectors = typeof useStore & {
  useEntities: () => Entity[]
  useRelationships: () => Relationship[]
  useEntityPositions: () => Record<string, Position>
  useLayout: () => Layout
  useHighlightEntities: () => string[]
  useXRayMode: () => boolean
  useIsSidebarOpen: () => boolean
  useCaption: () => string
  useIsFetching: () => boolean
  useEntityTypeFilter: () => 'all' | Entity['type']
  useResetCam: () => boolean
  useTargetEntity: () => string | null
  useSearchQuery: () => string
  useRichMediaMode: () => boolean
  useActiveScene: () => unknown | null
  useSelectedRelationships: () => Relationship[]
  useKnowledgeGraphId: () => string | null
  useProcessingMethod: () => ProcessingMethod
}

export const useEntities = () => useStore((s) => s.entities)
export const useRelationships = () => useStore((s) => s.relationships)
export const useEntityPositions = () => useStore((s) => s.entityPositions)
export const useLayout = () => useStore((s) => s.layout)
export const useHighlightEntities = () => useStore((s) => s.highlightEntities)
export const useXRayMode = () => useStore((s) => s.xRayMode)
export const useIsSidebarOpen = () => useStore((s) => s.isSidebarOpen)
export const useCaption = () => useStore((s) => s.caption)
export const useIsFetching = () => useStore((s) => s.isFetching)
export const useEntityTypeFilter = () => useStore((s) => s.entityTypeFilter)
export const useResetCam = () => useStore((s) => s.resetCam)
export const useTargetEntity = () => useStore((s) => s.targetEntity)
export const useSearchQuery = () => useStore((s) => s.searchQuery)
export const useRichMediaMode = () => useStore((s) => s.richMediaMode)
export const useActiveScene = () => useStore((s) => s.activeScene)
export const useSelectedRelationships = () => useStore((s) => s.selectedRelationships)
export const useKnowledgeGraphId = () => useStore((s) => s.knowledgeGraphId)
export const useProcessingMethod = () => useStore((s) => s.processingMethod)

export default useStore

