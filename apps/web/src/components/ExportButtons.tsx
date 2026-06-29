const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://127.0.0.1:3000'

interface Props {
  jobId: string
  basename: string
}

const FORMATS: { format: string; label: string }[] = [
  { format: 'json', label: 'JSON' },
  { format: 'csv', label: 'CSV' },
  { format: 'xlsx', label: 'Excel' },
]

export function ExportButtons({ jobId, basename }: Props) {
  const download = (format: string) => {
    const url = `${API_BASE}/jobs/${jobId}/export/${format}`
    const a = document.createElement('a')
    a.href = url
    a.download = `${basename}.${format}`
    a.click()
  }

  return (
    <div
      aria-label="Exportar resultado"
      style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}
    >
      {FORMATS.map(({ format, label }) => (
        <button
          key={format}
          type="button"
          onClick={() => download(format)}
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
          ↓ {label}
        </button>
      ))}
    </div>
  )
}
