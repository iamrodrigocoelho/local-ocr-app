export const config = {
  host: process.env['HOST'] ?? '127.0.0.1',
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  logLevel: process.env['LOG_LEVEL'] ?? 'info',
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  ollama: {
    endpoint: process.env['OLLAMA_ENDPOINT'] ?? 'http://localhost:11434',
    model: process.env['OLLAMA_MODEL'] ?? 'fredrezones55/chandra-ocr-2:patch',
    timeoutMs: parseInt(process.env['OLLAMA_TIMEOUT_MS'] ?? '300000', 10),
  },
  upload: {
    maxFileSizeBytes: parseInt(process.env['MAX_FILE_SIZE_MB'] ?? '50', 10) * 1024 * 1024,
    maxPages: parseInt(process.env['MAX_PAGES'] ?? '50', 10),
  },
} as const
