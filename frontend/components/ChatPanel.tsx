'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sql?: string
  results?: Record<string, unknown>[]
  blocked?: boolean
}

interface ChatPanelProps {
  onHighlightNodes: (ids: string[]) => void
}

const EXAMPLE_QUERIES = [
  "Which products have the most billing documents?",
  "Trace the full flow of billing document 90504259",
  "Show sales orders that were delivered but not billed",
  "Which customers have blocked accounts?",
]

export default function ChatPanel({ onHighlightNodes }: ChatPanelProps) {
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.content
      }))

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, conversation_history: history })
      })

      const data = await res.json()

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sql: data.sql,
        results: data.results,
        blocked: data.blocked
      }])

      // Highlight referenced nodes in graph
      if (data.results && data.results.length > 0) {
        const ids: string[] = []
        data.results.forEach((row: Record<string, unknown>) => {
          if (row.sales_order)      ids.push(`so_${row.sales_order}`)
          if (row.billing_document) ids.push(`bill_${row.billing_document}`)
          if (row.delivery_document) ids.push(`del_${row.delivery_document}`)
          if (row.business_partner) ids.push(`bp_${row.business_partner}`)
        })
        onHighlightNodes(ids)
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">Data Assistant</h2>
        <p className="text-xs text-gray-400">Ask anything about the O2C dataset</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 text-center">Try one of these:</p>
            {EXAMPLE_QUERIES.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)}
                className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-2 transition-colors">
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : msg.blocked
                  ? 'bg-red-900/40 border border-red-700 text-red-300'
                  : 'bg-gray-800 text-gray-100'
            }`}>
              {msg.content}
            </div>

            {/* Results count */}
            {msg.results && msg.results.length > 0 && (
              <span className="text-xs text-gray-500">{msg.results.length} rows returned</span>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400 animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask about orders, deliveries, billing..."
            className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-gray-700 focus:border-indigo-500 placeholder-gray-500"
          />
          <button onClick={() => sendMessage(input)} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2 transition-colors">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}