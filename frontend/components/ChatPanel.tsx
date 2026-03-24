'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sql?: string
  results?: Record<string, unknown>[]
  blocked?: boolean
  timestamp?: string
}

interface ChatPanelProps {
  onHighlightNodes: (ids: string[]) => void
}

const EXAMPLE_QUERIES = [
  { icon: '◆', text: 'Which products have the most billing documents?', category: 'Analytics' },
  { icon: '◆', text: 'Trace the full flow of billing document 90504204', category: 'Trace' },
  { icon: '◆', text: 'Show sales orders delivered but not billed', category: 'Broken Flows' },
  { icon: '◆', text: 'Which customers have blocked accounts?', category: 'Customers' },
]

export default function ChatPanel({ onHighlightNodes }: ChatPanelProps) {
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [dots, setDots]             = useState('.')
  const bottomRef                   = useRef<HTMLDivElement>(null)
  const inputRef                    = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '.' : d + '.')
    }, 400)
    return () => clearInterval(interval)
  }, [loading])

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return
    setInput('')
    setLoading(true)

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg: Message = { role: 'user', content: question, timestamp: now }
    setMessages(prev => [...prev, userMsg])

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, conversation_history: history })
      })

      const data = await res.json()
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sql: data.sql,
        results: data.results,
        blocked: data.blocked,
        timestamp: replyTime
      }])

      if (data.results && data.results.length > 0) {
        const ids: string[] = []
        data.results.forEach((row: Record<string, unknown>) => {
          if (row.sales_order)       ids.push(`so_${row.sales_order}`)
          if (row.billing_document)  ids.push(`bill_${row.billing_document}`)
          if (row.delivery_document) ids.push(`del_${row.delivery_document}`)
          if (row.business_partner)  ids.push(`bp_${row.business_partner}`)
        })
        if (ids.length > 0) onHighlightNodes(ids)
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please ensure the backend is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(8,12,20,0.7)',
      fontFamily: "'DM Sans', sans-serif"
    }}>

      {/* Chat header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(99,179,237,0.08)',
        background: 'rgba(8,12,20,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
            boxShadow: '0 0 12px rgba(99,102,241,0.4)'
          }}>D</div>
          <div>
            <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>Dodge AI Agent</div>
            <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 10 }}>SAP O2C Intelligence</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 8px #10b981',
            animation: 'pulse 2s infinite'
          }} />
          <span style={{ color: '#10b981', fontSize: 10, letterSpacing: '0.06em' }}>
            {loading ? 'THINKING' : 'READY'}
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 16px',
        display: 'flex', flexDirection: 'column', gap: 12
      }}>

        {/* Welcome state */}
        {messages.length === 0 && (
          <div style={{ animation: 'fadeInUp 0.4s ease' }}>
            <div style={{
              textAlign: 'center', marginBottom: 24, paddingTop: 16
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: 20
              }}>⬡</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>
                Ask anything about your SAP data
              </div>
              <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11 }}>
                Orders · Deliveries · Billing · Payments · Products
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {EXAMPLE_QUERIES.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q.text)} style={{
                  background: 'rgba(99,102,241,0.05)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  borderRadius: 8, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  textAlign: 'left', width: '100%',
                  animation: `fadeInUp 0.4s ease ${i * 0.08}s both`
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.1)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.3)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.05)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.15)'
                  }}
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

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            animation: 'fadeInUp 0.25s ease',
            gap: 4
          }}>
            {/* Role label */}
            <div style={{
              color: 'rgba(148,163,184,0.3)', fontSize: 9,
              letterSpacing: '0.08em',
              paddingLeft: msg.role === 'assistant' ? 4 : 0,
              paddingRight: msg.role === 'user' ? 4 : 0,
            }}>
              {msg.role === 'user' ? 'YOU' : 'DODGE AI'} · {msg.timestamp}
            </div>

            {/* Message bubble */}
            <div style={{
              maxWidth: '88%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))'
                : msg.blocked
                  ? 'rgba(239,68,68,0.08)'
                  : 'rgba(255,255,255,0.04)',
              border: msg.role === 'user'
                ? '1px solid rgba(99,102,241,0.3)'
                : msg.blocked
                  ? '1px solid rgba(239,68,68,0.2)'
                  : '1px solid rgba(255,255,255,0.06)',
              color: msg.role === 'user' ? '#e2e8f0' : msg.blocked ? '#fca5a5' : '#cbd5e1',
              fontSize: 13,
              lineHeight: 1.6,
            }}>
              {msg.content}
            </div>

            {/* Results count */}
            {msg.results && msg.results.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                paddingLeft: 4
              }}>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: '#10b981'
                }} />
                <span style={{ color: '#10b981', fontSize: 10 }}>
                  {msg.results.length} records · nodes highlighted on graph
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ color: 'rgba(148,163,184,0.3)', fontSize: 9, letterSpacing: '0.08em', paddingLeft: 4 }}>
              DODGE AI
            </div>
            <div style={{
              padding: '10px 16px',
              borderRadius: '12px 12px 12px 2px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#6366f1',
                    animation: `bounce 1.2s ease infinite ${j * 0.2}s`,
                    opacity: 0.7
                  }} />
                ))}
              </div>
              <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11 }}>
                Analyzing{dots}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(99,179,237,0.08)',
        background: 'rgba(8,12,20,0.8)',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 10, padding: '4px 4px 4px 14px',
          transition: 'border-color 0.2s ease',
        }}
          onFocus={() => {}}
        >
          <span style={{ color: 'rgba(99,102,241,0.5)', fontSize: 12 }}>›</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask about orders, deliveries, billing..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              background: input.trim() && !loading
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'rgba(99,102,241,0.1)',
              border: 'none', borderRadius: 7,
              padding: '8px 16px', cursor: input.trim() && !loading ? 'pointer' : 'default',
              color: input.trim() && !loading ? '#fff' : 'rgba(148,163,184,0.3)',
              fontSize: 12, fontWeight: 500,
              transition: 'all 0.2s ease',
              letterSpacing: '0.04em'
            }}
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
        <div style={{
          textAlign: 'center', marginTop: 8,
          color: 'rgba(148,163,184,0.25)', fontSize: 10,
          letterSpacing: '0.04em'
        }}>
          Restricted to SAP O2C dataset · Guardrails active
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        input::placeholder { color: rgba(148,163,184,0.3); }
      `}</style>
    </div>
  )
}