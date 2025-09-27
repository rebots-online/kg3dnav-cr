// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useRef, useState } from 'react'
import {
  analyzeEntity,
  clearAllHighlights,
  followRelationship,
  highlightEntities,
  sendQuery,
  setLayout,
  setTargetEntity,
} from '../state/actions'
import { useServiceMap } from '../state/settingsStore'
import { navigateWithLLM, type ChatMessageParam, type LLMAction } from '../services/llmClient'
import { createNavigationContextSnapshot } from '../services/contextSnapshot'
import { logError, logInfo, logWarn, useLogPanelState } from '../state/logStore'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  provider?: 'ollama' | 'openrouter' | 'fallback' | 'error'
  actions?: LLMAction[]
  isPending?: boolean
}

type AINavigationChatProps = {
  onOpenSettings?: () => void
}

function formatActionSummary(action: LLMAction): string {
  switch (action.type) {
    case 'highlightEntities':
      return `Highlight: ${action.entities.join(', ')}`
    case 'setTargetEntity':
      return `Focus on ${action.entity}`
    case 'setLayout':
      return `Layout → ${action.layout}`
    case 'sendQuery':
      return `Search "${action.query}"`
    case 'analyzeEntity':
      return `Analyze ${action.entity}`
    case 'followRelationship':
      return `Follow ${action.relationship}: ${action.from} → ${action.to}`
    case 'clearHighlights':
      return 'Clear highlights'
    default:
      return action.type
  }
}

function applyAction(action: LLMAction) {
  switch (action.type) {
    case 'highlightEntities':
      highlightEntities(action.entities)
      break
    case 'setTargetEntity':
      setTargetEntity(action.entity)
      break
    case 'setLayout':
      setLayout(action.layout)
      break
    case 'sendQuery':
      sendQuery(action.query)
      break
    case 'analyzeEntity':
      analyzeEntity(action.entity)
      break
    case 'followRelationship':
      followRelationship(action.relationship, action.from, action.to)
      break
    case 'clearHighlights':
      clearAllHighlights()
      break
    default:
      break
  }
}

export default function AINavigationChat({ onOpenSettings }: AINavigationChatProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const { setVisible: setLogVisible } = useLogPanelState()
  const serviceMap = useServiceMap()
  const ollamaModelLabel =
    typeof serviceMap.ollama?.model === 'string' && serviceMap.ollama.model.trim().length > 0
      ? serviceMap.ollama.model.trim()
      : 'llama3.1'
  const openRouterModelLabel =
    typeof serviceMap.openRouter?.model === 'string' && serviceMap.openRouter.model.trim().length > 0
      ? serviceMap.openRouter.model.trim()
      : 'x-ai/grok-4-fast:free'

  function generateId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: generateId('ai'),
          role: 'assistant',
          content:
            'Hello! I can help you navigate the knowledge graph, surface insights, and trigger graph actions. Ask me anything about the graph.',
          timestamp: new Date(),
          provider: 'fallback',
        },
      ])
    }
  }, [])

  async function send() {
    if (!inputValue.trim() || isProcessing) return
    const trimmed = inputValue.trim()
    const userMessage: ChatMessage = {
      id: generateId('user'),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }
    const history: ChatMessageParam[] = [...messages, userMessage].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    logInfo('ai-chat', 'User message submitted', { content: trimmed })
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsProcessing(true)

    const pendingId = generateId('ai')
    setMessages((prev) => [
      ...prev,
      {
        id: pendingId,
        role: 'assistant',
        content: 'Consulting navigation agent...',
        timestamp: new Date(),
        provider: 'fallback',
        isPending: true,
      },
    ])

    try {
      const context = createNavigationContextSnapshot()
      const result = await navigateWithLLM(history, context)
      logInfo('ai-chat', 'LLM response received', {
        provider: result.provider,
        actions: result.actions.map((action) => action.type),
      })
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? {
                ...msg,
                content: result.message,
                provider: result.provider,
                timestamp: new Date(),
                isPending: false,
                actions: result.actions,
              }
            : msg
        )
      )
      if (result.actions.length > 0) {
        result.actions.forEach((action) => {
          try {
            applyAction(action)
            logInfo('ai-chat', 'Executed action', { action: action.type })
          } catch (error) {
            logWarn('ai-chat', 'Action execution failed', {
              action: action.type,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        })
      }
    } catch (error) {
      logError('ai-chat', 'LLM request failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      const fallback =
        '⚠️ Unable to reach navigation LLM. Open ⚙️ Settings to verify endpoints and API keys.'
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? {
                ...msg,
                content: fallback,
                provider: 'error',
                timestamp: new Date(),
                isPending: false,
              }
            : msg
        )
      )
    } finally {
      setIsProcessing(false)
    }
  }

  return !isOpen ? (
    <button
      onClick={() => setIsOpen(true)}
      style={{
        position: 'absolute',
        bottom: 120,
        left: 20,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        borderRadius: 50,
        padding: '15px 20px',
        color: 'white',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
        backdropFilter: 'blur(10px)',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        boxShadow: '0 8px 32px rgba(102,126,234,0.4)',
      }}
      title="AI Navigator"
    >
      🧭 AI Navigator
    </button>
  ) : (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        left: 20,
        width: 400,
        height: 500,
        background: 'rgba(0, 0, 0, 0.92)',
        borderRadius: 16,
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          padding: 20,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🧭</span>
          <div>
            <div style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>AI Navigator</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              Agentic graph exploration
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setLogVisible(true)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              borderRadius: 8,
              fontSize: 12,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            View logs
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 20,
              cursor: 'pointer',
              padding: 5,
              borderRadius: '50%',
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      <div
        style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background:
                  m.role === 'user'
                    ? 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {m.role === 'user' ? '👤' : '🧭'}
            </div>
            <div
              style={{
                background: m.role === 'user' ? 'rgba(78,205,196,0.2)' : 'rgba(255,255,255,0.05)',
                padding: '12px 16px',
                borderRadius: 12,
                color: 'white',
                fontSize: 14,
                lineHeight: 1.4,
                maxWidth: 280,
                border:
                  m.role === 'user' ? '1px solid rgba(78,205,196,0.3)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {m.content.split('\n').map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
              {m.provider && m.role === 'assistant' && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.6)',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                  }}
                >
                  {m.provider === 'ollama' && `Ollama • ${ollamaModelLabel}`}
                  {m.provider === 'openrouter' && `OpenRouter • ${openRouterModelLabel}`}
                  {m.provider === 'fallback' && 'Navigation agent'}
                  {m.provider === 'error' && 'LLM unavailable — check Settings'}
                </div>
              )}
              {m.provider === 'error' && onOpenSettings && (
                <button
                  onClick={() => onOpenSettings()}
                  style={{
                    marginTop: 6,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 12,
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Open settings
                </button>
              )}
              {m.actions && m.actions.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>Actions executed</div>
                  {m.actions.map((action, idx) => (
                    <div key={`${m.id}-action-${idx}`} style={{ color: 'rgba(255,255,255,0.8)' }}>
                      • {formatActionSummary(action)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              🧭
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'rgba(255,255,255,0.7)',
                fontSize: 14,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Navigating...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: 20,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Ask the agent to explore..."
            disabled={isProcessing}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.1)',
              borderStyle: 'solid',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              borderRadius: 25,
              color: 'white',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={() => void send()}
            disabled={!inputValue.trim() || isProcessing}
            style={{
              background:
                inputValue.trim() && !isProcessing
                  ? 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)'
                  : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: 44,
              height: 44,
              color: 'white',
              cursor: inputValue.trim() && !isProcessing ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            {isProcessing ? '⏳' : '🚀'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`}</style>
    </div>
  )
}
