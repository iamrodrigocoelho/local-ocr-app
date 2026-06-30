import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from 'react'

const ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf'
const ACCEPT_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function UploadZone({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      const valid = Array.from(fileList).filter((f) => ACCEPT_MIME.includes(f.type))
      if (valid.length > 0) onFiles(valid)
    },
    [onFiles],
  )

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <div
      role="region"
      aria-label="Área de upload de documento"
      style={{
        border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-hairline-input)'}`,
        borderRadius: 'var(--rounded-lg)',
        padding: 'var(--space-huge)',
        textAlign: 'center',
        background: dragging ? 'var(--color-canvas-soft)' : 'var(--color-canvas)',
        transition: 'border-color 0.15s, background 0.15s',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: 'none' }}
        onChange={onInputChange}
        aria-label="Selecionar arquivos"
        disabled={disabled}
      />

      <p style={{ fontSize: 'var(--font-size-display-md)', marginBottom: 'var(--space-lg)' }}>
        📄
      </p>
      <p style={{ fontSize: 'var(--font-size-body-lg)', color: 'var(--color-ink)', marginBottom: 'var(--space-sm)' }}>
        Arraste arquivos aqui ou{' '}
        <button
          type="button"
          style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
          disabled={disabled}
        >
          clique para selecionar
        </button>
      </p>
      <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-ink-mute)' }}>
        PNG, JPG, WEBP, PDF · máx. 50 MB · múltiplos arquivos aceitos
      </p>
    </div>
  )
}
