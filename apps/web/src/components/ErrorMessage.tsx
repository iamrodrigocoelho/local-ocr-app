interface Props {
  message: string
  onRetry: () => void
}

const OLLAMA_HINT = 'ollama'

export function ErrorMessage({ message, onRetry }: Props) {
  const isOllamaError = message.toLowerCase().includes(OLLAMA_HINT)

  return (
    <div
      role="alert"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: 'var(--space-xxl)',
        background: 'var(--color-canvas-soft)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--rounded-lg)',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 32, marginBottom: 'var(--space-lg)' }} aria-hidden="true">⚠️</p>

      <h2
        style={{
          fontSize: 'var(--font-size-heading-md)',
          fontWeight: 300,
          color: 'var(--color-ink)',
          marginBottom: 'var(--space-md)',
        }}
      >
        Algo deu errado
      </h2>

      <p
        style={{
          fontSize: 'var(--font-size-body-md)',
          color: 'var(--color-ink-secondary)',
          marginBottom: 'var(--space-md)',
        }}
      >
        {message}
      </p>

      {isOllamaError && (
        <p
          style={{
            fontSize: 'var(--font-size-caption)',
            color: 'var(--color-ink-mute)',
            background: 'var(--color-canvas-cream)',
            borderRadius: 'var(--rounded-sm)',
            padding: 'var(--space-md)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          Verifique se o Ollama está em execução:{' '}
          <code style={{ fontSize: 'inherit' }}>ollama serve</code>
        </p>
      )}

      <button
        onClick={onRetry}
        style={{
          padding: 'var(--space-sm) var(--space-xl)',
          borderRadius: 'var(--rounded-pill)',
          background: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          fontSize: 'var(--font-size-body-md)',
          fontWeight: 400,
          border: 'none',
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        Tentar novamente
      </button>
    </div>
  )
}
