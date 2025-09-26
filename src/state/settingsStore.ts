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
}

export type EndpointConfig = {
  baseUrl: string
} & EndpointAuth

export type ServiceKey = 'neo4j' | 'qdrant' | 'postgres' | 'ollama' | 'openRouter'

type SettingsState = {
  mode: ConnectionMode
  unified: {
    baseUrl: string
  }
  services: Record<ServiceKey, EndpointConfig>
  setMode: (mode: ConnectionMode) => void
  updateUnifiedBaseUrl: (baseUrl: string) => void
  updateService: (key: ServiceKey, patch: Partial<EndpointConfig>) => void
  resetToDefaults: () => void
  getMCPBaseUrl: () => string
  getServiceConfig: (key: ServiceKey) => EndpointConfig
}

export const MCP_DEFAULT = 'http://192.168.0.71:49160'

export const DEFAULT_SERVICE_ENDPOINTS: Record<ServiceKey, string> = {
  neo4j: 'http://192.168.0.71:7474',
  qdrant: 'http://192.168.0.71:6333',
  postgres: 'postgresql://192.168.0.71:5432',
  ollama: 'http://192.168.0.71:11434',
  openRouter: 'https://openrouter.ai/api/v1',
}

const DEFAULT_SERVICE_CONFIGS: Record<ServiceKey, EndpointConfig> = {
  neo4j: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.neo4j,
    username: '',
    password: '',
  },
  qdrant: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.qdrant,
    apiKey: '',
  },
  postgres: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.postgres,
    username: '',
    password: '',
  },
  ollama: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.ollama,
    model: 'llama3.1',
  },
  openRouter: {
    baseUrl: DEFAULT_SERVICE_ENDPOINTS.openRouter,
    apiKey: '',
    model: 'openrouter/x-ai/grok-4-fast:free',
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

const storage = typeof window !== 'undefined' ? createJSONStorage(() => window.localStorage) : undefined

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      setMode: (mode) => set({ mode }),
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

          return {
            services: {
              ...state.services,
              [key]: next,
            },
          }
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
      }),
    }
  )
)

export const useSettingsMode = (): ConnectionMode => useSettingsStore((s) => s.mode)
export const useUnifiedBaseUrl = (): string => useSettingsStore((s) => s.unified.baseUrl)
export const useServiceMap = (): Record<ServiceKey, EndpointConfig> => useSettingsStore((s) => s.services)

export const getServiceConfigSnapshot = (key: ServiceKey): EndpointConfig =>
  useSettingsStore.getState().getServiceConfig(key)

export default useSettingsStore
