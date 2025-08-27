// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useRef, useState } from 'react'
import useStore from '../state/store'
import { highlightEntities, setTargetEntity, setLayout } from '../state/actions'

export default function AINavigationChat(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{ type: 'user' | 'ai'; content: string; matchedEntities?: any[]; action?: string; timestamp: Date }[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const entities = useStore.use.entities()

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (isOpen) inputRef.current?.focus() }, [isOpen])
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ type: 'ai', content: 'Hello! Ask me to "show me" or "navigate to" concepts, people, places, or events.', timestamp: new Date() }])
    }
  }, [])

  async function processNavigationRequest(userQuery: string) {
    try {
      const q = userQuery.toLowerCase()
      let action = q.match(/\b(fly|navigate|go to|show me)\b/) ? 'navigate' : q.match(/\b(find|search|locate)\b/) ? 'search' : 'explore'
      const keywords = extractKeywords(q)
      const matches = findMatchingEntities(keywords)
      if (matches.length > 0) {
        const names = matches.map((e) => e.name)
        highlightEntities(names)
        if (matches.length === 1) setTargetEntity(matches[0].name)
        suggestLayout(matches)
        return { content: responseFor(action, matches, userQuery), matchedEntities: matches, action }
      }
      return { content: noMatchResponse(userQuery, keywords), matchedEntities: [], action: 'none' }
    } catch (e) {
      console.error('AI nav error:', e)
      return { content: 'I encountered an issue. Please try rephrasing your request.', matchedEntities: [], action: 'error' }
    }
  }

  function extractKeywords(q: string) {
    const stop = new Set(['the','to','and','or','but','in','on','at','by','for','with','from','fly','navigate','go','show','me','find','search','locate','take','bring'])
    return q.replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !stop.has(w))
  }

  function findMatchingEntities(keywords: string[]) {
    const matches: any[] = []
    entities.forEach((e) => {
      let score = 0
      for (const k of keywords) {
        if (e.name.toLowerCase().includes(k)) score += 10
        if (e.description?.toLowerCase().includes(k)) score += 5
        if (e.type.toLowerCase().includes(k)) score += 3
      }
      const hist = ['historical','ancient','medieval','renaissance','modern','contemporary','century','era','period','gutenberg','printing','press']
      if (keywords.some((k) => hist.includes(k)) && (e.type === 'EVENT' || /\d{2,4}/.test(e.name))) score += 15
      const conceptTerms = ['concept','idea','theory','principle','anthropological','sociological','cultural','social','primitive','artifact','divergence']
      if (keywords.some((k) => conceptTerms.includes(k)) && e.type === 'CONCEPT') score += 12
      if (score > 0) matches.push({ ...e, score })
    })
    return matches.sort((a, b) => b.score - a.score).slice(0, 8)
  }

  function responseFor(action: string, list: any[], original: string) {
    if (list.length === 1) return `🎯 Navigating to "${list[0].name}" (${list[0].type}). ${list[0].description || ''}`
    if (list.length <= 3) return `🔍 Found ${list.length} relevant entities: ${list.map((e) => `"${e.name}"`).join(', ')}.`
    return `📍 Found ${list.length} entities. Top: ${list.slice(0,3).map((e)=>`"${e.name}"`).join(', ')} and ${list.length-3} more.`
  }

  function noMatchResponse(query: string, keywords: string[]) {
    const suggestions = [
      "Try broader terms like 'technology', 'history', 'culture', or 'society'",
      'Search for specific people, places, or events',
      "Use phrases like 'concepts related to...' or 'events around...'",
      'Ask about entity types: PERSON, ORGANIZATION, LOCATION, CONCEPT, EVENT',
    ]
    const s = suggestions[Math.floor(Math.random() * suggestions.length)]
    return `🤔 I couldn't find matches for "${query}". ${s}.`
  }

  function suggestLayout(matched: any[]) {
    const types = new Set(matched.map((e) => e.type))
    if (types.has('CONCEPT') && matched.filter((e) => e.type === 'CONCEPT').length >= 2) setLayout('concept-centric')
    else if (types.size > 2) setLayout('sphere')
  }

  async function send() {
    if (!inputValue.trim() || isProcessing) return
    const msg = { type: 'user' as const, content: inputValue.trim(), timestamp: new Date() }
    setMessages((p) => [...p, msg])
    setInputValue('')
    setIsProcessing(true)
    const res = await processNavigationRequest(msg.content)
    setMessages((p) => [...p, { type: 'ai', content: res.content, matchedEntities: res.matchedEntities, action: res.action, timestamp: new Date() }])
    setIsProcessing(false)
  }

  return !isOpen ? (
    <button
      onClick={() => setIsOpen(true)}
      style={{ position: 'absolute', bottom: 120, left: 20, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: 50, padding: '15px 20px', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500, backdropFilter: 'blur(10px)', borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', boxShadow: '0 8px 32px rgba(102,126,234,0.4)' }}
      title="AI Navigator"
    >
      🧭 AI Navigator
    </button>
  ) : (
    <div
      style={{ position: 'absolute', bottom: 120, left: 20, width: 400, height: 500, background: 'rgba(0, 0, 0, 0.92)', borderRadius: 16, backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
    >
      <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🧭</span>
          <div>
            <div style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>AI Navigator</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Natural language graph exploration</div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 20, cursor: 'pointer', padding: 5, borderRadius: '50%' }} title="Close">×</button>
      </div>

      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: m.type === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.type === 'user' ? 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{m.type === 'user' ? '👤' : '🧭'}</div>
            <div style={{ background: m.type === 'user' ? 'rgba(78,205,196,0.2)' : 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: 12, color: 'white', fontSize: 14, lineHeight: 1.4, maxWidth: 280, border: m.type === 'user' ? '1px solid rgba(78,205,196,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>
              {m.content}
              {!!m.matchedEntities?.length && (
                <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>Highlighted: {m.matchedEntities.length} entities</div>
                  {m.matchedEntities.slice(0,3).map((e) => (
                    <div key={e.name} style={{ color: 'rgba(255,255,255,0.8)' }}>• {e.name} ({e.type})</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧭</div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
              <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Navigating...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
            placeholder="Navigate to concepts about..."
            disabled={isProcessing}
            style={{ flex: 1, padding: '12px 16px', background: 'rgba(255,255,255,0.1)', borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 25, color: 'white', fontSize: 14, outline: 'none' }}
          />
          <button onClick={() => void send()} disabled={!inputValue.trim() || isProcessing} style={{ background: inputValue.trim() && !isProcessing ? 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: 'white', cursor: inputValue.trim() && !isProcessing ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}> {isProcessing ? '⏳' : '🚀'} </button>
        </div>
      </div>

      <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`}</style>
    </div>
  )
}

