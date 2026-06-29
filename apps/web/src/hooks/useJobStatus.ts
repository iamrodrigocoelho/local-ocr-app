import { useEffect, useRef, useState } from 'react'
import type { OcrResult } from '@ocr-reader/shared'
import { openJobEvents } from '../api/jobs.js'

export type JobPhase = 'connecting' | 'processing' | 'completed' | 'failed'

export interface JobStatus {
  phase: JobPhase
  step: string | null
  completedSteps: string[]
  result: OcrResult | null
  error: string | null
}

export function useJobStatus(jobId: string | null): JobStatus {
  const [state, setState] = useState<JobStatus>({
    phase: 'connecting',
    step: null,
    completedSteps: [],
    result: null,
    error: null,
  })
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!jobId) return

    setState({ phase: 'connecting', step: null, completedSteps: [], result: null, error: null })

    const es = openJobEvents(jobId)
    esRef.current = es

    es.onmessage = (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as {
        type: string
        status?: string
        step?: string
        result?: OcrResult
        error?: string
      }

      if (event.type === 'status') {
        setState((prev) => {
          const prevStep = prev.step
          const completed = prevStep && !prev.completedSteps.includes(prevStep)
            ? [...prev.completedSteps, prevStep]
            : prev.completedSteps
          return { phase: 'processing', step: event.step ?? null, completedSteps: completed, result: null, error: null }
        })
      } else if (event.type === 'completed') {
        setState((prev) => {
          const prevStep = prev.step
          const completed = prevStep && !prev.completedSteps.includes(prevStep)
            ? [...prev.completedSteps, prevStep]
            : prev.completedSteps
          return { phase: 'completed', step: null, completedSteps: completed, result: event.result ?? null, error: null }
        })
        es.close()
      } else if (event.type === 'failed') {
        setState((prev) => ({ ...prev, phase: 'failed', step: null, error: event.error ?? 'Erro desconhecido.' }))
        es.close()
      }
    }

    es.onerror = () => {
      setState((s) =>
        s.phase === 'completed' || s.phase === 'failed'
          ? s
          : { phase: 'failed', step: null, completedSteps: s.completedSteps, result: null, error: 'Conexão com o servidor perdida.' },
      )
      es.close()
    }

    return () => {
      es.close()
    }
  }, [jobId])

  return state
}
