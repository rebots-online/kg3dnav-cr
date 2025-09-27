// SPDX-License-Identifier: Apache-2.0
import useSettingsStore, {
  DEFAULT_SERVICE_ENDPOINTS,
  getServiceConfigSnapshot,
  LLMProvider,
} from '../state/settingsStore'

type NavigationContext = {
  matches: Array<{ name: string; type?: string; description?: string }>
  action?: string
}

export type LLMResult = {
  provider: 'ollama' | 'openrouter' | 'fallback'
  message: string
}

function buildSystemPrompt(context: NavigationContext): string {
  const lines = context.matches.slice(0, 5).map((match, idx) => {
    const desc = match.description ? ` — ${match.description}` : ''
    return `${idx + 1}. ${match.name}${match.type ? ` [${match.type}]` : ''}${desc}`
  })
  const focus =
    context.action && context.action !== 'none' ? `Focus on helping the user to ${context.action}.` : ''
  return [
    'You are the navigation copilot for a 3D knowledge graph.',
    'Highlight the most relevant entities, suggest related paths, and keep responses concise (<= 4 bullet lines).',
    lines.length ? `Entities already highlighted:\n${lines.join('\n')}` : 'No entities are highlighted yet.',
    focus,
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

async function callOllama(prompt: string, context: NavigationContext): Promise<LLMResult> {
  const config = getServiceConfigSnapshot('ollama')
  const baseUrl = normalizeOllamaBaseUrl(config.baseUrl)
  const model = config.model?.trim() || 'llama3.1'
  const systemPrompt = buildSystemPrompt(context)
  const response = await callWithTimeout(
    fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
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
  return { provider: 'ollama', message: String(message).trim() }
}

async function callOpenRouter(prompt: string, context: NavigationContext): Promise<LLMResult> {
  const config = getServiceConfigSnapshot('openRouter')
  const apiKey = config.apiKey?.trim()
  if (!apiKey) throw new Error('OpenRouter API key not configured')
  const completionsUrl = normalizeOpenRouterCompletionsUrl(config.baseUrl)
  const model = config.model?.trim() || 'x-ai/grok-4-fast:free'
  const systemPrompt = buildSystemPrompt(context)
  const referer = resolveRefererHeader() ?? 'https://hkg.robincheung.com'
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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
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
  return { provider: 'openrouter', message: String(message).trim() }
}

export async function navigateWithLLM(prompt: string, context: NavigationContext): Promise<LLMResult> {
  const order = resolveProviderOrder()
  let lastError: unknown
  for (const provider of order) {
    try {
      if (provider === 'ollama') {
        return await callOllama(prompt, context)
      }
      return await callOpenRouter(prompt, context)
    } catch (err) {
      lastError = err
      console.warn(`${provider} navigation call failed:`, err)
    }
  }
  throw lastError ?? new Error('All LLM providers failed')
}

function resolveProviderOrder(): LLMProvider[] {
  const preferred = useSettingsStore.getState().llmProvider
  return preferred === 'openRouter' ? ['openRouter', 'ollama'] : ['ollama', 'openRouter']
}
