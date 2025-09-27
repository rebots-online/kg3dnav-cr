// SPDX-License-Identifier: Apache-2.0
import useStore from '../state/store'
import type { NavigationContext } from './llmClient'

function toContextEntity(entity: { name: string; type: string; description?: string }) {
  return {
    name: entity.name,
    type: entity.type,
    description: entity.description,
  }
}

export function createNavigationContextSnapshot(): NavigationContext {
  const state = useStore.getState()
  const highlightedNames = state.highlightEntities
  const highlightedEntities = highlightedNames
    .map((name) => state.entities.find((entity) => entity.name === name))
    .filter((entity): entity is { name: string; type: string; description?: string } => Boolean(entity))
    .map(toContextEntity)

  const fallbackMatches = state.entities
    .slice(0, 5)
    .map(toContextEntity)

  const matches = highlightedEntities.length > 0 ? highlightedEntities : fallbackMatches

  const focusText = state.caption
    ? state.caption
    : state.searchQuery
      ? `Active search: ${state.searchQuery}`
      : null

  return {
    highlightedEntities,
    matches,
    targetEntity: state.targetEntity,
    layout: state.layout,
    stats: {
      entityCount: state.entities.length,
      relationshipCount: state.relationships.length,
    },
    focus: focusText,
  }
}

