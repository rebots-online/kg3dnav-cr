// SPDX-License-Identifier: Apache-2.0
import type { Layout } from '../types/knowledge'
import useSettingsStore, {
  DEFAULT_SERVICE_ENDPOINTS,
  getServiceConfigSnapshot,
  LLMProvider,
} from '../state/settingsStore'
import { logDebug, logError, logInfo, logWarn } from '../state/logStore'

export type ChatMessageParam = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ContextEntity = { name: string; type?: string; description?: string }

export type NavigationContext = {
  highlightedEntities?: ContextEntity[]
  matches?: ContextEntity[]
  targetEntity?: string | null
  layout?: Layout | null
  stats?: { entityCount?: number; relationshipCount?: number }
  focus?: string | null
}

// LLMAction defines the structured operations that the navigation agent may request.
export type LLMAction =
  | { type: 'highlightEntities'; entities: string[] }
  | { type: 'setTargetEntity'; entity: string }
  | { type: 'setLayout'; layout: Layout }
  | { type: 'sendQuery'; query: string }
  | { type: 'analyzeEntity'; entity: string }
  | { type: 'followRelationship'; from: string; to: string; relationship: string }
  | { type: 'clearHighlights' }

export type LLMResult = {
  provider: 'ollama' | 'openrouter' | 'fallback'
  message: string
  actions: LLMAction[]
  raw: string
}

type ProviderResponse = { provider: 'ollama' | 'openrouter'; message: string }

type ParsedAgentPayload = { reply: string; actions: LLMAction[] }

function buildSystemPrompt(context: NavigationContext): string {
  const summaryLines: string[] = []
  const { stats, targetEntity, layout, highlightedEntities, matches, focus } = context

  if (stats?.entityCount || stats?.relationshipCount) {
    const countText = [
      typeof stats?.entityCount === 'number' ? `${stats.entityCount} entities` : null,
      typeof stats?.relationshipCount === 'number' ? `${stats.relationshipCount} relationships` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    if (countText) summaryLines.push(`Graph summary: ${countText}.`)
  }
  if (layout) summaryLines.push(`Current layout: ${layout}.`)
  if (targetEntity) summaryLines.push(`Focused entity: ${targetEntity}.`)
  if (highlightedEntities?.length) {
    const list = highlightedEntities.slice(0, 5).map((item) => item.name).join(', ')
    summaryLines.push(`Highlighted entities (${highlightedEntities.length}): ${list}.`)
  }
  if (matches?.length) {
    const list = matches
      .slice(0, 5)
      .map((match, idx) => {
        const desc = match.description ? ` — ${match.description}` : ''
        return `${idx + 1}. ${match.name}${match.type ? ` [${match.type}]` : ''}${desc}`
      })
      .join('\n')
    summaryLines.push(`Recent references:\n${list}`)
  }
  if (focus) summaryLines.push(`User focus: ${focus}.`)

  const actionSchema = `Return a single JSON object with keys "reply" and "actions".
- "reply": Markdown guidance for the user (concise, <= 4 bullet lines).
- "actions": array of zero or more action objects. Supported actions:
  * { "type": "highlightEntities", "entities": ["Entity name"] }
  * { "type": "setTargetEntity", "entity": "Entity name" }
  * { "type": "setLayout", "layout": "sphere"|"grid"|"concept-centric" }
  * { "type": "sendQuery", "query": "search text" }
  * { "type": "analyzeEntity", "entity": "Entity name" }
  * { "type": "followRelationship", "from": "Source", "to": "Target", "relationship": "REL" }
  * { "type": "clearHighlights" }
Ensure JSON is valid (no trailing commas). If no actions are needed, use an empty array.`

  return [
    'You are the navigation copilot for a 3D knowledge graph.',
    'Interpret natural-language goals, offer insights, and trigger UI actions through structured directives.',
    summaryLines.length ? `Context:\n${summaryLines.join('\n')}` : 'No additional context provided.',
    actionSchema,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractMessageContent(payload: unknown): string | null {
  if (!isRecord(payload)) return null
  const direct = payload.message
  if (isRecord(direct) && typeof direct.content === 'string') {
    return direct.content
  }
  const choices = payload.choices
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!isRecord(choice)) continue
      const message = choice.message
      if (isRecord(message) && typeof message.content === 'string') {
        return message.content
      }
    }
  }
  return null
}

function extractErrorDetail(payload: unknown): string | null {
  if (!isRecord(payload)) return null
  if (typeof payload.error === 'string') return payload.error
  if (isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message
  }
  if (typeof payload.message === 'string') return payload.message
  return null
}

function normalizeOllamaBaseUrl(url: string | undefined): string {
  const fallback = DEFAULT_SERVICE_ENDPOINTS.ollama
  if (typeof url !== 'string') return fallback
  let base = url.trim()
  if (!base) return fallback
  if (!/^https?:\/\//i.test(base)) {
    base = `http://${base}`
  }
  base = base.replace(/\/$/, '')
  base = base.replace(/\/(?:api(?:\/chat|\/tags)?|chat)$/i, '')
  return base || fallback
}

function normalizeOpenRouterCompletionsUrl(url: string | undefined): string {
  const fallback = DEFAULT_SERVICE_ENDPOINTS.openRouter
  if (typeof url !== 'string') return fallback
  let value = url.trim()
  if (!value) return fallback
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`
  }
  try {
    const parsed = new URL(value)
    const path = parsed.pathname.replace(/\/$/, '')
    if (/\/chat\/completions$/i.test(path)) {
      parsed.pathname = path
    } else if (/\/models$/i.test(path)) {
      parsed.pathname = path.replace(/\/models$/i, '/chat/completions')
    } else if (/\/api\/v\d+$/i.test(path)) {
      parsed.pathname = `${path}/chat/completions`
    } else if (/\/api$/i.test(path)) {
      parsed.pathname = `${path}/v1/chat/completions`
    } else if (!path || path === '/') {
      parsed.pathname = '/api/v1/chat/completions'
    } else {
      parsed.pathname = `${path}/chat/completions`
    }
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch (_err) {
    return fallback
  }
}

function resolveRefererHeader(): string | undefined {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return undefined
}

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId!)
  }
}

function withSystemPrompt(messages: ChatMessageParam[], systemPrompt: string): ChatMessageParam[] {
  const sanitized = messages.filter((msg) => msg.role !== 'system')
  return [{ role: 'system', content: systemPrompt }, ...sanitized]
}

function summarizeMessages(messages: ChatMessageParam[]): { lastUserMessage?: string } {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.role === 'user') {
      return { lastUserMessage: message.content.slice(0, 160) }
    }
  }
  return {}
}

async function callOllama(
  messages: ChatMessageParam[],
  context: NavigationContext
): Promise<ProviderResponse> {
  const config = getServiceConfigSnapshot('ollama')
  const baseUrl = normalizeOllamaBaseUrl(config.baseUrl)
  const model = config.model?.trim() || 'llama3.1'
  const systemPrompt = buildSystemPrompt(context)
  const payload = withSystemPrompt(messages, systemPrompt)
  const summary = summarizeMessages(payload)
  logDebug('llm:ollama', 'Dispatching Ollama chat completion', {
    endpoint: baseUrl,
    model,
    messageCount: payload.length,
    lastUserMessage: summary.lastUserMessage,
  })
  const response = await callWithTimeout(
    fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: payload,
        stream: false,
      }),
    }),
    8000
  )
  const bodyText = await response.clone().text()
  let data: unknown = null
  if (bodyText) {
    try {
      data = JSON.parse(bodyText)
    } catch (_err) {
      data = null
    }
  }
  if (!response.ok) {
    const errorDetail = extractErrorDetail(data)
    const detail = errorDetail ? `: ${errorDetail}` : ''
    throw new Error(`Ollama returned ${response.status}${detail}`)
  }
  if (!data) {
    data = await response.json().catch(() => null)
  }
  const message = extractMessageContent(data)
  if (!message) {
    const errDetail = extractErrorDetail(data) ?? 'Ollama response missing content'
    throw new Error(errDetail)
  }
  const trimmed = String(message).trim()
  logInfo('llm:ollama', 'Ollama response received', {
    model,
    endpoint: baseUrl,
    length: trimmed.length,
  })
  return { provider: 'ollama', message: trimmed }
}

async function callOpenRouter(
  messages: ChatMessageParam[],
  context: NavigationContext
): Promise<ProviderResponse> {
  const config = getServiceConfigSnapshot('openRouter')
  const apiKey = config.apiKey?.trim()
  if (!apiKey) throw new Error('OpenRouter API key not configured')
  const completionsUrl = normalizeOpenRouterCompletionsUrl(config.baseUrl)
  const model = config.model?.trim() || 'x-ai/grok-4-fast:free'
  const systemPrompt = buildSystemPrompt(context)
  const payload = withSystemPrompt(messages, systemPrompt)
  const summary = summarizeMessages(payload)
  const referer = resolveRefererHeader() ?? 'https://hkg.robincheung.com'
  logDebug('llm:openrouter', 'Dispatching OpenRouter chat completion', {
    endpoint: completionsUrl,
    model,
    messageCount: payload.length,
    lastUserMessage: summary.lastUserMessage,
  })
  const response = await callWithTimeout(
    fetch(completionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'Hybrid Knowledge Graph (Robin L. M. Cheung, MBA) v0.1a',
        'HTTP-Referer': referer,
      },
      body: JSON.stringify({
        model,
        messages: payload,
      }),
    }),
    10000
  )
  const rawText = await response.clone().text()
  let data: unknown = null
  if (rawText) {
    try {
      data = JSON.parse(rawText)
    } catch (_err) {
      data = null
    }
  }
  if (!response.ok) {
    const errorDetail = extractErrorDetail(data)
    const detail = errorDetail ? `: ${errorDetail}` : ''
    throw new Error(`OpenRouter returned ${response.status}${detail}`)
  }
  if (!data) {
    data = await response.json().catch(() => null)
  }
  const message = extractMessageContent(data)
  if (!message) {
    const errDetail = extractErrorDetail(data) ?? 'OpenRouter response missing content'
    throw new Error(errDetail)
  }
  const trimmed = String(message).trim()
  logInfo('llm:openrouter', 'OpenRouter response received', {
    endpoint: completionsUrl,
    model,
    length: trimmed.length,
  })
  return { provider: 'openrouter', message: trimmed }
}

function parseAgentResponse(raw: string): ParsedAgentPayload {
  const trimmed = raw.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonCandidate = fencedMatch ? fencedMatch[1].trim() : trimmed
  let parsed: unknown = null
  try {
    parsed = JSON.parse(jsonCandidate)
  } catch (_err) {
    parsed = null
  }
  if (isRecord(parsed)) {
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : trimmed
    const actions = Array.isArray(parsed.actions) ? normalizeActions(parsed.actions) : []
    return { reply: reply || trimmed, actions }
  }
  return { reply: trimmed, actions: [] }
}

function normalizeActions(input: unknown[]): LLMAction[] {
  const actions: LLMAction[] = []
  input.forEach((item) => {
    if (!isRecord(item) || typeof item.type !== 'string') return
    const type = item.type as LLMAction['type']
    switch (type) {
      case 'highlightEntities': {
        const entities = Array.isArray(item.entities)
          ? item.entities.filter((entity): entity is string => typeof entity === 'string' && entity.trim().length > 0)
          : []
        if (entities.length > 0) actions.push({ type: 'highlightEntities', entities })
        break
      }
      case 'setTargetEntity': {
        if (typeof item.entity === 'string' && item.entity.trim()) {
          actions.push({ type: 'setTargetEntity', entity: item.entity })
        }
        break
      }
      case 'setLayout': {
        const layout = item.layout
        if (layout === 'sphere' || layout === 'grid' || layout === 'concept-centric') {
          actions.push({ type: 'setLayout', layout })
        }
        break
      }
      case 'sendQuery': {
        if (typeof item.query === 'string' && item.query.trim()) {
          actions.push({ type: 'sendQuery', query: item.query })
        }
        break
      }
      case 'analyzeEntity': {
        if (typeof item.entity === 'string' && item.entity.trim()) {
          actions.push({ type: 'analyzeEntity', entity: item.entity })
        }
        break
      }
      case 'followRelationship': {
        const from = typeof item.from === 'string' ? item.from : null
        const to = typeof item.to === 'string' ? item.to : null
        const relationship = typeof item.relationship === 'string' ? item.relationship : null
        if (from && to && relationship) {
          actions.push({ type: 'followRelationship', from, to, relationship })
        }
        break
      }
      case 'clearHighlights': {
        actions.push({ type: 'clearHighlights' })
        break
      }
      default:
        logDebug('llm:parser', 'Ignoring unsupported action type', { type })
    }
  })
  return actions
}

export async function navigateWithLLM(
  messages: ChatMessageParam[],
  context: NavigationContext
): Promise<LLMResult> {
  const order = resolveProviderOrder()
  let lastError: unknown
  for (const provider of order) {
    try {
      logDebug('llm', 'Attempting provider', { provider })
      const response =
        provider === 'ollama'
          ? await callOllama(messages, context)
          : await callOpenRouter(messages, context)
      const parsed = parseAgentResponse(response.message)
      logInfo(`llm:${response.provider}`, 'Agent payload parsed', {
        actions: parsed.actions.map((action) => action.type),
        replyLength: parsed.reply.length,
      })
      return {
        provider: response.provider,
        message: parsed.reply,
        actions: parsed.actions,
        raw: response.message,
      }
    } catch (err) {
      lastError = err
      logWarn(`llm:${provider}`, 'Navigation LLM call failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  logError('llm', 'All LLM providers failed', { providersTried: order })
  throw lastError ?? new Error('All LLM providers failed')
}

function resolveProviderOrder(): LLMProvider[] {
  const preferred = useSettingsStore.getState().llmProvider
  return preferred === 'openRouter' ? ['openRouter', 'ollama'] : ['ollama', 'openRouter']
}
