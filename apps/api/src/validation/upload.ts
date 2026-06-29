export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB
export const MAX_PAGES = 50

export type DetectedMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf'

export interface UploadValidationResult {
  mimeType: DetectedMimeType
  sizeBytes: number
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

function detectMimeType(buffer: Buffer): DetectedMimeType {
  if (buffer.length < 4) {
    throw new ValidationError('File too small to identify', 'FILE_TOO_SMALL')
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  // PDF: %PDF (25 50 44 46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf'
  }

  // WEBP: RIFF????WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }

  throw new ValidationError(
    'Unsupported file type. Accepted formats: PNG, JPG, WEBP, PDF.',
    'UNSUPPORTED_FILE_TYPE',
  )
}

export function validateUpload(buffer: Buffer): UploadValidationResult {
  if (buffer.length === 0) {
    throw new ValidationError('File is empty.', 'FILE_EMPTY')
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `File exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB size limit.`,
      'FILE_TOO_LARGE',
    )
  }

  const mimeType = detectMimeType(buffer)

  return { mimeType, sizeBytes: buffer.length }
}
