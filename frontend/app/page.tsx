'use client'
import { useState } from 'react'
import GraphPanel from '@/components/GraphPanel'
import ChatPanel from '@/components/ChatPanel'

export default function Home() {
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([])

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-gray-950 text-white">
      {/* Left — Graph Panel */}
      <div className="w-3/5 h-full border-r border-gray-800">
        <GraphPanel highlightedNodes={highlightedNodes} />
      </div>

      {/* Right — Chat Panel */}
      <div className="w-2/5 h-full">
        <ChatPanel onHighlightNodes={setHighlightedNodes} />
      </div>
    </main>
  )
}