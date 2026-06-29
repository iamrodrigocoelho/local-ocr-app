import { useState } from 'react'
import type { ExtractedField } from '@ocr-reader/shared'

interface Props {
  fields: Record<string, ExtractedField>
  documentType: string | null
  warnings: string[]
  onSave: (documentType: string | null, fields: Record<string, ExtractedField>) => Promise<void>
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.85) return 'var(--color-success)'
  if (confidence >= 0.5) return '#e9a800'
  return 'var(--color-ruby)'
}

export function FieldEditor({ fields, documentType, warnings, onSave }: Props) {
  const [localFields, setLocalFields] = useState<Record<string, ExtractedField>>(fields)
  const [localDocType, setLocalDocType] = useState<string>(documentType ?? '')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fieldEntries = Object.entries(localFields)
  const hasFields = fieldEntries.length > 0

  const startEdit = (key: string) => {
    const current = localFields[key]
    setEditingKey(key)
    setEditValue(current.value === null ? '' : String(current.value))
  }

  const commitEdit = (key: string) => {
    const original = localFields[key]
    const raw = editValue.trim()
    const parsed = raw === '' ? null : (isNaN(Number(raw)) ? raw : Number(raw))
    setLocalFields((prev) => ({
      ...prev,
      [key]: { ...original, value: parsed, confidence: parsed === null ? 0 : original.confidence },
    }))
    setEditingKey(null)
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(localDocType || null, localFields)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Document type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <label
          htmlFor="doc-type"
          style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-ink-mute)', flexShrink: 0 }}
        >
          Tipo de documento
        </label>
        <input
          id="doc-type"
          value={localDocType}
          onChange={(e) => { setLocalDocType(e.target.value); setSaved(false) }}
          placeholder="ex: receipt, invoice, form…"
          style={{
            flex: 1,
            minWidth: 120,
            padding: 'var(--space-xs) var(--space-sm)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--rounded-sm)',
            fontSize: 'var(--font-size-caption)',
            color: 'var(--color-ink)',
            background: 'var(--color-canvas)',
          }}
        />
      </div>

      {/* Fields table */}
      {hasFields ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-caption)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-hairline)' }}>
              {(['Campo', 'Valor', 'Conf.', 'Pág.'] as const).map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: 'var(--space-xs) var(--space-sm)',
                    fontWeight: 400,
                    color: 'var(--color-ink-mute)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fieldEntries.map(([key, field]) => (
              <tr
                key={key}
                style={{ borderBottom: '1px solid var(--color-hairline)' }}
              >
                <td style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-ink)', fontWeight: 300 }}>
                  {key}
                </td>
                <td style={{ padding: 'var(--space-xs) var(--space-sm)' }}>
                  {editingKey === key ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(key)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(key); if (e.key === 'Escape') setEditingKey(null) }}
                      style={{
                        width: '100%',
                        padding: '2px var(--space-xs)',
                        border: '1px solid var(--color-primary)',
                        borderRadius: 'var(--rounded-xs)',
                        fontSize: 'inherit',
                        fontFeatureSettings: '"tnum"',
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(key)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'text',
                        padding: '2px var(--space-xs)',
                        borderRadius: 'var(--rounded-xs)',
                        fontSize: 'inherit',
                        color: field.value === null ? 'var(--color-ink-mute)' : 'var(--color-ink)',
                        fontFeatureSettings: '"tnum"',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      title="Clique para editar"
                    >
                      {field.value === null ? '—' : String(field.value)}
                    </button>
                  )}
                </td>
                <td style={{ padding: 'var(--space-xs) var(--space-sm)', fontFeatureSettings: '"tnum"' }}>
                  <span style={{ color: confidenceColor(field.confidence), fontWeight: 400 }}>
                    {(field.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td style={{ padding: 'var(--space-xs) var(--space-sm)', color: 'var(--color-ink-mute)' }}>
                  {field.page}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-ink-mute)', fontStyle: 'italic' }}>
          Nenhum campo extraído.
        </p>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          {warnings.map((w, i) => (
            <li key={i} style={{ fontSize: 'var(--font-size-micro)', color: 'var(--color-ink-mute)' }}>
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: 'var(--space-xs) var(--space-md)',
            borderRadius: 'var(--rounded-pill)',
            border: 'none',
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: 'var(--font-size-caption)',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando…' : 'Salvar edições'}
        </button>
        {saved && (
          <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-success)' }}>
            Salvo
          </span>
        )}
      </div>
    </div>
  )
}
