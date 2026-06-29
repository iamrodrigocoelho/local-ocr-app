# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project overview

Local web OCR application: the user uploads a PDF or image, the backend processes it with the **Chandra OCR 2** model via a local **Ollama** instance, and returns a structured JSON result. Everything runs on the user's machine — no data leaves the local environment.

Source of truth for requirements: `docs/PRD.md`. Source of truth for visual identity: `docs/DESIGN.md`. When in doubt, those files override anything here.

---

## Monorepo structure

```
apps/web       React SPA (Vite, TypeScript)
apps/api       Fastify REST API (Node 20, TypeScript)
packages/shared  Zod schemas + TypeScript types shared by both apps
docs/          PRD.md and DESIGN.md — do not modify without explicit instruction
```

Package manager: **npm workspaces** (no Turborepo/Nx). Run everything from the repo root.

---

## Commands

```bash
npm test                  # run all tests (Vitest workspace)
npm run lint              # ESLint across all packages
npm run typecheck         # tsc --noEmit across all packages
npm run build             # compile all packages
npm run format            # Prettier --write
```

Individual workspace:
```bash
npm test -w packages/shared
npm test -w apps/api
```

---

## Key architecture decisions (from PRD §6 and §11)

- **Job model for OCR:** `POST /jobs` → returns `jobId`; client polls `GET /jobs/:id` or subscribes via **SSE**. Never block on a long HTTP request.
- **Shared contract:** the JSON output schema lives in `packages/shared/src/schema.ts` (Zod). Both the API (validates before returning) and the web (types) import from `@ocr-reader/shared`. Never duplicate type definitions.
- **PDF → images:** Chandra only accepts images. The API must convert each PDF page to PNG before calling Ollama. Conversion logic belongs in `apps/api/src/adapters/`.
- **Field extractor interface:** `FieldExtractor` must be an injectable interface so implementations (LLM-based, rule-based) are swappable and testable.
- **Ollama URL is server config only:** never accept it as a user/client parameter — this prevents SSRF.

---

## Testing (TDD — test-first)

Approach: write the failing test first, then implement.

```bash
npm test                          # all
npm test -w packages/shared       # schema contract tests
npm test -w apps/api              # unit + integration (Ollama mocked)
```

- **Unit tests:** validation, PDF→image conversion, field extraction, schema, metrics.
- **Integration tests:** mock the Ollama client via dependency injection — never call the real model in CI.
- **E2E (Playwright):** upload → progress → result → export; mobile and desktop viewports.
- **Coverage floor:** 80% on domain/service layers (`apps/api/src/services/`, `packages/shared/`).
- Real model calls are manual/smoke only — mark with a slow/smoke tag and exclude from `npm test`.

---

## Security rules (PRD §9)

- Validate file type by **magic bytes**, not extension or Content-Type (`apps/api/src/validation/upload.ts`).
- Generate UUID-based temp file names — never use the original filename in any path.
- Delete temp files after processing.
- Sanitize OCR output before rendering in React — the model output is untrusted text. Never use `dangerouslySetInnerHTML` without sanitization.
- API binds to `127.0.0.1` only in local mode.
- CORS restricted to the local frontend origin (`CORS_ORIGIN` env var).

---

## Environment variables

Copy `.env.example` to `.env` before running the API. Key vars:

| Var | Default | Notes |
|-----|---------|-------|
| `HOST` | `127.0.0.1` | Never `0.0.0.0` in local mode |
| `PORT` | `3000` | |
| `CORS_ORIGIN` | `http://localhost:5173` | Must match Vite dev server |
| `OLLAMA_ENDPOINT` | `http://localhost:11434` | Server-controlled only |
| `OLLAMA_MODEL` | `fredrezones55/chandra-ocr-2:patch` | |
| `MAX_FILE_SIZE_MB` | `50` | |
| `MAX_PAGES` | `50` | |

---

## Design system (`docs/DESIGN.md`)

Apply `DESIGN.md` for all visual work. Key rules:

- **Font:** Inter weight 300 (open-source substitute for Sohne). Apply `font-feature-settings: "ss01"` on `<body>`. Use `tnum` on every money/numeric cell.
- **Display text:** always weight 300, negative letter-spacing (-1.4px at 56px scaling to -0.2px at 20px). Never bump display weight to 400.
- **Primary CTA:** indigo `#533afd`, pill shape (`border-radius: 9999px`), padding `8px 16px`. One filled button per section.
- **Never use** `#533afd` as a body-text color. Never add accent colors outside the documented palette.
- **Spacing base unit:** 8px.
- **Mobile-first** — breakpoints: Mobile < 768px, Tablet 768–1023px, Desktop 1024–1440px, Wide ≥ 1440px.
- Touch targets ≥ 44px on mobile.

---

## Current phase

**Phase 1 complete.** Image upload → Ollama OCR → OcrResult JSON → SSE progress → React UI (upload zone, progress steps, result view, error screen).

**Phase 2 next:** PDF → image conversion (multipágina), exportação JSON/CSV/Excel, markdown rendering seguro na UI.

See `docs/PRD.md §12` for the full roadmap.

## TypeScript / monorepo note

`packages/shared` must be built before type-checking `apps/api` or `apps/web`, because those apps resolve `@ocr-reader/shared` from the workspace symlink's `dist/`. The root `typecheck` script handles this automatically (`npm run build -w packages/shared && ...`). CI reflects the same order.

---

## Git conventions

- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`
- Small PRs per logical unit of work
