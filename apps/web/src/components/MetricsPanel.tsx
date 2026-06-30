import { useEffect, useState } from 'react'
import { fetchMetrics, type MetricsResponse } from '../api/batch.js'

export function MetricsPanel() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)

  useEffect(() => {
    fetchMetrics().then(setMetrics).catch(() => {})
  }, [])

  if (!metrics || metrics.total === 0) return null

  const avgSec = metrics.avgDurationMs != null
    ? (metrics.avgDurationMs / 1000).toFixed(1)
    : null

  return (
    <div
      aria-label="Métricas da sessão"
      style={{
        display: 'flex',
        gap: 'var(--space-lg)',
        flexWrap: 'wrap',
        fontSize: 'var(--font-size-micro)',
        color: 'var(--color-ink-mute)',
      }}
    >
      {[
        { label: 'total', value: metrics.total },
        { label: 'concluídos', value: metrics.byStatus['completed'] ?? 0 },
        { label: 'erros', value: metrics.byStatus['failed'] ?? 0 },
        avgSec ? { label: 'duração média', value: `${avgSec}s` } : null,
      ]
        .filter(Boolean)
        .map((item) => (
          <span key={item!.label} style={{ fontFeatureSettings: '"tnum"' }}>
            <strong style={{ color: 'var(--color-ink)', fontWeight: 400 }}>{item!.value}</strong>{' '}
            {item!.label}
          </span>
        ))}
    </div>
  )
}
