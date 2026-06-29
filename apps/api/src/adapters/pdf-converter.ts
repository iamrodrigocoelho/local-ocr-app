import { pdf } from 'pdf-to-img'

export interface PdfConverter {
  toImages(pdfBuffer: Buffer): Promise<Buffer[]>
}

export class PdfConversionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfConversionError'
  }
}

export function createPdfConverter(): PdfConverter {
  return {
    async toImages(pdfBuffer: Buffer): Promise<Buffer[]> {
      try {
        const pages: Buffer[] = []
        const document = await pdf(pdfBuffer, { scale: 2 })
        for await (const page of document) {
          pages.push(page as Buffer)
        }
        if (pages.length === 0) {
          throw new PdfConversionError('O PDF não contém páginas.')
        }
        return pages
      } catch (err) {
        if (err instanceof PdfConversionError) throw err
        throw new PdfConversionError(
          `Falha ao converter PDF: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    },
  }
}
