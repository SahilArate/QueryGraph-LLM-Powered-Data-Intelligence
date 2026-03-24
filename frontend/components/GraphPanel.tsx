'use client'
import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'

const NODE_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  sales_order:      { bg: '#1e1b4b', border: '#6366f1', glow: 'rgba(99,102,241,0.4)' },
  business_partner: { bg: '#052e16', border: '#10b981', glow: 'rgba(16,185,129,0.4)' },
  delivery:         { bg: '#1c1917', border: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
  billing:          { bg: '#1c0a0a', border: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
  product:          { bg: '#0c1a2e', border: '#3b82f6', glow: 'rgba(59,130,246,0.4)' },
}

const LEGEND = [
  { type: 'business_partner', label: 'Customer',    color: '#10b981' },
  { type: 'sales_order',      label: 'Sales Order', color: '#6366f1' },
  { type: 'delivery',         label: 'Delivery',    color: '#f59e0b' },
  { type: 'billing',          label: 'Billing',     color: '#ef4444' },
  { type: 'product',          label: 'Product',     color: '#3b82f6' },
]

interface TooltipState {
  x: number; y: number; visible: boolean
  nodeType: string; nodeLabel: string
  meta: Record<string, unknown>
  connectedNodes: { label: string; type: string; edgeLabel: string }[]
}

interface GraphPanelProps {
  highlightedNodes: string[]
}

export default function GraphPanel({ highlightedNodes }: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef        = useRef<cytoscape.Core | null>(null)
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState<Record<string, unknown> | null>(null)
  const [selectedType, setSelectedType] = useState<string>('')
  const [stats, setStats]               = useState({ nodes: 0, edges: 0 })
  const [loadingText, setLoadingText]   = useState('Connecting to graph...')
  const [tooltip, setTooltip]           = useState<TooltipState>({
    x: 0, y: 0, visible: false,
    nodeType: '', nodeLabel: '', meta: {}, connectedNodes: []
  })

  useEffect(() => {
    const texts = ['Connecting to graph...', 'Loading nodes...', 'Mapping relationships...', 'Rendering visualization...']
    let i = 0
    const interval = setInterval(() => { i = (i + 1) % texts.length; setLoadingText(texts[i]) }, 800)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/graph/nodes`)
      .then(r => r.json())
      .then(({ nodes, edges }) => {
        if (!containerRef.current) return
        const elements = [
          ...nodes.map((n: { id: string; label: string; type: string; data: Record<string, unknown> }) => ({
            data: { id: n.id, label: n.label, type: n.type, meta: n.data }
          })),
          ...edges
            .filter((e: { source: string; target: string }) =>
              nodes.find((n: { id: string }) => n.id === e.source) &&
              nodes.find((n: { id: string }) => n.id === e.target)
            )
            .map((e: { source: string; target: string; label: string }, i: number) => ({
              data: { id: `e${i}`, source: e.source, target: e.target, label: e.label }
            }))
        ]

        cyRef.current = cytoscape({
          container: containerRef.current,
          elements,
          style: [
            {
              selector: 'node',
              style: {
                'background-color': (el: cytoscape.NodeSingular) => NODE_COLORS[el.data('type')]?.bg || '#1a1a2e',
                'border-color': (el: cytoscape.NodeSingular) => NODE_COLORS[el.data('type')]?.border || '#475569',
                'border-width': 1.5,
                'label': 'data(label)',
                'color': '#94a3b8',
                'font-size': '8px',
                'font-family': 'DM Mono, monospace',
                'text-valign': 'bottom',
                'text-halign': 'center',
                'text-margin-y': 4,
                'width': 28, 'height': 28,
                'text-wrap': 'wrap', 'text-max-width': '60px',
                'transition-property': 'border-color, border-width, width, height',
                'transition-duration': 150,
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 0.8,
                'line-color': 'rgba(99,179,237,0.15)',
                'target-arrow-color': 'rgba(99,179,237,0.25)',
                'target-arrow-shape': 'triangle',
                'arrow-scale': 0.6,
                'curve-style': 'bezier',
                'transition-property': 'line-color, width',
                'transition-duration': 150,
              }
            },
            { selector: 'node.hovered',     style: { 'border-width': 3, 'width': 38, 'height': 38 } },
            { selector: 'node.highlighted', style: { 'border-color': '#fbbf24', 'border-width': 3, 'width': 38, 'height': 38, 'color': '#fbbf24' } },
            { selector: 'node.selected',    style: { 'border-width': 3, 'width': 38, 'height': 38 } },
            { selector: 'edge.highlighted', style: { 'line-color': 'rgba(99,179,237,0.5)', 'width': 2 } }
          ],
          layout: {
            name: 'cose', animate: true, randomize: false, padding: 40,
            nodeRepulsion: () => 8000, idealEdgeLength: () => 80, edgeElasticity: () => 100,
          }
        })

        cyRef.current.on('mouseover', 'node', (evt) => {
          const node = evt.target
          const container = containerRef.current!
          const rect = container.getBoundingClientRect()
          const pos = node.renderedPosition()
          node.connectedEdges().addClass('highlighted')
          node.addClass('hovered')

          const connectedNodes: { label: string; type: string; edgeLabel: string }[] = []
          node.neighborhood('node').forEach((neighbor: cytoscape.NodeSingular) => {
            const edge = node.edgesWith(neighbor)
            connectedNodes.push({ label: neighbor.data('label'), type: neighbor.data('type'), edgeLabel: edge.data('label') || 'connected' })
          })

          let x = rect.left + pos.x + 24
          let y = rect.top + pos.y - 10
          if (x + 280 > window.innerWidth) x = rect.left + pos.x - 300
          if (y + 320 > window.innerHeight) y = window.innerHeight - 330

          setTooltip({ x, y, visible: true, nodeType: node.data('type'), nodeLabel: node.data('label'), meta: node.data('meta') || {}, connectedNodes })
        })

        cyRef.current.on('mouseout', 'node', (evt) => {
          evt.target.connectedEdges().removeClass('highlighted')
          evt.target.removeClass('hovered')
          setTooltip(prev => ({ ...prev, visible: false }))
        })

        cyRef.current.on('tap', 'node', (evt) => {
          cyRef.current?.nodes().removeClass('selected')
          evt.target.addClass('selected')
          setSelected(evt.target.data('meta'))
          setSelectedType(evt.target.data('type'))
        })

        cyRef.current.on('tap', (evt) => { if (evt.target === cyRef.current) setSelected(null) })

        setStats({ nodes: nodes.length, edges: edges.length })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!cyRef.current) return
    cyRef.current.nodes().removeClass('highlighted')
    highlightedNodes.forEach(id => cyRef.current?.getElementById(id).addClass('highlighted'))
    if (highlightedNodes.length > 0) {
      const firstNode = cyRef.current.getElementById(highlightedNodes[0])
      if (firstNode.length > 0) cyRef.current.animate({ center: { eles: firstNode }, zoom: 1.5 }, { duration: 600 })
    }
  }, [highlightedNodes])

  const typeColor    = NODE_COLORS[selectedType]?.border || '#6366f1'
  const tooltipColor = NODE_COLORS[tooltip.nodeType]?.border || '#6366f1'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', position: 'relative' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(99,179,237,0.08)', background: 'rgba(8,12,20,0.6)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? '#f59e0b' : '#10b981', boxShadow: loading ? '0 0 8px #f59e0b' : '0 0 8px #10b981' }} />
          <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500, letterSpacing: '0.06em' }}>KNOWLEDGE GRAPH</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11 }}>{stats.nodes} nodes</span>
          <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: 11 }}>·</span>
          <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11 }}>{stats.edges} edges</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 20px', borderBottom: '1px solid rgba(99,179,237,0.06)', background: 'rgba(8,12,20,0.4)', flexWrap: 'wrap', alignItems: 'center' }}>
        {LEGEND.map(({ type, label, color }) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
            <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 10 }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', color: 'rgba(148,163,184,0.3)', fontSize: 10 }}>Hover for details · Click to pin</div>
      </div>

      {/* Graph */}
      <div style={{ position: 'relative', flex: 1 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,12,20,0.8)', backdropFilter: 'blur(4px)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #6366f1', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
            <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12, letterSpacing: '0.08em' }}>{loadingText}</span>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Pinned inspector */}
      {selected && (
        <div style={{ borderTop: `1px solid ${typeColor}40`, background: 'rgba(8,12,20,0.95)', backdropFilter: 'blur(12px)', padding: '12px 20px', maxHeight: 160, overflowY: 'auto', animation: 'fadeInUp 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor, boxShadow: `0 0 6px ${typeColor}` }} />
              <span style={{ color: typeColor, fontSize: 11, fontWeight: 500, letterSpacing: '0.06em' }}>PINNED · {selectedType.replace('_', ' ').toUpperCase()}</span>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.4)', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 20px' }}>
            {Object.entries(selected).map(([k, v]) => v ? (
              <div key={k} style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 10, whiteSpace: 'nowrap' }}>{k}</span>
                <span style={{ color: '#cbd5e1', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</span>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* HOVER TOOLTIP */}
      {tooltip.visible && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y, zIndex: 9999,
          width: 272, background: 'rgba(6,9,16,0.98)',
          border: `1px solid ${tooltipColor}45`,
          borderRadius: 10, padding: '12px 14px',
          boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 24px ${tooltipColor}15`,
          animation: 'fadeInUp 0.15s ease', pointerEvents: 'none',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: tooltipColor, boxShadow: `0 0 10px ${tooltipColor}`, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tooltip.nodeLabel}</div>
              <div style={{ color: tooltipColor, fontSize: 9, letterSpacing: '0.08em', marginTop: 1 }}>{tooltip.nodeType.replace('_', ' ').toUpperCase()}</div>
            </div>
          </div>

          <div style={{ height: 1, background: `linear-gradient(90deg, ${tooltipColor}30, transparent)`, marginBottom: 10 }} />

          {/* Metadata */}
          {Object.keys(tooltip.meta).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: 'rgba(148,163,184,0.35)', fontSize: 9, letterSpacing: '0.1em', marginBottom: 6 }}>NODE DETAILS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(tooltip.meta).filter(([, v]) => v).slice(0, 6).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ color: 'rgba(148,163,184,0.35)', fontSize: 10, whiteSpace: 'nowrap', minWidth: 75 }}>{k}</span>
                    <span style={{ color: '#94a3b8', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connections */}
          {tooltip.connectedNodes.length > 0 && (
            <>
              <div style={{ height: 1, background: 'rgba(99,179,237,0.08)', marginBottom: 10 }} />
              <div>
                <div style={{ color: 'rgba(148,163,184,0.35)', fontSize: 9, letterSpacing: '0.1em', marginBottom: 6 }}>
                  CONNECTIONS ({tooltip.connectedNodes.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {tooltip.connectedNodes.slice(0, 5).map((cn, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: NODE_COLORS[cn.type]?.border || '#475569' }} />
                      <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: 10, whiteSpace: 'nowrap' }}>{cn.edgeLabel}</span>
                      <span style={{ color: '#475569', fontSize: 10 }}>→</span>
                      <span style={{ color: '#94a3b8', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cn.label}</span>
                    </div>
                  ))}
                  {tooltip.connectedNodes.length > 5 && (
                    <span style={{ color: 'rgba(148,163,184,0.25)', fontSize: 10 }}>+{tooltip.connectedNodes.length - 5} more</span>
                  )}
                </div>
              </div>
            </>
          )}

          {tooltip.connectedNodes.length === 0 && (
            <div style={{ color: 'rgba(148,163,184,0.25)', fontSize: 10 }}>No visible connections in current view</div>
          )}

          {/* Bottom hint */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(99,179,237,0.06)', color: 'rgba(148,163,184,0.2)', fontSize: 9, letterSpacing: '0.06em' }}>
            CLICK TO PIN · SCROLL TO ZOOM
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}