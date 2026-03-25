'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sql?: string
  results?: Record<string, unknown>[]
  blocked?: boolean
  timestamp?: string
  streaming?: boolean
}

interface ChatPanelProps {
  onHighlightNodes: (ids: string[]) => void
}

const EXAMPLE_QUERIES = [
  { icon: '◆', text: 'Which products have the most billing documents?', category: 'Analytics' },
  { icon: '◆', text: 'Trace the full flow of billing document 90504204', category: 'Trace' },
  { icon: '◆', text: 'Show sales orders delivered but not billed', category: 'Broken Flows' },
  { icon: '◆', text: 'Which customers have blocked accounts?', category: 'Customers' },
  { icon: '◆', text: 'What is the total revenue per customer?', category: 'Analytics' },
  { icon: '◆', text: 'Show all cancelled billing documents', category: 'Billing' },
]

export default function ChatPanel({ onHighlightNodes }: ChatPanelProps) {
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [, setDots] = useState('.')
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 400)
    return () => clearInterval(interval)
  }, [loading])

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return
    setInput('')
    setLoading(true)

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { role: 'user', content: question, timestamp: now }])

    setMessages(prev => [...prev, {
      role: 'assistant', content: '', timestamp: now, streaming: true
    }])

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/query/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, conversation_history: history })
      })

      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let finalData: { sql?: string; results?: Record<string, unknown>[]; blocked?: boolean } = {}

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.token) {
              fullContent += data.token
              setMessages(prev => {
                const updated = [...prev]
                const lastIdx = updated.length - 1
                updated[lastIdx] = { ...updated[lastIdx], content: fullContent, streaming: true }
                return updated
              })
            }
            if (data.done) {
              finalData = data
            }
          } catch {}
        }
      }

      // Finalize message
      setMessages(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: fullContent,
          streaming: false,
          sql: finalData.sql,
          results: finalData.results,
          blocked: finalData.blocked
        }
        return updated
      })

      // Highlight nodes
      if (finalData.results && finalData.results.length > 0) {
        const ids: string[] = []
        finalData.results.forEach((row: Record<string, unknown>) => {
          if (row.sales_order)       ids.push(`so_${row.sales_order}`)
          if (row.billing_document)  ids.push(`bill_${row.billing_document}`)
          if (row.delivery_document) ids.push(`del_${row.delivery_document}`)
          if (row.business_partner)  ids.push(`bp_${row.business_partner}`)
        })
        if (ids.length > 0) onHighlightNodes(ids)
      }

    } catch {
      setMessages(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        updated[lastIdx] = { ...updated[lastIdx], content: 'Connection error. Please ensure the backend is running.', streaming: false }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(8,12,20,0.7)', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(99,179,237,0.08)', background: 'rgba(8,12,20,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', boxShadow: '0 0 12px rgba(99,102,241,0.4)' }}>D</div>
          <div>
            <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>Dodge AI Agent</div>
            <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10 }}>SAP O2C Intelligence · Streaming</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }} />
          <span style={{ color: '#10b981', fontSize: 10, letterSpacing: '0.06em' }}>{loading ? 'STREAMING' : 'READY'}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {messages.length === 0 && (
          <div style={{ animation: 'fadeInUp 0.4s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20 }}>⬡</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>Ask anything about your SAP data</div>
              <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11 }}>Orders · Deliveries · Billing · Payments · Products</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EXAMPLE_QUERIES.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q.text)} style={{
                  background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
                  borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center',
                  gap: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
                  animation: `fadeInUp 0.4s ease ${i * 0.06}s both`, transition: 'all 0.15s'
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.15)' }}
                >
                  <span style={{ color: '#6366f1', fontSize: 10 }}>{q.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 1 }}>{q.text}</div>
                    <div style={{ color: 'rgba(148,163,184,0.35)', fontSize: 10 }}>{q.category}</div>
                  </div>
                  <span style={{ color: 'rgba(148,163,184,0.25)', fontSize: 12 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeInUp 0.25s ease', gap: 4 }}>
            <div style={{ color: 'rgba(148,163,184,0.3)', fontSize: 9, letterSpacing: '0.08em', paddingLeft: msg.role === 'assistant' ? 4 : 0, paddingRight: msg.role === 'user' ? 4 : 0 }}>
              {msg.role === 'user' ? 'YOU' : 'DODGE AI'} · {msg.timestamp}
            </div>

            <div style={{
              maxWidth: '90%', padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))'
                : msg.blocked ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
              border: msg.role === 'user'
                ? '1px solid rgba(99,102,241,0.3)'
                : msg.blocked ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
              color: msg.role === 'user' ? '#e2e8f0' : msg.blocked ? '#fca5a5' : '#cbd5e1',
              fontSize: 13, lineHeight: 1.6,
            }}>
              {msg.content}
              {msg.streaming && (
                <span style={{ display: 'inline-block', width: 2, height: 14, background: '#6366f1', marginLeft: 2, animation: 'blink 1s infinite', verticalAlign: 'middle' }} />
              )}
            </div>

            {msg.results && msg.results.length > 0 && !msg.streaming && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ color: '#10b981', fontSize: 10 }}>{msg.results.length} records · nodes highlighted</span>
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(99,179,237,0.08)', background: 'rgba(8,12,20,0.8)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '4px 4px 4px 14px' }}>
          <span style={{ color: 'rgba(99,102,241,0.5)', fontSize: 12 }}>›</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask about orders, deliveries, billing..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              background: input.trim() && !loading ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.1)',
              border: 'none', borderRadius: 7, padding: '8px 16px',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              color: input.trim() && !loading ? '#fff' : 'rgba(148,163,184,0.3)',
              fontSize: 12, fontWeight: 500, transition: 'all 0.2s', letterSpacing: '0.04em'
            }}
          >{loading ? '...' : 'Send'}</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 6, color: 'rgba(148,163,184,0.2)', fontSize: 10, letterSpacing: '0.04em' }}>
          Streaming · Guardrails active · Node highlighting enabled
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        input::placeholder { color: rgba(148,163,184,0.3); }
      `}</style>
    </div>
  )
}