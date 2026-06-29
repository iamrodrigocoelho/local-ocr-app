import { useState, useCallback } from 'react'
import './styles/global.css'
import { submitJob, ApiError } from './api/jobs.js'
import { useJobStatus } from './hooks/useJobStatus.js'
import { UploadZone } from './components/UploadZone.js'
import { ProgressSteps } from './components/ProgressSteps.js'
import { ResultView } from './components/ResultView.js'
import { ErrorMessage } from './components/ErrorMessage.js'

type AppState =
  | { screen: 'upload'; error?: string }
  | { screen: 'uploading' }
  | { screen: 'processing'; jobId: string }
  | { screen: 'done'; jobId: string }
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

  const handleFile = useCallback(async (file: File) => {
    setState({ screen: 'uploading' })
    try {
      const { jobId } = await submitJob(file)
      setState({ screen: 'processing', jobId })
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Falha ao enviar o arquivo. Tente novamente.'
      setState({ screen: 'error', message: msg })
    }
  }, [])

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
        <h1
          style={{
            fontSize: 'var(--font-size-display-md)',
            fontWeight: 300,
            color: 'var(--color-ink)',
            letterSpacing: '-0.26px',
          }}
        >
          OCR File Reader
        </h1>
        <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-ink-mute)', marginTop: 'var(--space-xs)' }}>
          Processamento local · nenhum dado sai desta máquina
        </p>
      </header>

      {/* Main content */}
      <main
        style={{ width: '100%', maxWidth: 800, flex: 1 }}
        aria-live="polite"
        aria-atomic="true"
      >
        {(state.screen === 'upload' || state.screen === 'uploading') && (
          <>
            {state.screen === 'upload' && state.error && (
              <p
                role="alert"
                style={{
                  marginBottom: 'var(--space-lg)',
                  color: 'var(--color-ruby)',
                  fontSize: 'var(--font-size-body-md)',
                }}
              >
                {state.error}
              </p>
            )}
            <UploadZone onFile={handleFile} disabled={state.screen === 'uploading'} />
            {state.screen === 'uploading' && (
              <p
                style={{
                  marginTop: 'var(--space-lg)',
                  textAlign: 'center',
                  color: 'var(--color-ink-mute)',
                  fontSize: 'var(--font-size-caption)',
                }}
              >
                Enviando…
              </p>
            )}
          </>
        )}

        {state.screen === 'processing' && (
          <ProgressSteps currentStep={job.step} phase={job.phase} completedSteps={job.completedSteps} />
        )}

        {state.screen === 'done' && job.result && (
          <ResultView result={job.result} jobId={state.jobId} onReset={reset} />
        )}

        {state.screen === 'error' && (
          <ErrorMessage message={state.message} onRetry={reset} />
        )}
      </main>
    </div>
  )
}
