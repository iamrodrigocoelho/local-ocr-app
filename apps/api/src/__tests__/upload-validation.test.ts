import { describe, it, expect } from 'vitest'
import {
  validateUpload,
  ValidationError,
  MAX_FILE_SIZE_BYTES,
} from '../validation/upload.js'

// Minimal buffers carrying only the magic bytes needed for detection
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]) // %PDF
const WEBP_MAGIC = Buffer.concat([
  Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
  Buffer.from([0x00, 0x00, 0x00, 0x00]), // file size (placeholder)
  Buffer.from([0x57, 0x45, 0x42, 0x50]), // WEBP
])

function makeBuffer(magic: Buffer, totalSize = 1024): Buffer {
  const buf = Buffer.alloc(totalSize)
  magic.copy(buf)
  return buf
}

describe('validateUpload', () => {
  describe('magic byte detection', () => {
    it('accepts PNG files', () => {
      const result = validateUpload(makeBuffer(PNG_MAGIC))
      expect(result.mimeType).toBe('image/png')
    })

    it('accepts JPEG files', () => {
      const result = validateUpload(makeBuffer(JPEG_MAGIC))
      expect(result.mimeType).toBe('image/jpeg')
    })

    it('accepts WEBP files', () => {
      const result = validateUpload(makeBuffer(WEBP_MAGIC))
      expect(result.mimeType).toBe('image/webp')
    })

    it('accepts PDF files', () => {
      const result = validateUpload(makeBuffer(PDF_MAGIC))
      expect(result.mimeType).toBe('application/pdf')
    })

    it('rejects unknown file types', () => {
      const unknown = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
      expect(() => validateUpload(unknown)).toThrow(ValidationError)
    })

    it('rejects empty buffer', () => {
      expect(() => validateUpload(Buffer.alloc(0))).toThrow(ValidationError)
    })
  })

  describe('size limits', () => {
    it('accepts files within the size limit', () => {
      expect(() => validateUpload(makeBuffer(PNG_MAGIC, 1024))).not.toThrow()
    })

    it('rejects files over MAX_FILE_SIZE_BYTES', () => {
      const oversized = makeBuffer(PNG_MAGIC, MAX_FILE_SIZE_BYTES + 1)
      expect(() => validateUpload(oversized)).toThrow(ValidationError)
    })

    it('exposes MAX_FILE_SIZE_BYTES as a positive number', () => {
      expect(MAX_FILE_SIZE_BYTES).toBeGreaterThan(0)
    })
  })

  describe('return value', () => {
    it('returns detected mimeType and sizeBytes', () => {
      const buf = makeBuffer(PNG_MAGIC, 2048)
      const result = validateUpload(buf)
      expect(result.mimeType).toBe('image/png')
      expect(result.sizeBytes).toBe(2048)
    })
  })

  describe('ValidationError', () => {
    it('carries a human-readable message', () => {
      try {
        validateUpload(Buffer.alloc(0))
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        expect((err as ValidationError).message.length).toBeGreaterThan(0)
      }
    })

    it('carries an error code', () => {
      try {
        validateUpload(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))
      } catch (err) {
        expect((err as ValidationError).code).toBeTruthy()
      }
    })
  })
})
