# PRD — Aplicação Web de OCR Local com Chandra OCR 2

**Versão:** 0.1 (rascunho)
**Data:** 28/06/2026
**Status:** Em definição
**Execução inicial:** Local (single-user, sem autenticação)

> **Nota sobre UI/UX:** Este PRD assume que o documento `docs/DESIGN.md` é a **fonte de verdade** para identidade visual, tokens de design (cores, tipografia, espaçamento), componentes e tom. A seção 8 descreve *requisitos* de UI/UX (comportamento, responsividade, acessibilidade); a *aparência* deve seguir o `DESIGN.md`. Onde houver conflito, o `DESIGN.md` prevalece. Esta seção será reconciliada assim que o conteúdo do `DESIGN.md` for incorporado.

---

## 1. Visão geral

Aplicação web onde o usuário envia um arquivo (PDF ou imagem), o sistema executa OCR usando o modelo **Chandra OCR 2** servido localmente via **Ollama**, e retorna um **JSON estruturado** contendo a transcrição completa do documento e um conjunto de campos extraídos. O resultado pode ser visualizado, copiado e exportado (JSON/CSV/Excel).

O sistema roda inteiramente na máquina do usuário: frontend, backend e modelo de IA são locais. Nenhum dado sai do ambiente local.

### Stack escolhida
- **Frontend:** React (SPA), responsivo, mobile-first.
- **Backend:** Node.js com Express ou Fastify (recomendado Fastify pela performance e validação de schema nativa).
- **OCR:** Chandra OCR 2 (`fredrezones55/chandra-ocr-2:patch`) via API do Ollama (`http://localhost:11434`).
- **Extração de campos:** etapa secundária (ver seção 6).

---

## 2. Objetivos e não-objetivos

### Objetivos
1. Permitir upload de PDF ou imagem por arrastar-soltar ou seleção, em qualquer dispositivo.
2. Processar o arquivo com o Chandra via Ollama e produzir um JSON estruturado padronizado.
3. Exibir o resultado de forma clara e permitir exportação (JSON, CSV, Excel).
4. Tratar de forma robusta o fato de o processamento ser **demorado** (minutos por documento) com feedback de progresso.
5. Seguir boas práticas de engenharia, segurança e testes (TDD) desde o início.

### Não-objetivos (fora do escopo inicial)
- Autenticação / multiusuário (preparar a arquitetura para isso, mas não implementar agora).
- Deploy em nuvem / acesso remoto.
- Treinamento ou fine-tuning de modelos.
- Edição manual avançada do documento reconhecido (apenas correção pontual dos campos, opcional).
- Processamento em lote de grandes volumes (suportar 1 arquivo por vez no MVP; lote vem depois).

---

## 3. Personas e casos de uso

**Persona principal — "Operador":** uma pessoa que precisa extrair dados de documentos (recibos, notas, formulários) e tê-los em formato estruturado, sem conhecimento técnico do modelo por trás.

**Casos de uso (MVP):**
- UC1: Enviar uma imagem de um documento e obter o JSON estruturado.
- UC2: Enviar um PDF (1+ páginas) e obter o JSON com cada página.
- UC3: Visualizar a transcrição e os campos extraídos lado a lado.
- UC4: Exportar o resultado em JSON, CSV ou Excel.
- UC5: Acompanhar o progresso de um processamento longo e ser avisado ao concluir.
- UC6: Receber mensagem de erro clara se o arquivo for inválido ou o modelo falhar.

---

## 4. Requisitos funcionais

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF01 | Upload de arquivo via drag-and-drop e via seletor de arquivos | Alta |
| RF02 | Aceitar imagens (PNG, JPG, JPEG, WEBP) e PDF | Alta |
| RF03 | Validar tipo (magic bytes), tamanho e número de páginas antes de processar | Alta |
| RF04 | Converter cada página de PDF em imagem antes de enviar ao modelo | Alta |
| RF05 | Chamar a API do Ollama com o modelo Chandra e obter a transcrição | Alta |
| RF06 | Executar etapa de extração de campos sobre a transcrição | Alta |
| RF07 | Retornar JSON no esquema padronizado (seção 7) | Alta |
| RF08 | Processamento assíncrono com status e progresso consultáveis | Alta |
| RF09 | Exibir transcrição + campos extraídos na interface | Alta |
| RF10 | Exportar resultado em JSON, CSV e Excel (.xlsx) | Média |
| RF11 | Permitir correção manual dos campos antes de exportar | Média |
| RF12 | Histórico de processamentos da sessão (em memória/local) | Baixa |
| RF13 | Cancelar um processamento em andamento | Baixa |

---

## 5. Requisitos não-funcionais

- **RNF01 — Performance percebida:** como o OCR leva minutos, toda operação longa é assíncrona com feedback (barra/etapas), nunca uma requisição HTTP bloqueante longa.
- **RNF02 — Responsividade:** funcional e agradável em smartphone, tablet, notebook e desktop. Mobile-first.
- **RNF03 — Acessibilidade:** conformidade com WCAG 2.1 AA (contraste, navegação por teclado, leitores de tela, foco visível).
- **RNF04 — Confiabilidade:** falha do modelo/Ollama não derruba a aplicação; erros são tratados e comunicados.
- **RNF05 — Privacidade:** nenhum dado trafega para fora da máquina local; arquivos temporários são apagados após o processamento.
- **RNF06 — Manutenibilidade:** código tipado (TypeScript no front e no back), modular, com testes.
- **RNF07 — Observabilidade:** logs estruturados no backend (sem dados sensíveis), tempos de processamento e contagem de tokens registrados.
- **RNF08 — Portabilidade:** rodar em Windows, macOS e Linux (já que o Ollama roda nativo nos três).

---

## 6. Arquitetura e pipeline

### Visão de alto nível
```
[Browser / React SPA]
        │  (upload, polling de status)
        ▼
[Backend Node (Fastify) — API REST]
        │
        ├─ 1. Validação do arquivo (tipo, tamanho, magic bytes)
        ├─ 2. Normalização → imagens (PDF → 1 imagem por página)
        ├─ 3. OCR: POST /api/chat no Ollama (Chandra) por página
        ├─ 4. Extração de campos (sobre a transcrição)
        ├─ 5. Montagem do JSON padronizado + validação de schema
        └─ 6. Limpeza dos arquivos temporários
        │
        ▼
[Ollama local — modelo Chandra OCR 2]
```

### Decisões-chave

**Por que processamento assíncrono (job model):** o Chandra pode levar vários minutos por página. Uma requisição síncrona estouraria timeouts e travaria a UI. Proposta: o `POST /jobs` cria um job e retorna um `jobId`; o frontend consulta `GET /jobs/{id}` (polling) ou recebe atualizações via Server-Sent Events (SSE). SSE é leve e suficiente para local — recomendado.

**PDF → imagens:** o Chandra no Ollama só aceita imagens. O backend converte cada página do PDF em PNG (ex.: `pdfjs-dist` ou `pdf-to-img` no Node, evitando dependências nativas pesadas) e processa página a página.

**Etapa de extração de campos (camada 2):** o Chandra entrega a **transcrição completa** da página (markdown/layout), não os campos prontos. Para preencher os campos estruturados, recomendo uma das duas estratégias (configurável):
- **(a) LLM de texto local** (ex.: um modelo pequeno de instrução no Ollama) recebe a transcrição + a lista de campos desejados e devolve JSON. Mais flexível, lida com layouts variados.
- **(b) Regras/parsers determinísticos** por tipo de documento conhecido. Mais rápido e barato, melhor para os "poucos templates conhecidos", porém mais frágil.

Recomendação: começar com (a) por flexibilidade, e otimizar com (b) nos templates de alto volume. A camada de extração deve ser uma interface (`FieldExtractor`) com implementações trocáveis — bom para testes e evolução.

**Configuração externalizada:** URL do Ollama, nome do modelo, limites de tamanho/páginas e timeouts ficam em variáveis de ambiente (`.env`), nunca hard-coded. Mesmo sem token agora, o cliente do Ollama deve suportar um header de autenticação para o futuro.

---

## 7. Esquema JSON de saída (recomendação)

Formato em **duas camadas** — transcrição bruta + campos extraídos — mais metadados. Isso atende tanto "OCR completo" quanto "campos fixos", e serve de base estável para exportar CSV/Excel.

```jsonc
{
  "schemaVersion": "1.0",
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "source": {
    "filename": "teste_receita.png",
    "mimeType": "image/png",
    "sizeBytes": 184320,
    "pageCount": 1
  },
  "model": {
    "name": "fredrezones55/chandra-ocr-2:patch",
    "provider": "ollama",
    "endpoint": "http://localhost:11434"
  },
  "processing": {
    "status": "completed",          // queued | processing | completed | failed | canceled
    "startedAt": "2026-06-28T18:30:00.000Z",
    "finishedAt": "2026-06-28T18:35:02.000Z",
    "durationMs": 302005,
    "error": null
  },
  "pages": [
    {
      "page": 1,
      "transcription": {
        "markdown": "## Mercado X\n| Item | Valor |\n|---|---|\n| Café | 12,90 |\n...",
        "html": null               // opcional, se solicitado ao modelo
      },
      "metrics": {
        "inputTokens": 271,
        "outputTokens": 1099,
        "evalTokensPerSecond": 4.7
      }
    }
  ],
  "extraction": {
    "documentType": "receipt",      // detectado ou informado pelo usuário
    "fields": {
      "estabelecimento": { "value": "Mercado X", "confidence": 0.97, "page": 1 },
      "data":            { "value": "2026-06-28", "confidence": 0.90, "page": 1 },
      "valorTotal":      { "value": 45.80, "confidence": 0.93, "page": 1 },
      "formaPagamento":  { "value": null, "confidence": 0.0, "page": 1 }
    },
    "warnings": ["Campo 'formaPagamento' não localizado"]
  }
}
```

**Princípios do esquema:**
- `schemaVersion` permite evoluir sem quebrar consumidores.
- Cada campo carrega `value`, `confidence` e `page` — facilita revisão manual e exportação.
- Campos ausentes vêm como `null` (nunca omitidos), o que mantém o CSV/Excel com colunas consistentes.
- O esquema é validado no backend (ex.: Zod ou JSON Schema) antes de retornar — é um **contrato** testável.

---

## 8. UI/UX (requisitos de comportamento; aparência segue `DESIGN.md`)

### Fluxo principal
1. **Tela de upload:** área de drag-and-drop ampla + botão de seleção; aceita um arquivo por vez no MVP. Mostra formatos e limites aceitos.
2. **Processando:** indicador de progresso com etapas legíveis ("Validando", "Convertendo páginas", "Lendo página 1 de 2", "Extraindo campos"). Como é lento, o feedback de etapa é essencial para a percepção de controle.
3. **Resultado:** layout em duas áreas — transcrição (à esquerda/topo) e campos extraídos editáveis (à direita/baixo). Botões de exportar (JSON/CSV/Excel) e copiar.
4. **Erros:** mensagens claras e acionáveis (ex.: "Formato não suportado", "Ollama não está respondendo — verifique se está em execução").

### Responsividade (RNF02)
- **Mobile-first**, com breakpoints para tablet/desktop. Em telas pequenas, transcrição e campos empilham verticalmente; em telas grandes, ficam lado a lado.
- Alvos de toque ≥ 44px; upload por toque além de drag-and-drop.
- Sem dependência de hover para funções essenciais (touch).

### Acessibilidade (RNF03)
- Navegação completa por teclado; foco visível.
- Rótulos ARIA na área de upload e nos status; anúncio de progresso para leitores de tela (live region).
- Contraste e tipografia conforme `DESIGN.md`, respeitando WCAG AA.

> A paleta, tipografia, componentes e tom **devem** seguir `docs/DESIGN.md`. Esta seção define apenas estrutura e comportamento.

---

## 9. Cibersegurança

Mesmo rodando localmente, as práticas abaixo evitam vulnerabilidades e preparam o sistema para um eventual deploy.

**Entrada / upload**
- Validar **magic bytes** (assinatura real do arquivo), não confiar só na extensão ou no `Content-Type`.
- Limites rígidos: tamanho máximo de arquivo, número máximo de páginas, dimensões máximas de imagem (mitiga *decompression bombs*).
- Gerar nomes de arquivo internos próprios (UUID); nunca usar o nome enviado pelo usuário em caminhos (previne *path traversal*).
- Processar uploads em diretório temporário isolado e **apagar após o uso**.

**Saída / renderização**
- A transcrição do Chandra é texto não confiável (pode conter HTML/markdown malicioso). Ao renderizar no React, **escapar/sanitizar** (ex.: sanitizar markdown, nunca usar `dangerouslySetInnerHTML` sem sanitização) para evitar XSS.

**Backend / rede**
- Bind apenas em `localhost`/`127.0.0.1` no modo local (não expor na rede).
- A URL do Ollama é configuração do servidor, **nunca** parâmetro controlável pelo usuário (previne SSRF).
- CORS restritivo (apenas a origem do próprio front).
- Rate limiting básico nos endpoints, mesmo local.
- Headers de segurança (helmet/equivalente): CSP, X-Content-Type-Options, etc.

**Dependências e segredos**
- Variáveis sensíveis em `.env` fora do versionamento; `.env.example` versionado.
- Auditoria de dependências no CI (`npm audit`, Dependabot/`osv-scanner`).
- Princípio do menor privilégio para qualquer credencial futura.

**Privacidade**
- Nenhum dado enviado para serviços externos. Documentar isso explicitamente para o usuário.

---

## 10. Estratégia de testes (TDD)

Abordagem **test-first**: escrever o teste que descreve o comportamento, vê-lo falhar, implementar, refatorar.

**Pirâmide de testes**
- **Unitários (base, maioria):**
  - Validação de arquivo (magic bytes, limites).
  - Conversão PDF → imagens (com PDFs de teste pequenos).
  - Parsers/extratores de campos (entradas controladas → JSON esperado).
  - Validação do schema de saída (Zod/JSON Schema) — *contract test*.
  - Cálculo de métricas (tokens/s a partir das durações).
- **Integração:**
  - Endpoints da API com o **Ollama mockado** (sem chamar o modelo real), verificando o fluxo job → status → resultado.
  - Tratamento de erros (Ollama fora do ar, arquivo inválido, timeout).
- **End-to-end (topo, poucos):**
  - Fluxo de upload → progresso → resultado → exportação, com Playwright, em viewports mobile e desktop.

**Práticas de apoio**
- Cobertura mínima definida (ex.: 80% nas camadas de domínio/serviço).
- *Test doubles* para o cliente do Ollama (injeção de dependência facilita isso).
- Testes determinísticos: a saída do modelo real é variável, então ela é **mockada** nos testes; o modelo real só entra em testes manuais/exploratórios ou um *smoke test* opcional marcado como lento.
- CI executando lint + testes a cada commit/PR.

---

## 11. Engenharia de software e estrutura

**Organização (monorepo simples):**
```
/docs
  DESIGN.md
  PRD.md
/apps
  /web        (React + TypeScript)
  /api        (Node + Fastify + TypeScript)
/packages
  /shared     (tipos e schema do JSON compartilhados entre front e back)
```
- **TypeScript** no front e no back; o **schema do JSON é compartilhado** em `/packages/shared`, garantindo que front e back falem o mesmo contrato.
- **Camadas no backend:** rotas → serviços (regras) → adaptadores (cliente Ollama, conversor de PDF, exportadores). Adaptadores atrás de interfaces para testabilidade e troca futura (ex.: trocar Ollama por vLLM).
- **Lint/format:** ESLint + Prettier; *commit hooks* (lint-staged) para manter padrão.
- **Versionamento:** Git com *conventional commits*; PRs pequenos.
- **CI:** lint → testes → build. Pronto para adicionar *deploy* depois.
- **Tratamento de erros consistente:** tipos de erro de domínio (validação, dependência externa, timeout) mapeados para respostas HTTP claras.

---

## 12. Roadmap por fases

**Fase 0 — Fundação:** estrutura do repo, TypeScript, lint, CI, schema compartilhado, esqueleto de testes. (TDD desde aqui.)

**Fase 1 — MVP local:** upload de imagem → OCR via Chandra/Ollama → JSON padronizado → exibição. Processamento assíncrono com SSE. Tratamento de erros básico.

**Fase 2 — PDF e exportação:** conversão PDF → imagens (multipágina), exportação JSON/CSV/Excel, correção manual de campos.

**Fase 3 — Extração inteligente:** camada de extração via LLM de texto + parsers por template; detecção de tipo de documento; warnings de confiança.

**Fase 4 — Robustez e escala:** processamento em lote, histórico persistente, cancelamento, métricas/observabilidade.

**Fase 5 (futuro, fora do escopo atual):** autenticação/multiusuário, deploy remoto, migração opcional para vLLM para maior throughput.

---

## 13. Métricas de sucesso
- Tempo médio de processamento por documento (acompanhar e reduzir).
- Taxa de campos extraídos corretamente (validação manual em amostra).
- Taxa de erros tratados vs. falhas não tratadas.
- Cobertura de testes mantida acima do mínimo definido.
- Usabilidade: conclusão do fluxo de ponta a ponta sem instrução, em mobile e desktop.

---

## 14. Riscos e mitigações
| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Modelo `:patch` é da comunidade e experimental | Instabilidade/saída cortada | Abstrair o cliente OCR atrás de interface; permitir trocar para vLLM oficial; tratar `MAX_OUTPUT_TOKENS` |
| Processamento lento (minutos/doc) | UX ruim | Job assíncrono + progresso por etapas; expectativa comunicada na UI |
| Saída do modelo é texto não confiável | XSS ao renderizar | Sanitização rigorosa no front |
| Licença comercial do Chandra | Risco legal em uso comercial | Validar enquadramento de uso; considerar licença/oficial se necessário |
| Variabilidade da saída do modelo | Testes instáveis | Mockar o modelo nos testes; smoke tests separados |
| Modelo dividido entre CPU/GPU | Lentidão | Monitorar `ollama ps`; ajustar para caber na VRAM |

---

## 15. Questões em aberto
1. **`DESIGN.md`:** conteúdo a ser incorporado para fechar a seção 8 (tokens, componentes, tom).
2. **Tipos de documento alvo:** quais documentos (recibos, notas fiscais, formulários específicos?) definem os campos padrão da extração.
3. **Extração:** preferência inicial entre LLM de texto (flexível) e parsers por template (rápido) por tipo de documento.
4. **Exportação:** o CSV/Excel deve achatar os campos em colunas fixas por tipo de documento? (Provável que sim.)
5. **Persistência:** o histórico deve sobreviver ao fechar a aplicação (banco local, ex.: SQLite) ou basta em memória no MVP?
```
