import { useState } from 'react'
import type { OcrResult } from '@ocr-reader/shared'
import { useJobStatus } from '../hooks/useJobStatus.js'
import { cancelJob } from '../api/batch.js'
import { ResultView } from './ResultView.js'

interface BatchJob {
  jobId: string
  filename: string
}

interface Props {
  jobs: BatchJob[]
  onReset: () => void
}

function JobRow({ job, onViewResult }: { job: BatchJob; onViewResult: (jobId: string, result: OcrResult) => void }) {
  const status = useJobStatus(job.jobId)
  const [canceling, setCanceling] = useState(false)

  const handleCancel = async () => {
    setCanceling(true)
    try { await cancelJob(job.jobId) } catch { /* ignore */ }
    setCanceling(false)
  }

  const statusLabel: Record<string, string> = {
    connecting: 'Aguardando…',
    processing: status.step ?? 'Processando…',
    completed: 'Concluído',
    failed: 'Erro',
  }

  const statusColor: Record<string, string> = {
    connecting: 'var(--color-ink-mute)',
    processing: 'var(--color-primary)',
    completed: 'var(--color-success)',
    failed: 'var(--color-ruby)',
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--color-hairline)' }}>
      <td style={{ padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--font-size-body-md)', color: 'var(--color-ink)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {job.filename}
      </td>
      <td style={{ padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--font-size-caption)', color: statusColor[status.phase] }}>
        {statusLabel[status.phase] ?? status.phase}
      </td>
      <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          {status.phase === 'completed' && status.result && (
            <button
              type="button"
              onClick={() => onViewResult(job.jobId, status.result!)}
              style={{ padding: 'var(--space-xs) var(--space-sm)', borderRadius: 'var(--rounded-pill)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 'var(--font-size-caption)', cursor: 'pointer' }}
            >
              Ver resultado
            </button>
          )}
          {(status.phase === 'connecting' || status.phase === 'processing') && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={canceling}
              style={{ padding: 'var(--space-xs) var(--space-sm)', borderRadius: 'var(--rounded-pill)', border: '1px solid var(--color-hairline)', background: 'var(--color-canvas)', color: 'var(--color-ink-mute)', fontSize: 'var(--font-size-caption)', cursor: 'pointer', opacity: canceling ? 0.6 : 1 }}
            >
              Cancelar
            </button>
          )}
          {status.phase === 'failed' && status.error && (
            <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-ruby)' }} title={status.error}>
              {status.error.slice(0, 60)}{status.error.length > 60 ? '…' : ''}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

export function BatchView({ jobs, onReset }: Props) {
  const [viewing, setViewing] = useState<{ jobId: string; result: OcrResult } | null>(null)

  if (viewing) {
    return (
      <ResultView
        result={viewing.result}
        jobId={viewing.jobId}
        onReset={() => setViewing(null)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--font-size-heading-lg)', fontWeight: 300, color: 'var(--color-ink)' }}>
          Processamento em lote
        </h2>
        <button
          onClick={onReset}
          style={{ padding: 'var(--space-sm) var(--space-lg)', borderRadius: 'var(--rounded-pill)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 'var(--font-size-body-md)', cursor: 'pointer' }}
        >
          Novo envio
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-hairline)' }}>
            {['Arquivo', 'Status', 'Ação'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--font-size-caption)', color: 'var(--color-ink-mute)', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <JobRow
              key={job.jobId}
              job={job}
              onViewResult={(jobId, result) => setViewing({ jobId, result })}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
