import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true })

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md) as string
  return DOMPurify.sanitize(raw)
}
