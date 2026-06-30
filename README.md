# OCR File Reader

> Aplicação web local de OCR com Chandra OCR 2 via Ollama · Local OCR web app powered by Chandra OCR 2 via Ollama

---

## Português

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Executando a aplicação](#executando-a-aplicação)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [API](#api)
- [Esquema JSON de saída](#esquema-json-de-saída)
- [Desenvolvimento](#desenvolvimento)
- [Segurança](#segurança)

---

### Visão geral

OCR File Reader é uma aplicação web que roda inteiramente na sua máquina. Você envia um arquivo (imagem ou PDF), o backend processa cada página com o modelo **Chandra OCR 2** servido via **Ollama**, extrai campos estruturados usando um segundo modelo de texto, e devolve um JSON padronizado. O resultado pode ser visualizado, editado e exportado.

**Nenhum dado sai do ambiente local.**

```
[Navegador / React SPA]
        │  upload + SSE
        ▼
[API Node / Fastify]
        ├─ 1. Validação (magic bytes, tamanho, nº de páginas)
        ├─ 2. PDF → PNG por página
        ├─ 3. OCR: Chandra OCR 2 via Ollama
        ├─ 4. Extração de campos: LLM de texto via Ollama
        ├─ 5. Montagem e validação do JSON (Zod)
        └─ 6. Limpeza dos arquivos temporários
        ▼
[Ollama local]
```

---

### Funcionalidades

| Fase | Funcionalidade |
|------|---------------|
| 1 | Upload de imagem (PNG, JPG, JPEG, WEBP) → OCR → JSON estruturado |
| 1 | Progresso em tempo real via SSE (etapas legíveis na UI) |
| 1 | Tela de erro com mensagens acionáveis |
| 2 | Suporte a PDF multipágina (cada página vira PNG antes do OCR) |
| 2 | Exportação do resultado em JSON, CSV e Excel (.xlsx) |
| 2 | Renderização segura de markdown na transcrição (marked + DOMPurify) |
| 3 | Extração de campos estruturados via LLM de texto (llama3.2 por padrão) |
| 3 | Editor de campos inline com badge de confiança |
| 3 | `PATCH /jobs/:id/fields` para salvar correções manuais |
| 4 | Envio em lote (`POST /jobs/batch`): múltiplos arquivos, um job por arquivo |
| 4 | Cancelamento de job em andamento (`DELETE /jobs/:id`) |
| 4 | Histórico persistente em disco (JSON) — sobrevive a reinícios da API |
| 4 | Métricas da sessão: total, por status, duração média, taxa de erro |

---

### Pré-requisitos

| Dependência | Versão mínima | Notas |
|-------------|---------------|-------|
| [Node.js](https://nodejs.org) | 20 | Recomendado: 24 |
| [npm](https://www.npmjs.com) | 10 | Incluso com o Node |
| [Ollama](https://ollama.com) | qualquer | Deve estar rodando em `http://localhost:11434` |

**Modelos necessários no Ollama:**

```bash
# Modelo de OCR
ollama pull fredrezones55/chandra-ocr-2:patch

# Modelo de extração de campos (qualquer modelo de instrução funciona)
ollama pull llama3.2
```

---

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/iamrodrigocoelho/local-ocr-app.git
cd local-ocr-app

# 2. Instale as dependências (npm workspaces instala tudo de uma vez)
npm install

# 3. Compile o pacote compartilhado e a API
npm run build

# 4. Configure o ambiente
cp .env.example .env
# Edite .env se necessário (padrões funcionam para instalação local padrão)
```

---

### Executando a aplicação

Abra dois terminais:

```bash
# Terminal 1 — API (porta 3000)
npm run dev -w apps/api

# Terminal 2 — Frontend (porta 5173)
npm run dev -w apps/web
```

Acesse **http://localhost:5173** no navegador.

> **Dica:** O Ollama precisa estar em execução antes de enviar um arquivo. Verifique com `ollama ps`.

---

### Variáveis de ambiente

Copie `.env.example` para `.env` na raiz do projeto. Todas as variáveis têm valores padrão que funcionam para uma instalação local padrão.

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `HOST` | `127.0.0.1` | Endereço de bind da API. Nunca use `0.0.0.0` em modo local. |
| `PORT` | `3000` | Porta da API. |
| `CORS_ORIGIN` | `http://localhost:5173` | Deve coincidir com a URL do Vite dev server. |
| `OLLAMA_ENDPOINT` | `http://localhost:11434` | Configuração do servidor — nunca exposta ao cliente. |
| `OLLAMA_MODEL` | `fredrezones55/chandra-ocr-2:patch` | Modelo de OCR. |
| `OLLAMA_EXTRACTION_MODEL` | `llama3.2` | Modelo para extração de campos. |
| `OLLAMA_EXTRACTION_TIMEOUT_MS` | `120000` | Timeout da extração em ms. |
| `MAX_FILE_SIZE_MB` | `50` | Tamanho máximo de arquivo. |
| `MAX_PAGES` | `50` | Número máximo de páginas por PDF. |
| `DB_PATH` | `~/.ocr-reader/jobs.db` | Caminho do arquivo de histórico persistente. |

---

### API

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/jobs` | Cria um job para um único arquivo. Retorna `{ jobId }`. |
| `POST` | `/jobs/batch` | Cria jobs para múltiplos arquivos (`multipart/form-data`). |
| `GET` | `/jobs/:id` | Retorna o estado atual do job. |
| `GET` | `/jobs/:id/events` | SSE — stream de progresso e resultado. |
| `PATCH` | `/jobs/:id/fields` | Atualiza campos extraídos manualmente. |
| `DELETE` | `/jobs/:id` | Cancela um job em andamento. |
| `GET` | `/jobs/:id/export/json` | Exporta o resultado como JSON. |
| `GET` | `/jobs/:id/export/csv` | Exporta o resultado como CSV. |
| `GET` | `/jobs/:id/export/excel` | Exporta o resultado como .xlsx. |
| `GET` | `/metrics` | Retorna métricas agregadas da sessão. |

**Ciclo de vida de um job:**

```
queued → processing → completed
                   ↘ failed
       → canceled
```

**Eventos SSE** (`GET /jobs/:id/events`):

```jsonc
{ "type": "status",    "status": "processing", "step": "Lendo página 1 de 3" }
{ "type": "completed", "result": { /* OcrResult */ } }
{ "type": "failed",    "error": "mensagem de erro" }
{ "type": "canceled" }
```

---

### Esquema JSON de saída

```jsonc
{
  "schemaVersion": "1.0",
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "source": {
    "filename": "nota_fiscal.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 184320,
    "pageCount": 2
  },
  "model": {
    "name": "fredrezones55/chandra-ocr-2:patch",
    "provider": "ollama",
    "endpoint": "http://localhost:11434"
  },
  "processing": {
    "status": "completed",
    "startedAt": "2026-06-28T18:30:00.000Z",
    "finishedAt": "2026-06-28T18:35:02.000Z",
    "durationMs": 302005,
    "error": null
  },
  "pages": [
    {
      "page": 1,
      "transcription": {
        "markdown": "## Mercado X\n| Item | Valor |\n|---|---|\n| Café | 12,90 |"
      },
      "metrics": {
        "inputTokens": 271,
        "outputTokens": 1099,
        "evalTokensPerSecond": 4.7
      }
    }
  ],
  "extraction": {
    "documentType": "receipt",
    "fields": {
      "estabelecimento": { "value": "Mercado X", "confidence": 0.97, "page": 1 },
      "data":            { "value": "2026-06-28", "confidence": 0.90, "page": 1 },
      "valorTotal":      { "value": 45.80,        "confidence": 0.93, "page": 1 },
      "formaPagamento":  { "value": null,          "confidence": 0.0,  "page": 1 }
    },
    "warnings": ["Campo 'formaPagamento' não localizado"]
  }
}
```

O esquema é validado com **Zod** em `packages/shared/src/schema.ts` e compartilhado entre a API e o frontend.

---

### Desenvolvimento

**Estrutura do monorepo:**

```
apps/web          React SPA (Vite, TypeScript)
apps/api          API REST (Fastify 5, Node 20+, TypeScript)
packages/shared   Schemas Zod e tipos TypeScript compartilhados
docs/             PRD.md e DESIGN.md — fonte de verdade do produto
```

**Comandos:**

```bash
npm test              # todos os testes (Vitest workspace) — 90 testes
npm run lint          # ESLint em todos os pacotes
npm run typecheck     # tsc --noEmit em todos os pacotes
npm run build         # compila todos os pacotes
npm run format        # Prettier --write

# Workspace individual
npm test -w apps/api
npm test -w packages/shared
```

**TDD:** escreva o teste com falha antes de implementar. Cobertura mínima de 80% nas camadas `apps/api/src/services/` e `packages/shared/`. Chamadas reais ao Ollama são marcadas como smoke tests e excluídas do `npm test`.

---

### Segurança

- **Validação por magic bytes:** tipo de arquivo verificado pela assinatura binária, não pela extensão ou `Content-Type`.
- **Nomes UUID:** arquivos temporários recebem nomes gerados internamente; o nome original nunca é usado em caminhos.
- **Limpeza de temporários:** arquivos de upload são apagados após o processamento.
- **Sanitização de saída OCR:** markdown renderizado via `marked` + `DOMPurify`; `dangerouslySetInnerHTML` sem sanitização é proibido.
- **Bind local:** API vincula em `127.0.0.1` apenas.
- **SSRF:** URL do Ollama é configuração de servidor — nunca aceita parâmetro do cliente.
- **CORS** restrito à origem do frontend (`CORS_ORIGIN`).

---

---

## English

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the app](#running-the-app)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Output JSON schema](#output-json-schema)
- [Development](#development-1)
- [Security](#security)

---

### Overview

OCR File Reader is a web application that runs entirely on your machine. Upload an image or PDF, the backend processes each page with **Chandra OCR 2** served via **Ollama**, extracts structured fields using a second text model, and returns a standardised JSON. Results can be viewed, edited, and exported.

**No data ever leaves your local environment.**

```
[Browser / React SPA]
        │  upload + SSE
        ▼
[Node API / Fastify]
        ├─ 1. Validation (magic bytes, file size, page count)
        ├─ 2. PDF → PNG per page
        ├─ 3. OCR: Chandra OCR 2 via Ollama
        ├─ 4. Field extraction: text LLM via Ollama
        ├─ 5. JSON assembly and schema validation (Zod)
        └─ 6. Temp file cleanup
        ▼
[Local Ollama]
```

---

### Features

| Phase | Feature |
|-------|---------|
| 1 | Image upload (PNG, JPG, JPEG, WEBP) → OCR → structured JSON |
| 1 | Real-time progress via SSE (human-readable steps in the UI) |
| 1 | Error screen with actionable messages |
| 2 | Multi-page PDF support (each page converted to PNG before OCR) |
| 2 | Export results as JSON, CSV, and Excel (.xlsx) |
| 2 | Safe markdown rendering for transcriptions (marked + DOMPurify) |
| 3 | Structured field extraction via text LLM (llama3.2 by default) |
| 3 | Inline field editor with confidence badge |
| 3 | `PATCH /jobs/:id/fields` to save manual corrections |
| 4 | Batch upload (`POST /jobs/batch`): multiple files, one job each |
| 4 | Job cancellation (`DELETE /jobs/:id`) |
| 4 | Persistent job history on disk (JSON) — survives API restarts |
| 4 | Session metrics: total jobs, per-status breakdown, avg duration, error rate |

---

### Prerequisites

| Dependency | Minimum version | Notes |
|------------|-----------------|-------|
| [Node.js](https://nodejs.org) | 20 | Recommended: 24 |
| [npm](https://www.npmjs.com) | 10 | Bundled with Node |
| [Ollama](https://ollama.com) | any | Must be running at `http://localhost:11434` |

**Required Ollama models:**

```bash
# OCR model
ollama pull fredrezones55/chandra-ocr-2:patch

# Field extraction model (any instruction-following model works)
ollama pull llama3.2
```

---

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/iamrodrigocoelho/local-ocr-app.git
cd local-ocr-app

# 2. Install dependencies (npm workspaces installs everything at once)
npm install

# 3. Build the shared package and API
npm run build

# 4. Set up environment variables
cp .env.example .env
# Edit .env if needed (defaults work for a standard local setup)
```

---

### Running the app

Open two terminals:

```bash
# Terminal 1 — API (port 3000)
npm run dev -w apps/api

# Terminal 2 — Frontend (port 5173)
npm run dev -w apps/web
```

Open **http://localhost:5173** in your browser.

> **Tip:** Ollama must be running before you upload a file. Check with `ollama ps`.

---

### Environment variables

Copy `.env.example` to `.env` at the project root. All variables have defaults that work for a standard local setup.

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | API bind address. Never `0.0.0.0` in local mode. |
| `PORT` | `3000` | API port. |
| `CORS_ORIGIN` | `http://localhost:5173` | Must match the Vite dev server URL. |
| `OLLAMA_ENDPOINT` | `http://localhost:11434` | Server-side config — never exposed to the client. |
| `OLLAMA_MODEL` | `fredrezones55/chandra-ocr-2:patch` | OCR model. |
| `OLLAMA_EXTRACTION_MODEL` | `llama3.2` | Field extraction model. |
| `OLLAMA_EXTRACTION_TIMEOUT_MS` | `120000` | Extraction timeout in ms. |
| `MAX_FILE_SIZE_MB` | `50` | Maximum upload file size. |
| `MAX_PAGES` | `50` | Maximum pages per PDF. |
| `DB_PATH` | `~/.ocr-reader/jobs.db` | Path for persistent job history file. |

---

### API reference

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/jobs` | Create a job for a single file. Returns `{ jobId }`. |
| `POST` | `/jobs/batch` | Create jobs for multiple files (`multipart/form-data`). |
| `GET` | `/jobs/:id` | Return the current state of a job. |
| `GET` | `/jobs/:id/events` | SSE — progress and result stream. |
| `PATCH` | `/jobs/:id/fields` | Update extracted fields manually. |
| `DELETE` | `/jobs/:id` | Cancel a running job. |
| `GET` | `/jobs/:id/export/json` | Export result as JSON. |
| `GET` | `/jobs/:id/export/csv` | Export result as CSV. |
| `GET` | `/jobs/:id/export/excel` | Export result as .xlsx. |
| `GET` | `/metrics` | Return aggregated session metrics. |

**Job lifecycle:**

```
queued → processing → completed
                   ↘ failed
       → canceled
```

**SSE events** (`GET /jobs/:id/events`):

```jsonc
{ "type": "status",    "status": "processing", "step": "Reading page 1 of 3" }
{ "type": "completed", "result": { /* OcrResult */ } }
{ "type": "failed",    "error": "error message" }
{ "type": "canceled" }
```

---

### Output JSON schema

```jsonc
{
  "schemaVersion": "1.0",
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "source": {
    "filename": "invoice.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 184320,
    "pageCount": 2
  },
  "model": {
    "name": "fredrezones55/chandra-ocr-2:patch",
    "provider": "ollama",
    "endpoint": "http://localhost:11434"
  },
  "processing": {
    "status": "completed",
    "startedAt": "2026-06-28T18:30:00.000Z",
    "finishedAt": "2026-06-28T18:35:02.000Z",
    "durationMs": 302005,
    "error": null
  },
  "pages": [
    {
      "page": 1,
      "transcription": {
        "markdown": "## Store X\n| Item | Price |\n|---|---|\n| Coffee | 12.90 |"
      },
      "metrics": {
        "inputTokens": 271,
        "outputTokens": 1099,
        "evalTokensPerSecond": 4.7
      }
    }
  ],
  "extraction": {
    "documentType": "receipt",
    "fields": {
      "store":        { "value": "Store X",    "confidence": 0.97, "page": 1 },
      "date":         { "value": "2026-06-28", "confidence": 0.90, "page": 1 },
      "total":        { "value": 45.80,        "confidence": 0.93, "page": 1 },
      "paymentMethod":{ "value": null,         "confidence": 0.0,  "page": 1 }
    },
    "warnings": ["Field 'paymentMethod' not found"]
  }
}
```

The schema is validated with **Zod** in `packages/shared/src/schema.ts` and shared between the API and frontend.

---

### Development

**Monorepo structure:**

```
apps/web          React SPA (Vite, TypeScript)
apps/api          REST API (Fastify 5, Node 20+, TypeScript)
packages/shared   Shared Zod schemas and TypeScript types
docs/             PRD.md and DESIGN.md — product source of truth
```

**Commands:**

```bash
npm test              # all tests (Vitest workspace) — 90 tests
npm run lint          # ESLint across all packages
npm run typecheck     # tsc --noEmit across all packages
npm run build         # compile all packages
npm run format        # Prettier --write

# Single workspace
npm test -w apps/api
npm test -w packages/shared
```

**TDD:** write the failing test before implementing. Minimum 80% coverage on `apps/api/src/services/` and `packages/shared/`. Real Ollama calls are tagged as smoke tests and excluded from `npm test`.

---

### Security

- **Magic-bytes validation:** file type verified by binary signature, not extension or `Content-Type`.
- **UUID filenames:** temp files get internally generated names; the original filename is never used in any path.
- **Temp file cleanup:** upload files are deleted after processing.
- **OCR output sanitisation:** markdown rendered via `marked` + `DOMPurify`; `dangerouslySetInnerHTML` without sanitisation is forbidden.
- **Localhost-only bind:** API binds to `127.0.0.1` only.
- **SSRF prevention:** Ollama URL is server-side config — never accepted as a client parameter.
- **Restrictive CORS:** only the frontend origin (`CORS_ORIGIN`) is allowed.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, TypeScript |
| Backend | Fastify 5, Node 20+, TypeScript |
| Shared contract | Zod schemas (`@ocr-reader/shared`) |
| OCR model | Chandra OCR 2 (`fredrezones55/chandra-ocr-2:patch`) |
| Field extraction | llama3.2 (configurable) |
| Model serving | Ollama |
| PDF → image | pdf-to-img |
| Excel export | ExcelJS |
| Markdown rendering | marked + DOMPurify |
| Testing | Vitest 2 |
| Package manager | npm workspaces |

---

## License

This project is for personal/local use. The Chandra OCR 2 model is a community model — verify its license terms before any commercial use.
