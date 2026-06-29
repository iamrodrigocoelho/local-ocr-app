import { useState } from 'react'
import type { OcrResult } from '@ocr-reader/shared'
import { renderMarkdown } from '../utils/markdown.js'
import { ExportButtons } from './ExportButtons.js'

interface Props {
  result: OcrResult
  jobId: string
  onReset: () => void
}

export function ResultView({ result, jobId, onReset }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const page = result.pages[activeTab] ?? result.pages[0]
  const multiPage = result.pages.length > 1

  const durationSec = result.processing.durationMs
    ? (result.processing.durationMs / 1000).toFixed(1)
    : null

  const basename = result.source.filename.replace(/\.[^.]+$/, '') || 'resultado'

  const copyAll = () => {
    const text = result.pages.map((p) => p.transcription.markdown).join('\n\n---\n\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-heading-lg)', color: 'var(--color-ink)', fontWeight: 300 }}>
            Resultado
          </h2>
          <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-ink-mute)', marginTop: 'var(--space-xs)' }}>
            {result.source.filename}
            {` · ${result.pages.length} página${result.pages.length !== 1 ? 's' : ''}`}
            {durationSec && ` · ${durationSec}s`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
          <ExportButtons jobId={jobId} basename={basename} />
          <button
            onClick={onReset}
            style={{
              padding: 'var(--space-sm) var(--space-lg)',
              borderRadius: 'var(--rounded-pill)',
              border: 'none',
              color: '#fff',
              background: 'var(--color-primary)',
              fontSize: 'var(--font-size-body-md)',
              cursor: 'pointer',
            }}
          >
            Processar outro
          </button>
        </div>
      </div>

      {/* Page tabs (only for multi-page) */}
      {multiPage && (
        <div
          role="tablist"
          aria-label="Páginas do documento"
          style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', borderBottom: '1px solid var(--color-hairline)', paddingBottom: 'var(--space-xs)' }}
        >
          {result.pages.map((p, i) => (
            <button
              key={p.page}
              role="tab"
              aria-selected={i === activeTab}
              onClick={() => setActiveTab(i)}
              style={{
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--rounded-pill)',
                border: i === activeTab ? '1px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                color: i === activeTab ? 'var(--color-primary)' : 'var(--color-ink-mute)',
                background: 'var(--color-canvas)',
                fontSize: 'var(--font-size-caption)',
                cursor: 'pointer',
              }}
            >
              Pág. {p.page}
            </button>
          ))}
        </div>
      )}

      {/* Transcription */}
      <section aria-label="Transcrição do documento">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-heading-sm)', fontWeight: 300, color: 'var(--color-ink)' }}>
            Transcrição{multiPage ? ` — Página ${page.page}` : ''}
          </h3>
          <button
            onClick={copyAll}
            aria-label="Copiar transcrição"
            style={{
              padding: 'var(--space-xs) var(--space-md)',
              borderRadius: 'var(--rounded-pill)',
              border: '1px solid var(--color-hairline)',
              color: 'var(--color-ink-mute)',
              background: 'var(--color-canvas)',
              fontSize: 'var(--font-size-caption)',
              cursor: 'pointer',
            }}
          >
            Copiar tudo
          </button>
        </div>
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: renderMarkdown(page.transcription.markdown) }}
          style={{
            background: 'var(--color-canvas-soft)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-md)',
            padding: 'var(--space-xl)',
            fontSize: 'var(--font-size-body-md)',
            lineHeight: 1.6,
            color: 'var(--color-ink)',
            overflowX: 'auto',
            fontWeight: 300,
          }}
        />
      </section>

      {/* Field extraction notice (Phase 3 placeholder) */}
      {result.extraction.warnings.length > 0 && (
        <section
          aria-label="Extração de campos"
          style={{
            background: 'var(--color-canvas-cream)',
            borderRadius: 'var(--rounded-md)',
            padding: 'var(--space-lg)',
            fontSize: 'var(--font-size-caption)',
            color: 'var(--color-ink-secondary)',
          }}
        >
          {result.extraction.warnings[0]}
        </section>
      )}

      {/* Per-page metrics */}
      <section aria-label="Métricas de processamento">
        <h3 style={{ fontSize: 'var(--font-size-caption)', fontWeight: 400, color: 'var(--color-ink-mute)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Métricas{multiPage ? ` (pág. ${page.page})` : ''}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-sm)' }}>
          {[
            { label: 'Tokens/s', value: page.metrics.evalTokensPerSecond.toFixed(1) },
            { label: 'Entrada', value: page.metrics.inputTokens },
            { label: 'Saída', value: page.metrics.outputTokens },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: 'var(--color-canvas-soft)',
                borderRadius: 'var(--rounded-sm)',
                padding: 'var(--space-md)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--font-size-heading-md)',
                  fontFeatureSettings: '"tnum"',
                  color: 'var(--color-ink)',
                }}
              >
                {value}
              </div>
              <div style={{ fontSize: 'var(--font-size-micro)', color: 'var(--color-ink-mute)', marginTop: 2 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
