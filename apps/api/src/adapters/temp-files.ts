import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export interface TempFiles {
  save(buffer: Buffer, mimeType: string): Promise<string>
  remove(filePath: string): Promise<void>
}

export function createTempFiles(): TempFiles {
  return {
    async save(buffer: Buffer, mimeType: string): Promise<string> {
      const ext = EXT_BY_MIME[mimeType] ?? 'bin'
      const filename = `${crypto.randomUUID()}.${ext}`
      const filePath = join(tmpdir(), filename)
      await writeFile(filePath, buffer)
      return filePath
    },

    async remove(filePath: string): Promise<void> {
      await unlink(filePath).catch(() => {
        // best-effort: file may already be gone
      })
    },
  }
}
