// SPDX-License-Identifier: Apache-2.0
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import useSettingsStore, {
  ServiceKey,
  useSettingsMode,
  useUnifiedBaseUrl,
  useServiceMap,
  DEFAULT_SERVICE_ENDPOINTS,
  MCP_DEFAULT,
  useLLMProvider,
  LLMProvider,
} from '../state/settingsStore'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'connections' | 'llm'

const SERVICE_METADATA: Record<
  ServiceKey,
  {
    label: string
    description: string
    fields: Array<{
      key:
        | 'baseUrl'
        | 'username'
        | 'password'
        | 'apiKey'
        | 'model'
        | 'database'
        | 'collection'
        | 'embeddingModel'
        | 'dimension'
      label: string
      type?: 'text' | 'password' | 'number'
      placeholder?: string
      helper?: string
    }>
  }
> = {
  neo4j: {
    label: 'Neo4j',
    description: 'Graph database backing the knowledge graph.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'bolt://192.168.0.71:7687' },
      { key: 'username', label: 'Username', placeholder: 'neo4j' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••' },
      { key: 'database', label: 'Database', placeholder: 'neo4j' },
    ],
  },
  qdrant: {
    label: 'Qdrant',
    description: 'Vector search service for embeddings.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'http://192.168.0.71:6333' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Optional' },
      { key: 'collection', label: 'Collection', placeholder: 'hkg-2sep2025' },
      { key: 'embeddingModel', label: 'Embedding Model', placeholder: 'mxbai-embed-large' },
      { key: 'dimension', label: 'Vector Dimension', type: 'number', placeholder: '1024' },
    ],
  },
  postgres: {
    label: 'PostgreSQL',
    description: 'Audit/event persistence backing knowledge graph actions.',
    fields: [
      { key: 'baseUrl', label: 'Connection URL', placeholder: 'postgresql://192.168.0.71:5432' },
      { key: 'username', label: 'Username', placeholder: 'postgres' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••' },
      { key: 'database', label: 'Database', placeholder: 'maindb' },
    ],
  },
  ollama: {
    label: 'Ollama',
    description: 'Local LLM runtime used for first-pass navigation guidance.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'http://localhost:11434' },
      { key: 'model', label: 'Model', placeholder: 'llama3.1' },
    ],
  },
  openRouter: {
    label: 'OpenAI-compatible (OpenRouter)',
    description: 'Fallback hosted LLM provider via OpenRouter API.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://openrouter.ai/api/v1/chat/completions' },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-...',
        helper: 'Stored locally in your browser (never sent elsewhere).',
      },
      { key: 'model', label: 'Model', placeholder: 'x-ai/grok-4-fast:free' },
    ],
  },
}

const ConnectionSettingsDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const mode = useSettingsMode()
  const unifiedBaseUrl = useUnifiedBaseUrl()
  const services = useServiceMap()
  const llmProvider = useLLMProvider()

  const applyDraft = useSettingsStore((s) => s.applyDraft)
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults)

  const [activeTab, setActiveTab] = useState<Tab>('connections')
  const [revealApiKey, setRevealApiKey] = useState(false)
  const [draftMode, setDraftMode] = useState(mode)
  const [draftUnifiedBaseUrl, setDraftUnifiedBaseUrl] = useState(unifiedBaseUrl)
  const [draftServices, setDraftServices] = useState(services)
  const [draftLLMProvider, setDraftLLMProvider] = useState<LLMProvider>(llmProvider)
  const [modelOptions, setModelOptions] = useState<
    Record<LLMProvider, { values: string[]; status: 'idle' | 'loading' | 'ready' | 'error'; error?: string }>
  >({
    ollama: { values: [], status: 'idle' },
    openRouter: { values: [], status: 'idle' },
  })

  const serviceKeys = useMemo(() => Object.keys(draftServices) as ServiceKey[], [draftServices])

  useEffect(() => {
    if (!isOpen) return
    setDraftMode(mode)
    setDraftUnifiedBaseUrl(unifiedBaseUrl)
    setDraftServices(structuredCloneSafe(services))
    setDraftLLMProvider(llmProvider)
    setActiveTab('connections')
  }, [isOpen, mode, unifiedBaseUrl, services, llmProvider])

  const syncModels = useCallback(
    async (provider: LLMProvider, baseUrl: string, apiKey?: string) => {
      if (!isOpen || typeof window === 'undefined') return
      setModelOptions((prev) => ({
        ...prev,
        [provider]: {
          values: prev[provider].values,
          status: 'loading',
        },
      }))
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 7000)
      try {
        const tagsUrl = resolveTagsUrl(baseUrl)
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (provider === 'openRouter' && apiKey) {
          headers.Authorization = `Bearer ${apiKey}`
        }
        const response = await fetch(tagsUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Failed to load models (${response.status})`)
        }
        const payload = await response.json()
        const models = extractModelNames(payload)
        setModelOptions((prev) => ({
          ...prev,
          [provider]: {
            values: models,
            status: 'ready',
          },
        }))
      } catch (err) {
        setModelOptions((prev) => ({
          ...prev,
          [provider]: {
            values: prev[provider].values,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          },
        }))
      } finally {
        window.clearTimeout(timeoutId)
      }
    },
    [isOpen]
  )

  useEffect(() => {
    if (!isOpen) return
    syncModels('ollama', draftServices.ollama?.baseUrl ?? DEFAULT_SERVICE_ENDPOINTS.ollama)
  }, [isOpen, draftServices.ollama?.baseUrl, syncModels])

  useEffect(() => {
    if (!isOpen) return
    syncModels(
      'openRouter',
      draftServices.openRouter?.baseUrl ?? DEFAULT_SERVICE_ENDPOINTS.openRouter,
      draftServices.openRouter?.apiKey
    )
  }, [
    isOpen,
    draftServices.openRouter?.baseUrl,
    draftServices.openRouter?.apiKey,
    syncModels,
  ])

  const handleServiceFieldChange = useCallback(
    (key: ServiceKey, field: string, value: string) => {
      setDraftServices((prev) => {
        const current = prev[key] ?? { baseUrl: DEFAULT_SERVICE_ENDPOINTS[key] }
        let nextValue: string | number | undefined = value
        if (field === 'dimension') {
          nextValue = value === '' ? undefined : Number.parseInt(value, 10)
          if (!Number.isFinite(nextValue as number)) {
            nextValue = undefined
          }
        }
        return {
          ...prev,
          [key]: {
            ...current,
            [field]: nextValue,
          },
        }
      })
    },
    []
  )

  const handleSave = useCallback(() => {
    applyDraft({
      mode: draftMode,
      unifiedBaseUrl: draftUnifiedBaseUrl,
      services: draftServices,
      llmProvider: draftLLMProvider,
    })
    onClose()
  }, [applyDraft, draftMode, draftUnifiedBaseUrl, draftServices, draftLLMProvider, onClose])

  const handleCancel = useCallback(() => {
    const snapshot = useSettingsStore.getState()
    setDraftMode(snapshot.mode)
    setDraftUnifiedBaseUrl(snapshot.unified.baseUrl)
    setDraftServices(structuredCloneSafe(snapshot.services))
    setDraftLLMProvider(snapshot.llmProvider)
    onClose()
  }, [onClose])

  const handleReset = useCallback(() => {
    resetToDefaults()
    const snapshot = useSettingsStore.getState()
    setDraftMode(snapshot.mode)
    setDraftUnifiedBaseUrl(snapshot.unified.baseUrl)
    setDraftServices(structuredCloneSafe(snapshot.services))
    setDraftLLMProvider(snapshot.llmProvider)
  }, [resetToDefaults])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 420,
        height: '100vh',
        background: 'rgba(10, 12, 16, 0.96)',
        borderLeft: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '-20px 0 40px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        color: 'white',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span role="img" aria-label="settings">
              ⚙️
            </span>
            Connection Settings
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            Defaults point to 192.168.0.71; update to match your deployment.
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
          }}
          title="Close settings"
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {(
          [
            { key: 'connections', label: 'Connections' },
            { key: 'llm', label: 'LLM' },
          ] as Array<{ key: Tab; label: string }>
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.15)',
              background: activeTab === tab.key ? 'rgba(78,205,196,0.2)' : 'transparent',
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {activeTab === 'connections' ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <input
                  type="radio"
                  name="connection-mode"
                  value="unified"
                  checked={draftMode === 'unified'}
                  onChange={() => setDraftMode('unified')}
                  style={{ accentColor: '#4ECDC4' }}
                />
                Unified MCP Endpoint (recommended)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginTop: 10 }}>
                <input
                  type="radio"
                  name="connection-mode"
                  value="perService"
                  checked={draftMode === 'perService'}
                  onChange={() => setDraftMode('perService')}
                  style={{ accentColor: '#4ECDC4' }}
                />
                Configure individual service endpoints
              </label>
            </div>

            <div
              style={{
                marginBottom: 24,
                padding: 16,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <label
                style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}
              >
                Unified MCP Base URL
              </label>
              <input
                type="text"
                value={draftUnifiedBaseUrl}
                onChange={(e) => setDraftUnifiedBaseUrl((e.target as HTMLInputElement).value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.3)',
                  color: 'white',
                  fontSize: 13,
                }}
                placeholder="http://192.168.0.71:49160"
              />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                Used for all data sources when "Unified" mode is selected.
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                Clearing this field restores the default {MCP_DEFAULT} endpoint.
              </div>
            </div>

            {draftMode === 'perService' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {serviceKeys.map((key) => {
                  const config = draftServices[key]
                  const meta = SERVICE_METADATA[key]
                  if (!meta) return null
                  return (
                    <div
                      key={key}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{meta.label}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
                        {meta.description}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {meta.fields.map((field) => {
                          const type = field.type ?? 'text'
                          const rawValue = config?.[field.key as keyof typeof config]
                          const value =
                            field.key === 'dimension'
                              ? rawValue ?? ''
                              : ((rawValue as string | undefined) ?? '')
                          const isApiKey = field.key === 'apiKey' && key === 'openRouter'
                          const inputType = isApiKey && !revealApiKey ? 'password' : type
                          const defaultBase =
                            field.key === 'baseUrl'
                              ? key === 'openRouter'
                                ? DEFAULT_SERVICE_ENDPOINTS.openRouter
                                : DEFAULT_SERVICE_ENDPOINTS[key]
                              : null
                          return (
                            <div key={field.key}>
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: 12,
                                  color: 'rgba(255,255,255,0.75)',
                                  marginBottom: 4,
                                }}
                              >
                                {field.label}
                              </label>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type={inputType}
                                  value={value as string | number}
                                  onChange={(e) =>
                                    handleServiceFieldChange(
                                      key,
                                      field.key,
                                      (e.target as HTMLInputElement).value
                                    )
                                  }
                                  placeholder={field.placeholder}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'rgba(0,0,0,0.35)',
                                    color: 'white',
                                    fontSize: 13,
                                  }}
                                />
                                {isApiKey && (
                                  <button
                                    type="button"
                                    onClick={() => setRevealApiKey((prev) => !prev)}
                                    style={{
                                      position: 'absolute',
                                      right: 10,
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'rgba(255,255,255,0.7)',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                    }}
                                  >
                                    {revealApiKey ? 'Hide' : 'Show'}
                                  </button>
                                )}
                              </div>
                              {field.helper && (
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                                  {field.helper}
                                </div>
                              )}
                              {defaultBase && (
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                                  Clear to restore default: {defaultBase}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                Configure the language models powering the AI Navigator. Ollama is attempted first; if
              unavailable, OpenAI-compatible endpoints will proxy x-ai/grok-4-fast:free.
              </div>
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>Active provider</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <input
                    type="radio"
                    name="llm-provider"
                    value="ollama"
                    checked={draftLLMProvider === 'ollama'}
                    onChange={() => setDraftLLMProvider('ollama')}
                    style={{ accentColor: '#4ECDC4' }}
                  />
                  Ollama (local first)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <input
                    type="radio"
                    name="llm-provider"
                    value="openRouter"
                    checked={draftLLMProvider === 'openRouter'}
                    onChange={() => setDraftLLMProvider('openRouter')}
                    style={{ accentColor: '#4ECDC4' }}
                  />
                  OpenAI-compatible (OpenRouter)
                </label>
              </div>
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Ollama</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
                Runs locally on the specified host. Ensure the model name exists within your Ollama instance.
              </div>
              <label
                style={{ fontSize: 12, display: 'block', color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}
              >
                Base URL
              </label>
              <input
                type="text"
                value={draftServices.ollama.baseUrl}
                onChange={(e) =>
                  handleServiceFieldChange('ollama', 'baseUrl', (e.target as HTMLInputElement).value)
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.35)',
                  color: 'white',
                  fontSize: 13,
                }}
              />
              <label
                style={{
                  fontSize: 12,
                  display: 'block',
                  color: 'rgba(255,255,255,0.75)',
                  margin: '10px 0 4px',
                }}
              >
                Model
              </label>
              <div>
                <input
                  type="text"
                  list="ollama-models"
                  value={draftServices.ollama.model ?? ''}
                  onChange={(e) =>
                    handleServiceFieldChange('ollama', 'model', (e.target as HTMLInputElement).value)
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.35)',
                    color: 'white',
                    fontSize: 13,
                  }}
                />
                <datalist id="ollama-models">
                  {modelOptions.ollama.values.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {modelOptions.ollama.status === 'error' && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                    Unable to load Ollama models: {modelOptions.ollama.error}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>OpenRouter</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
                Provide an API key for hosted fallback. Data is sent directly to OpenRouter.
              </div>
              <label
                style={{ fontSize: 12, display: 'block', color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}
              >
                Base URL
              </label>
              <input
                type="text"
                value={draftServices.openRouter.baseUrl}
                onChange={(e) =>
                  handleServiceFieldChange('openRouter', 'baseUrl', (e.target as HTMLInputElement).value)
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.35)',
                  color: 'white',
                  fontSize: 13,
                }}
              />
              <label
                style={{
                  fontSize: 12,
                  display: 'block',
                  color: 'rgba(255,255,255,0.75)',
                  margin: '10px 0 4px',
                }}
              >
                API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={revealApiKey ? 'text' : 'password'}
                  value={draftServices.openRouter.apiKey ?? ''}
                  onChange={(e) =>
                    handleServiceFieldChange('openRouter', 'apiKey', (e.target as HTMLInputElement).value)
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.35)',
                    color: 'white',
                    fontSize: 13,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setRevealApiKey((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {revealApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <label
                style={{
                  fontSize: 12,
                  display: 'block',
                  color: 'rgba(255,255,255,0.75)',
                  margin: '10px 0 4px',
                }}
              >
                Model
              </label>
              <div>
                <input
                  type="text"
                  list="openrouter-models"
                  value={draftServices.openRouter.model ?? ''}
                  onChange={(e) =>
                    handleServiceFieldChange('openRouter', 'model', (e.target as HTMLInputElement).value)
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.35)',
                    color: 'white',
                    fontSize: 13,
                  }}
                />
                <datalist id="openrouter-models">
                  {modelOptions.openRouter.values.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {modelOptions.openRouter.status === 'error' && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                    Unable to load OpenRouter models: {modelOptions.openRouter.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.4)' }}
      >
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
          Settings persist locally in your browser storage. Use the reset button to return to 192.168.0.71
          defaults.
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handleReset}
            style={{
              background: 'rgba(255, 107, 107, 0.15)',
              border: '1px solid rgba(255,107,107,0.4)',
              color: '#FF6B6B',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Reset to defaults
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleCancel}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.85)',
                borderRadius: 8,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                background: '#4ECDC4',
                border: 'none',
                color: '#0B1F1E',
                borderRadius: 8,
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConnectionSettingsDrawer

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

function resolveTagsUrl(baseUrl: string | undefined): string {
  if (!baseUrl) {
    return `${DEFAULT_SERVICE_ENDPOINTS.ollama.replace(/\/$/, '')}/api/tags`
  }
  try {
    const url = new URL(baseUrl)
    url.pathname = '/api/tags'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch (_err) {
    const trimmed = String(baseUrl).replace(/\/$/, '')
    return `${trimmed}/api/tags`
  }
}

function extractModelNames(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    const names = payload
      .map((item) => {
        if (!item) return null
        if (typeof item === 'string') return item
        if (typeof item === 'object') {
          const candidate = (item as { name?: unknown; model?: unknown }).name
          if (typeof candidate === 'string') return candidate
          const alt = (item as { model?: unknown }).model
          if (typeof alt === 'string') return alt
        }
        return null
      })
      .filter((value): value is string => Boolean(value))
    return Array.from(new Set(names))
  }
  if (payload && typeof payload === 'object') {
    const maybeData = (payload as { data?: unknown }).data
    if (Array.isArray(maybeData)) {
      return extractModelNames(maybeData)
    }
  }
  return []
}
