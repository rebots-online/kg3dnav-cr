// SPDX-License-Identifier: Apache-2.0
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getEnvConfig } from '../config/env'

export type ConnectionMode = 'unified' | 'perService'

export type EndpointAuth = {
  username?: string
  password?: string
  apiKey?: string
  model?: string
  database?: string
  collection?: string
  embeddingModel?: string
  dimension?: number
}

export type EndpointConfig = {
  baseUrl: string
} & EndpointAuth

export type ServiceKey = 'neo4j' | 'qdrant' | 'postgres' | 'ollama' | 'openRouter'

export type LLMProvider = 'ollama' | 'openRouter'

type SettingsState = {
  mode: ConnectionMode
  unified: {
    baseUrl: string
  }
  services: Record<ServiceKey, EndpointConfig>
  llmProvider: LLMProvider
  setMode: (mode: ConnectionMode) => void
  setLLMProvider: (provider: LLMProvider) => void
  updateUnifiedBaseUrl: (baseUrl: string) => void
  updateService: (key: ServiceKey, patch: Partial<EndpointConfig>) => void
  applyDraft: (draft: {
    mode: ConnectionMode
    unifiedBaseUrl: string
    services: Record<ServiceKey, EndpointConfig>
    llmProvider: LLMProvider
  }) => void
  resetToDefaults: () => void
  getMCPBaseUrl: () => string
  getServiceConfig: (key: ServiceKey) => EndpointConfig
}

export const MCP_DEFAULT = 'http://192.168.0.71:49160'

export const DEFAULT_SERVICE_ENDPOINTS: Record<ServiceKey, string> = {
  neo4j: 'bolt://192.168.0.71:7687',
  qdrant: 'http://192.168.0.71:6333',
  postgres: 'postgresql://192.168.0.71:5432',
  ollama: 'http://localhost:11434',
  openRouter: 'https://openrouter.ai/api/v1/chat/completions',
}

const DEFAULT_SERVICE_CONFIGS: Record<ServiceKey, EndpointConfig> = {
  neo4j: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.neo4j,
    username: '',
    password: '',
    database: 'neo4j',
  },
  qdrant: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.qdrant,
    apiKey: '',
    collection: 'hkg-2sep2025',
    embeddingModel: 'mxbai-embed-large',
    dimension: 1024,
  },
  postgres: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.postgres,
    username: '',
    password: '',
    database: 'maindb',
  },
  ollama: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.ollama,
    model: 'llama3.1',
  },
  openRouter: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.openRouter,
    apiKey: '',
    model: 'x-ai/grok-4-fast:free',
  },
}

function cloneDefaultServiceConfig(key: ServiceKey): EndpointConfig {
  const config = DEFAULT_SERVICE_CONFIGS[key]
  return { ...config }
}

function sanitizeBaseUrl(base?: string | null): string | null {
  if (typeof base !== 'string') return null
  const trimmed = base.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/$/, '')
}

function sanitizeAuthValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function sanitizeNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

const DEFAULTS: Pick<SettingsState, 'mode' | 'unified' | 'services'> = {
  mode: 'unified',
  unified: {
    baseUrl: MCP_DEFAULT,
  },
  services: {
    neo4j: cloneDefaultServiceConfig('neo4j'),
    qdrant: cloneDefaultServiceConfig('qdrant'),
    postgres: cloneDefaultServiceConfig('postgres'),
    ollama: cloneDefaultServiceConfig('ollama'),
    openRouter: cloneDefaultServiceConfig('openRouter'),
  },
}

const DEFAULT_LLM_PROVIDER: LLMProvider = 'ollama'

const storage = typeof window !== 'undefined' ? createJSONStorage(() => window.localStorage) : undefined

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      llmProvider: DEFAULT_LLM_PROVIDER,
      setMode: (mode) => set({ mode }),
      setLLMProvider: (provider) => set({ llmProvider: provider }),
      updateUnifiedBaseUrl: (baseUrl) => {
        const sanitized = sanitizeBaseUrl(baseUrl) ?? MCP_DEFAULT
        set({ unified: { baseUrl: sanitized } })
      },
      updateService: (key, patch) => {
        set((state) => {
          const current = state.services[key] ?? cloneDefaultServiceConfig(key)
          const defaults = cloneDefaultServiceConfig(key)
          const next: EndpointConfig = { ...defaults, ...current }

          if (Object.prototype.hasOwnProperty.call(patch, 'baseUrl')) {
            const candidate = sanitizeBaseUrl(patch.baseUrl)
            next.baseUrl = candidate ?? defaults.baseUrl
          }

          if (Object.prototype.hasOwnProperty.call(patch, 'username')) {
            next.username = sanitizeAuthValue(patch.username) ?? ''
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'password')) {
            next.password = sanitizeAuthValue(patch.password) ?? ''
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'apiKey')) {
            next.apiKey = sanitizeAuthValue(patch.apiKey)
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'model')) {
            const sanitizedModel = sanitizeAuthValue(patch.model)
            next.model = sanitizedModel ?? defaults.model
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'database')) {
            const sanitizedDb = sanitizeAuthValue(patch.database)
            next.database = sanitizedDb ?? defaults.database
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'collection')) {
            const sanitizedCollection = sanitizeAuthValue(patch.collection)
            next.collection = sanitizedCollection ?? defaults.collection
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'embeddingModel')) {
            const sanitizedEmbedding = sanitizeAuthValue(patch.embeddingModel)
            next.embeddingModel = sanitizedEmbedding ?? defaults.embeddingModel
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'dimension')) {
            const sanitizedDimension = sanitizeNumberValue(patch.dimension)
            next.dimension = sanitizedDimension ?? defaults.dimension
          }

          return {
            services: {
              ...state.services,
              [key]: next,
            },
          }
        })
      },
      applyDraft: (draft) => {
        const sanitizedUnified = sanitizeBaseUrl(draft.unifiedBaseUrl) ?? MCP_DEFAULT
        const sanitizedServices = Object.fromEntries(
          (Object.keys(DEFAULTS.services) as ServiceKey[]).map((serviceKey) => {
            const defaults = cloneDefaultServiceConfig(serviceKey)
            const provided = draft.services[serviceKey]
            const merged: EndpointConfig = {
              ...defaults,
              ...provided,
              baseUrl: sanitizeBaseUrl(provided?.baseUrl) ?? defaults.baseUrl,
            }
            if (typeof provided?.username === 'string') {
              merged.username = sanitizeAuthValue(provided.username) ?? ''
            }
            if (typeof provided?.password === 'string') {
              merged.password = sanitizeAuthValue(provided.password) ?? ''
            }
            if (typeof provided?.apiKey !== 'undefined') {
              merged.apiKey = sanitizeAuthValue(provided.apiKey)
            }
            if (typeof provided?.model !== 'undefined') {
              merged.model = sanitizeAuthValue(provided.model) ?? defaults.model
            }
            if (typeof provided?.database !== 'undefined') {
              merged.database = sanitizeAuthValue(provided.database) ?? defaults.database
            }
            if (typeof provided?.collection !== 'undefined') {
              merged.collection = sanitizeAuthValue(provided.collection) ?? defaults.collection
            }
            if (typeof provided?.embeddingModel !== 'undefined') {
              merged.embeddingModel = sanitizeAuthValue(provided.embeddingModel) ?? defaults.embeddingModel
            }
            if (typeof provided?.dimension !== 'undefined') {
              merged.dimension = sanitizeNumberValue(provided.dimension) ?? defaults.dimension
            }
            return [serviceKey, merged]
          })
        ) as Record<ServiceKey, EndpointConfig>

        set({
          mode: draft.mode,
          unified: { baseUrl: sanitizedUnified },
          services: sanitizedServices,
          llmProvider: draft.llmProvider,
        })
      },
      resetToDefaults: () =>
        set({
          mode: DEFAULTS.mode,
          unified: { ...DEFAULTS.unified },
          services: {
            neo4j: cloneDefaultServiceConfig('neo4j'),
            qdrant: cloneDefaultServiceConfig('qdrant'),
            postgres: cloneDefaultServiceConfig('postgres'),
            ollama: cloneDefaultServiceConfig('ollama'),
            openRouter: cloneDefaultServiceConfig('openRouter'),
          },
          llmProvider: DEFAULT_LLM_PROVIDER,
        }),
      getMCPBaseUrl: () => {
        const base = sanitizeBaseUrl(get().unified.baseUrl)
        if (base) return base
        const envBase = sanitizeBaseUrl(getEnvConfig().HKG_MCP_BASE_URL)
        return envBase ?? MCP_DEFAULT
      },
      getServiceConfig: (key) => {
        const svc = get().services[key]
        const defaults = cloneDefaultServiceConfig(key)
        const sanitizedBase = sanitizeBaseUrl(svc?.baseUrl)
        return {
          ...defaults,
          ...svc,
          baseUrl: sanitizedBase ?? defaults.baseUrl,
        }
      },
    }),
    {
      name: 'kg3dnav-settings',
      storage,
      version: 1,
      partialize: (state) => ({
        mode: state.mode,
        unified: state.unified,
        services: state.services,
        llmProvider: state.llmProvider,
      }),
    }
  )
)

export const useSettingsMode = (): ConnectionMode => useSettingsStore((s) => s.mode)
export const useUnifiedBaseUrl = (): string => useSettingsStore((s) => s.unified.baseUrl)
export const useServiceMap = (): Record<ServiceKey, EndpointConfig> => useSettingsStore((s) => s.services)
export const useLLMProvider = (): LLMProvider => useSettingsStore((s) => s.llmProvider)

export const getServiceConfigSnapshot = (key: ServiceKey): EndpointConfig =>
  useSettingsStore.getState().getServiceConfig(key)

export default useSettingsStore
