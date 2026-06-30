interface Props {
  currentStep: string | null
  phase: 'connecting' | 'processing' | 'completed' | 'failed' | 'canceled'
  completedSteps: string[]
}

export function ProgressSteps({ currentStep, phase, completedSteps }: Props) {
  const allSteps = [...completedSteps, ...(currentStep && !completedSteps.includes(currentStep) ? [currentStep] : [])]

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Progresso do processamento"
      style={{ maxWidth: 480, margin: '0 auto' }}
    >
      <p
        style={{
          fontSize: 'var(--font-size-heading-md)',
          marginBottom: 'var(--space-xl)',
          color: 'var(--color-ink)',
        }}
      >
        {phase === 'connecting' ? 'Iniciando…' : 'Processando documento'}
      </p>

      {allSteps.length > 0 && (
        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {allSteps.map((step, i) => {
            const isLast = i === allSteps.length - 1
            const done = phase === 'completed' || !isLast
            const active = isLast && phase === 'processing'
            return (
              <li
                key={`${step}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  color: done
                    ? 'var(--color-success)'
                    : active
                      ? 'var(--color-ink)'
                      : 'var(--color-ink-mute)',
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 'var(--rounded-pill)',
                    border: `2px solid ${done ? 'var(--color-success)' : active ? 'var(--color-primary)' : 'var(--color-hairline)'}`,
                    background: done ? 'var(--color-success)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 12,
                    color: done ? '#fff' : 'transparent',
                  }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span style={{ fontSize: 'var(--font-size-body-md)' }}>{step}</span>
                {active && (
                  <span
                    style={{ marginLeft: 'auto', fontSize: 'var(--font-size-caption)', color: 'var(--color-primary)' }}
                    aria-hidden="true"
                  >
                    em andamento…
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <p
        style={{
          marginTop: 'var(--space-xl)',
          fontSize: 'var(--font-size-caption)',
          color: 'var(--color-ink-mute)',
        }}
      >
        O processamento pode levar alguns minutos. Não feche esta janela.
      </p>
    </div>
  )
}
