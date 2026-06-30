import { useState, useCallback } from 'react'
import './styles/global.css'
import { submitJob, ApiError } from './api/jobs.js'
import { submitBatch, cancelJob } from './api/batch.js'
import { useJobStatus } from './hooks/useJobStatus.js'
import { UploadZone } from './components/UploadZone.js'
import { ProgressSteps } from './components/ProgressSteps.js'
import { ResultView } from './components/ResultView.js'
import { ErrorMessage } from './components/ErrorMessage.js'
import { BatchView } from './components/BatchView.js'
import { MetricsPanel } from './components/MetricsPanel.js'

type AppState =
  | { screen: 'upload'; error?: string }
  | { screen: 'uploading' }
  | { screen: 'processing'; jobId: string }
  | { screen: 'done'; jobId: string }
  | { screen: 'batch'; jobs: Array<{ jobId: string; filename: string }> }
  | { screen: 'error'; message: string }

export default function App() {
  const [state, setState] = useState<AppState>({ screen: 'upload' })
  const jobId = state.screen === 'processing' || state.screen === 'done' ? state.jobId : null
  const job = useJobStatus(jobId)

  // Reflect SSE completion back into app state
  if (state.screen === 'processing' && job.phase === 'completed') {
    setState({ screen: 'done', jobId: state.jobId })
  }
  if (state.screen === 'processing' && job.phase === 'failed' && job.error) {
    setState({ screen: 'error', message: job.error })
  }

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 1) {
      // Single file — use original single-job flow
      setState({ screen: 'uploading' })
      try {
        const { jobId } = await submitJob(files[0])
        setState({ screen: 'processing', jobId })
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Falha ao enviar o arquivo. Tente novamente.'
        setState({ screen: 'error', message: msg })
      }
    } else {
      // Multiple files — batch flow
      setState({ screen: 'uploading' })
      try {
        const { jobs } = await submitBatch(files)
        setState({ screen: 'batch', jobs })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao enviar arquivos.'
        setState({ screen: 'error', message: msg })
      }
    }
  }, [])

  const handleCancel = useCallback(async () => {
    if (state.screen !== 'processing') return
    try { await cancelJob(state.jobId) } catch { /* ignore */ }
    setState({ screen: 'upload' })
  }, [state])

  const reset = useCallback(() => setState({ screen: 'upload' }), [])

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-xxl) var(--space-lg)',
      }}
    >
      {/* Header */}
      <header
        style={{
          width: '100%',
          maxWidth: 800,
          marginBottom: 'var(--space-xxl)',
          paddingBottom: 'var(--space-xl)',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        <h1 style={{ fontSize: 'var(--font-size-display-md)', fontWeight: 300, color: 'var(--color-ink)', letterSpacing: '-0.26px' }}>
          OCR File Reader
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
          <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-ink-mute)' }}>
            Processamento local · nenhum dado sai desta máquina
          </p>
          <MetricsPanel />
        </div>
      </header>

      {/* Main content */}
      <main style={{ width: '100%', maxWidth: 800, flex: 1 }} aria-live="polite" aria-atomic="true">
        {(state.screen === 'upload' || state.screen === 'uploading') && (
          <>
            {state.screen === 'upload' && state.error && (
              <p role="alert" style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-ruby)', fontSize: 'var(--font-size-body-md)' }}>
                {state.error}
              </p>
            )}
            <UploadZone onFiles={handleFiles} disabled={state.screen === 'uploading'} />
            {state.screen === 'uploading' && (
              <p style={{ marginTop: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-ink-mute)', fontSize: 'var(--font-size-caption)' }}>
                Enviando…
              </p>
            )}
          </>
        )}

        {state.screen === 'processing' && (
          <div>
            <ProgressSteps currentStep={job.step} phase={job.phase} completedSteps={job.completedSteps} />
            <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
              <button
                onClick={handleCancel}
                style={{ padding: 'var(--space-xs) var(--space-lg)', borderRadius: 'var(--rounded-pill)', border: '1px solid var(--color-hairline)', background: 'var(--color-canvas)', color: 'var(--color-ink-mute)', fontSize: 'var(--font-size-caption)', cursor: 'pointer' }}
              >
                Cancelar processamento
              </button>
            </div>
          </div>
        )}

        {state.screen === 'done' && job.result && (
          <ResultView result={job.result} jobId={state.jobId} onReset={reset} />
        )}

        {state.screen === 'batch' && (
          <BatchView jobs={state.jobs} onReset={reset} />
        )}

        {state.screen === 'error' && (
          <ErrorMessage message={state.message} onRetry={reset} />
        )}
      </main>
    </div>
  )
}
