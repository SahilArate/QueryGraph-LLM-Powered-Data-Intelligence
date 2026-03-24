'use client'
import { useState } from 'react'
import GraphPanel from '@/components/GraphPanel'
import ChatPanel from '@/components/ChatPanel'

export default function Home() {
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([])

  return (
    <main className="flex h-screen w-screen overflow-hidden" style={{
      background: '#080c14',
      fontFamily: "'DM Mono', 'JetBrains Mono', monospace"
    }}>
      {/* Animated background grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(233, 236, 238, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(237, 240, 242, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        pointerEvents: 'none'
      }} />

      {/* Glow orbs */}
      <div style={{
        position: 'fixed', top: '20%', left: '30%', width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'fixed', bottom: '20%', right: '25%', width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0
      }} />

      {/* Top header bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 52, zIndex: 50,
        background: 'rgba(8,12,20,0.95)',
        borderBottom: '1px solid rgba(99,179,237,0.1)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff'
          }}>Q</div>
          <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>
            QUERYGRAPH
          </span>
          <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>/</span>
          <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12 }}>SAP Order-to-Cash Intelligence</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ color: '#10b981', fontSize: 11, letterSpacing: '0.08em' }}>LIVE</span>
          </div>
          <div style={{
            padding: '4px 12px', borderRadius: 4,
            border: '1px solid rgba(99,102,241,0.3)',
            color: 'rgba(148,163,184,0.7)', fontSize: 11, letterSpacing: '0.05em'
          }}>
            GROQ · llama-3.3-70b
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', width: '100%', paddingTop: 52, position: 'relative', zIndex: 1 }}>
        {/* Left — Graph Panel */}
        <div style={{ width: '60%', height: 'calc(100vh - 52px)', borderRight: '1px solid rgba(99,179,237,0.08)' }}>
          <GraphPanel highlightedNodes={highlightedNodes} />
        </div>

        {/* Right — Chat Panel */}
        <div style={{ width: '40%', height: 'calc(100vh - 52px)' }}>
          <ChatPanel onHighlightNodes={setHighlightedNodes} />
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 2px; }
      `}</style>
    </main>
  )
}