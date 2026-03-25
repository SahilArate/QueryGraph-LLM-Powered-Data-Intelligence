'use client'
import { useEffect, useState } from 'react'

interface Cluster {
  customer: string
  name: string
  tier: string
  color: string
  order_count: number
  total_value: number
  billing_count: number
  delivery_count: number
  has_broken_flow: boolean
}

interface Analytics {
  top_products: { material: string; product_old_id: string; billing_count: number; total_revenue: number }[]
  broken_flow_count: number
  total_revenue: number
  cancelled_billings: number
}

interface Summary {
  total_customers: number
  high_value: number
  medium_value: number
  low_value: number
  broken_flows: number
}

export default function AnalyticsPanel() {
  const [clusters, setClusters]   = useState<Cluster[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'clusters' | 'products'>('clusters')

  useEffect(() => {
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/graph/clusters`).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/graph/analytics`).then(r => r.json())
    ]).then(([clusterData, analyticsData]) => {
      setClusters(clusterData.clusters || [])
      setSummary(clusterData.summary || null)
      setAnalytics(analyticsData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fmt = (n: number) => n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n.toFixed(0)}`

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'rgba(8,12,20,0.7)', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(99,179,237,0.08)', background: 'rgba(8,12,20,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1' }} />
          <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500, letterSpacing: '0.06em' }}>GRAPH ANALYTICS</span>
        </div>

        {/* KPI row */}
        {summary && analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'Total Revenue', value: fmt(analytics.total_revenue), color: '#10b981' },
              { label: 'Broken Flows', value: analytics.broken_flow_count, color: '#ef4444' },
              { label: 'Cancelled Bills', value: analytics.cancelled_billings, color: '#f59e0b' },
              { label: 'Customers', value: summary.total_customers, color: '#6366f1' },
            ].map((kpi, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ color: kpi.color, fontSize: 16, fontWeight: 600 }}>{kpi.value}</div>
                <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 9, marginTop: 2, letterSpacing: '0.04em' }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(99,179,237,0.06)', background: 'rgba(8,12,20,0.4)' }}>
        {(['clusters', 'products'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t ? '#6366f1' : 'rgba(148,163,184,0.4)',
            fontSize: 10, letterSpacing: '0.08em', fontWeight: tab === t ? 600 : 400,
            borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
            transition: 'all 0.15s'
          }}>
            {t === 'clusters' ? 'CUSTOMER CLUSTERS' : 'TOP PRODUCTS'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #6366f1', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : tab === 'clusters' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
              {[{ label: 'High Value', color: '#ef4444' }, { label: 'Medium', color: '#f59e0b' }, { label: 'Low', color: '#10b981' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
                  <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 9 }}>{l.label}</span>
                </div>
              ))}
            </div>

            {clusters.map((c, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.color}20`,
                borderLeft: `3px solid ${c.color}`, borderRadius: '0 8px 8px 0',
                padding: '8px 12px', animation: `fadeInUp 0.3s ease ${i * 0.04}s both`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 500 }}>{c.name || c.customer}</div>
                    <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9, marginTop: 1 }}>{c.customer}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <div style={{ color: c.color, fontSize: 11, fontWeight: 600 }}>{fmt(c.total_value)}</div>
                    {c.has_broken_flow && (
                      <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '1px 6px', color: '#ef4444', fontSize: 8, letterSpacing: '0.06em' }}>
                        BROKEN FLOW
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[
                    { label: 'Orders', value: c.order_count },
                    { label: 'Deliveries', value: c.delivery_count },
                    { label: 'Billings', value: c.billing_count },
                  ].map(stat => (
                    <div key={stat.label} style={{ display: 'flex', gap: 4 }}>
                      <span style={{ color: 'rgba(148,163,184,0.35)', fontSize: 9 }}>{stat.label}</span>
                      <span style={{ color: '#94a3b8', fontSize: 9, fontWeight: 500 }}>{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>BY BILLING DOCUMENT COUNT</div>
            {analytics?.top_products.map((p, i) => {
              const maxCount = Math.max(...(analytics.top_products.map(x => x.billing_count)))
              const pct = (p.billing_count / maxCount) * 100
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', animation: `fadeInUp 0.3s ease ${i * 0.06}s both` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ color: '#e2e8f0', fontSize: 11 }}>{p.product_old_id || p.material}</div>
                      <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9, marginTop: 1 }}>{p.material}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#6366f1', fontSize: 12, fontWeight: 600 }}>{p.billing_count}</div>
                      <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9 }}>billings</div>
                    </div>
                  </div>
                  <div style={{ height: 3, background: 'rgba(99,102,241,0.1)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ marginTop: 4, color: 'rgba(148,163,184,0.35)', fontSize: 9 }}>
                    Revenue: {fmt(Number(p.total_revenue || 0))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}