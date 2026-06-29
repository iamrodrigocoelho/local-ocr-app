import type { OcrResult, ExtractedField } from '@ocr-reader/shared'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3000'

export interface JobCreatedResponse {
  jobId: string
  status: 'queued'
}

export interface JobStatusResponse {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  step: string | null
  result: OcrResult | null
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export async function submitJob(file: File): Promise<JobCreatedResponse> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${API_BASE}/jobs`, { method: 'POST', body: form })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(body.error ?? 'Erro ao enviar arquivo.', res.status, body.code)
  }

  return res.json() as Promise<JobCreatedResponse>
}

export async function getJob(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`)
  if (!res.ok) throw new ApiError('Job não encontrado.', res.status)
  return res.json() as Promise<JobStatusResponse>
}

export function openJobEvents(jobId: string): EventSource {
  return new EventSource(`${API_BASE}/jobs/${jobId}/events`)
}

export async function patchFields(
  jobId: string,
  documentType: string | null,
  fields: Record<string, ExtractedField>,
): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/fields`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType, fields }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(body.error ?? 'Erro ao salvar campos.', res.status)
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
