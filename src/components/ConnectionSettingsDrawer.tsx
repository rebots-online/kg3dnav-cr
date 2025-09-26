// SPDX-License-Identifier: Apache-2.0
import React, { useMemo, useState } from 'react'
import useSettingsStore, {
  ServiceKey,
  useSettingsMode,
  useUnifiedBaseUrl,
  useServiceMap,
  DEFAULT_SERVICE_ENDPOINTS,
  MCP_DEFAULT,
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
      key: 'baseUrl' | 'username' | 'password' | 'apiKey' | 'model'
      label: string
      type?: 'text' | 'password'
      placeholder?: string
      helper?: string
    }>
  }
> = {
  neo4j: {
    label: 'Neo4j',
    description: 'Graph database backing the knowledge graph.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'http://192.168.0.71:7474' },
      { key: 'username', label: 'Username', placeholder: 'neo4j' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••' },
    ],
  },
  qdrant: {
    label: 'Qdrant',
    description: 'Vector search service for embeddings.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'http://192.168.0.71:6333' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Optional' },
    ],
  },
  postgres: {
    label: 'PostgreSQL',
    description: 'Audit/event persistence backing knowledge graph actions.',
    fields: [
      { key: 'baseUrl', label: 'Connection URL', placeholder: 'postgresql://192.168.0.71:5432' },
      { key: 'username', label: 'Username', placeholder: 'postgres' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••' },
    ],
  },
  ollama: {
    label: 'Ollama',
    description: 'Local LLM runtime used for first-pass navigation guidance.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'http://192.168.0.71:11434' },
      { key: 'model', label: 'Model', placeholder: 'llama3.1' },
    ],
  },
  openRouter: {
    label: 'OpenRouter (x-ai/grok-4-fast:free)',
    description: 'Fallback hosted LLM provider via OpenRouter API.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://openrouter.ai/api/v1' },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-...',
        helper: 'Stored locally in your browser (never sent elsewhere).',
      },
      { key: 'model', label: 'Model', placeholder: 'openrouter/x-ai/grok-4-fast:free' },
    ],
  },
}

const ConnectionSettingsDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const mode = useSettingsMode()
  const unifiedBaseUrl = useUnifiedBaseUrl()
  const services = useServiceMap()

  const setMode = useSettingsStore((s) => s.setMode)
  const updateUnifiedBaseUrl = useSettingsStore((s) => s.updateUnifiedBaseUrl)
  const updateService = useSettingsStore((s) => s.updateService)
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults)

  const [activeTab, setActiveTab] = useState<Tab>('connections')
  const [revealApiKey, setRevealApiKey] = useState(false)

  const serviceKeys = useMemo(() => Object.keys(services) as ServiceKey[], [services])

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
                  checked={mode === 'unified'}
                  onChange={() => setMode('unified')}
                  style={{ accentColor: '#4ECDC4' }}
                />
                Unified MCP Endpoint (recommended)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginTop: 10 }}>
                <input
                  type="radio"
                  name="connection-mode"
                  value="perService"
                  checked={mode === 'perService'}
                  onChange={() => setMode('perService')}
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
                value={unifiedBaseUrl}
                onChange={(e) => updateUnifiedBaseUrl((e.target as HTMLInputElement).value)}
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

            {mode === 'perService' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {serviceKeys.map((key) => {
                  const config = services[key]
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
                          const value = config[field.key] ?? ''
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
                                  value={value as string}
                                  onChange={(e) =>
                                    updateService(key, {
                                      [field.key]: (e.target as HTMLInputElement).value,
                                    })
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
              unavailable, OpenRouter will proxy x-ai/grok-4-fast:free.
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
                value={services.ollama.baseUrl}
                onChange={(e) => updateService('ollama', { baseUrl: (e.target as HTMLInputElement).value })}
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
              <input
                type="text"
                value={services.ollama.model ?? ''}
                onChange={(e) => updateService('ollama', { model: (e.target as HTMLInputElement).value })}
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
                value={services.openRouter.baseUrl}
                onChange={(e) =>
                  updateService('openRouter', { baseUrl: (e.target as HTMLInputElement).value })
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
                  value={services.openRouter.apiKey ?? ''}
                  onChange={(e) =>
                    updateService('openRouter', { apiKey: (e.target as HTMLInputElement).value })
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
              <input
                type="text"
                value={services.openRouter.model ?? ''}
                onChange={(e) => updateService('openRouter', { model: (e.target as HTMLInputElement).value })}
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
            onClick={resetToDefaults}
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
          <button
            onClick={onClose}
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
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConnectionSettingsDrawer
