// SPDX-License-Identifier: Apache-2.0
import useSettingsStore, { getServiceConfigSnapshot, LLMProvider } from '../state/settingsStore'

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

function sanitizeUrl(url: string | undefined, fallback: string): string {
  const base = (url || fallback || '').trim()
  if (!base) return fallback
  return base.replace(/\/$/, '')
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
  const baseUrl = sanitizeUrl(config.baseUrl, 'http://localhost:11434')
  const model = config.model?.trim() || 'llama3.1'
  const systemPrompt = buildSystemPrompt(context)
  const response = await callWithTimeout(
    fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`)
  }
  const data = await response.json()
  const message = data?.message?.content || data?.choices?.[0]?.message?.content
  if (!message) throw new Error('Ollama response missing content')
  return { provider: 'ollama', message: String(message).trim() }
}

async function callOpenRouter(prompt: string, context: NavigationContext): Promise<LLMResult> {
  const config = getServiceConfigSnapshot('openRouter')
  const apiKey = config.apiKey?.trim()
  if (!apiKey) throw new Error('OpenRouter API key not configured')
  const baseUrl = sanitizeUrl(config.baseUrl, 'https://openrouter.ai/api/v1/chat/completions')
  const completionsUrl = resolveCompletionsUrl(baseUrl)
  const model = config.model?.trim() || 'x-ai/grok-4-fast:free'
  const systemPrompt = buildSystemPrompt(context)
  const response = await callWithTimeout(
    fetch(completionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'Hybrid Knowledge Graph (Robin L. M. Cheung, MBA) v0.1a',
        'HTTP-Referer': 'https://hkg.robincheung.com',
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
  if (!response.ok) {
    throw new Error(`OpenRouter returned ${response.status}`)
  }
  const data = await response.json()
  const message = data?.choices?.[0]?.message?.content
  if (!message) throw new Error('OpenRouter response missing content')
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

function resolveCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '')
  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized
  }
  return `${normalized}/chat/completions`
}
