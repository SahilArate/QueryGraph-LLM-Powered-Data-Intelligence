'use client'
import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'

const NODE_COLORS: Record<string, string> = {
  sales_order:      '#6366f1',
  business_partner: '#10b981',
  delivery:         '#f59e0b',
  billing:          '#ef4444',
  product:          '#3b82f6',
}

interface GraphPanelProps {
  highlightedNodes: string[]
}

export default function GraphPanel({ highlightedNodes }: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef        = useRef<cytoscape.Core | null>(null)
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [stats, setStats]       = useState({ nodes: 0, edges: 0 })

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/graph/nodes`)
      .then(r => r.json())
      .then(({ nodes, edges }) => {
        if (!containerRef.current) return

        const elements = [
          ...nodes.map((n: {id: string; label: string; type: string; data: Record<string, unknown>}) => ({
            data: { id: n.id, label: n.label, type: n.type, meta: n.data }
          })),
          ...edges
            .filter((e: {source: string; target: string; label: string}) =>
              nodes.find((n: {id: string}) => n.id === e.source) &&
              nodes.find((n: {id: string}) => n.id === e.target)
            )
            .map((e: {source: string; target: string; label: string}, i: number) => ({
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
                'background-color': (el: cytoscape.NodeSingular) =>
                  NODE_COLORS[el.data('type')] || '#6b7280',
                'label': 'data(label)',
                'color': '#fff',
                'font-size': '9px',
                'text-valign': 'center',
                'text-halign': 'center',
                'width': 60,
                'height': 60,
                'text-wrap': 'wrap',
                'text-max-width': '55px',
                'border-width': 2,
                'border-color': '#1f2937',
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 1.5,
                'line-color': '#374151',
                'target-arrow-color': '#374151',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'label': 'data(label)',
                'font-size': '8px',
                'color': '#9ca3af',
              }
            },
            {
              selector: 'node.highlighted',
              style: {
                'border-color': '#fbbf24',
                'border-width': 4,
                'background-color': '#fbbf24',
                'color': '#000',
              }
            }
          ],
          layout: { name: 'cose', animate: true, randomize: false, padding: 30 }
        })

        cyRef.current.on('tap', 'node', (evt) => {
          setSelected(evt.target.data('meta'))
        })

        setStats({ nodes: nodes.length, edges: edges.length })
        setLoading(false)
      })
  }, [])

  // Highlight nodes when chat references them
  useEffect(() => {
    if (!cyRef.current) return
    cyRef.current.nodes().removeClass('highlighted')
    highlightedNodes.forEach(id => {
      cyRef.current?.getElementById(id).addClass('highlighted')
    })
  }, [highlightedNodes])

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h1 className="text-sm font-semibold text-white">QueryGraph</h1>
          <p className="text-xs text-gray-400">SAP Order-to-Cash Knowledge Graph</p>
        </div>
        <div className="flex gap-3 text-xs text-gray-400">
          <span>{stats.nodes} nodes</span>
          <span>{stats.edges} edges</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 px-4 py-2 border-b border-gray-800 flex-wrap">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-400 capitalize">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-gray-400 text-sm">Loading graph...</div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Node inspector */}
      {selected && (
        <div className="border-t border-gray-800 bg-gray-900 p-3 max-h-40 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-white">Node Details</span>
            <button onClick={() => setSelected(null)} className="text-gray-500 text-xs hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(selected).map(([k, v]) => (
            v ? <div key={k} className="text-xs">
                <span className="text-gray-500">{k}: </span>
                <span className="text-gray-200">{String(v)}</span>
            </div> : null
            ))}
          </div>
        </div>
      )}
    </div>
  )
}