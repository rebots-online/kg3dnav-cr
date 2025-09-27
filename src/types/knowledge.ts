// SPDX-License-Identifier: Apache-2.0
// Types for knowledge graph entities, relationships, build info, and layout

export type EntityType =
  | 'CONCEPT'
  | 'PERSON'
  | 'ORGANIZATION'
  | 'LOCATION'
  | 'EVENT'
  | 'OTHER'

export type Entity = {
  name: string
  type: EntityType
  description?: string
  uuid?: string
  spatial_media?: { has_3d_scene?: boolean }
  // Search/result provenance flags
  searchRelevance?: 'uuid_coordinated' | 'vector_semantic' | 'audit_activity' | 'text_search'
  vectorMatch?: boolean
  auditMatch?: boolean
}

export type Relationship = {
  source: string
  target: string
  relationship: string
  uuid?: string
}

export type BuildInfo = {
  buildNumber: string // canonical five-character identifier derived from epoch minutes
  epochMinutes: number
  semver: string
  gitSha: string
  builtAtIso: string
  versionBuild: string
}

export type Layout = 'sphere' | 'grid' | 'concept-centric'

