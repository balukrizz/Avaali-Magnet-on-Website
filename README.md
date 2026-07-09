# Meridian — Enterprise AI Opportunity Assessment Platform

A **configuration-driven** lead-magnet platform that assesses an organization's AI
readiness and generates a grounded, consulting-grade report. Business users add
questionnaires, industries, use cases, rules, and prompts by editing **JSON — no
code changes required**. The LLM never invents use cases: it only ranks, explains,
and sequences items retrieved from a curated **Master Use Case Repository**.

```
Frontend  →  API Layer  →  Recommendation Service  →  Rule Engine
                                     ↓
                        Use Case Repository (master_usecases.json)
                                     ↓
                        LLM Service (provider-agnostic)
                                     ↓
                             Report Generator
```

Each layer is an independently replaceable module.

---

## Quick start

```bash
npm install
cp .env.example .env          # add a key for whichever provider you choose
npm run dev                   # http://localhost:3000  (admin at /admin)
```

By default `config/config.json` uses `provider: "claude"`. Set `ANTHROPIC_API_KEY`
in `.env`, or switch providers (see below). **With no key / `llm.enabled: false`,
the platform still returns a complete report** built deterministically from the
rule-engine ranking — nothing breaks and no LLM cost is incurred.

Deploy to Vercel as-is (single Next.js app, API routes included).

---

## The configuration-driven core (`/config`)

| File | Controls | Change it to… |
|------|----------|---------------|
| `master_usecases.json` | The repository — every recommendable use case + metadata | Add/edit use cases (the only things the LLM can recommend) |
| `questionnaire.json` | Wizard steps & fields | Add questions, options, industries; the UI renders them automatically |
| `rules.json` | Scoring weights + `threshold` + caps | Retune Industry/Function/PainPoint/Objective weighting |
| `industry_mapping.json` | Industry aliases + maturity baselines | Normalize labels, adjust readiness baselines |
| `prompt_templates.json` | System/user/schema prompts | Reword the LLM instructions & output contract |
| `config.json` | Active LLM provider, model, temperature | Switch model with one field |

Editing any of these changes platform behavior with **no code changes**. The Admin
portal edits the same data at runtime (in-memory overlay — see *Persistence*).

---

## Recommendation logic

The **rule engine** (`src/lib/ruleEngine.ts`) scores every *enabled* use case:

| Dimension | Default weight |
|-----------|----------------|
| Industry match | 30 |
| Function match | 30 |
| Pain-point match | 20 (partial credit configurable) |
| Objective match | 20 (partial credit configurable) |

Only use cases scoring **above `threshold` (default 70)** are passed to the LLM
(capped at `maxUseCasesToLLM`). The model receives the company profile, answers,
business rules, the filtered candidates, and the expected JSON schema — then ranks
the top 5, explains, estimates ROI & automation potential, and builds the roadmap.

**Anti-hallucination guarantee.** `src/lib/llm/service.ts` discards any returned
opportunity whose `id`/`name` is not in the candidate set. A verification run
confirms zero invented use cases even when the model is prompted freely.

---

## Switching LLM providers

Set `llm.provider` in `config.json` (or use the Admin → *LLM Provider* tab). One
provider abstraction (`src/lib/llm/provider.ts`) covers all of them:

`openai` · `azure` · `mistral` · `claude` · `groq` · `gemini` · `ollama`

Per-provider `model` / `baseURL` / `apiKeyEnv` live in `config.json`. Keys come from
env vars (`.env`). Adding a provider = one `case` in `provider.ts` + one config
entry; nothing else changes.

---

## API reference

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/questions` | Config-driven questionnaire |
| POST | `/api/questions` | Validate an answer set |
| GET | `/api/usecases?function=&enabled=` | Master repository |
| POST | `/api/recommend` | Rule engine only → scored candidates (no LLM) |
| POST | `/api/report` | Full workflow → assembled `Report` (LLM + fallback) |
| POST | `/api/llm/generate` | Low-level: filter + call LLM directly (debug) |
| POST | `/api/admin/import` | Import use cases from CSV or JSON |
| GET/POST | `/api/admin/config` | Effective config; toggle/prompt/provider/export/reset |

Example:
```bash
curl -X POST localhost:3000/api/report -H 'Content-Type: application/json' -d '{
  "company":"ABC Ltd","designation":"CFO","industry":"BFSI","orgSize":"5,000 – 25,000",
  "functions":["Finance","Procurement"],"painPoints":["Manual work"],"objectives":["Reduce Costs"]
}'
```

---

## Admin portal (`/admin`)

- **Use Cases** — enable/disable any use case (affects what the engine can recommend)
- **Prompt Template** — edit the system/user/schema prompts live
- **LLM Provider** — switch provider, toggle LLM on/off
- **Import** — upload CSV (Excel → Save As CSV) or JSON; columns: Industry,
  Business Function, Use Case, Pain Point, AI Objective, Priority, ROI, Complexity,
  Timeline, Recommended Product, Tags (use `;` for multi-value cells)
- **Preview** — run the rule engine against a sample profile and see per-dimension
  score breakdowns
- **Export configuration** — download the full effective config as JSON

### Persistence
Admin edits use an in-memory overlay (`configLoader.ts`) that resets on restart —
ideal for demos. For production, back the overlay with **Postgres** (use cases,
config) and **Redis** (recommendation cache); the `configStore` interface is the
single seam to swap.

---

## Report contents

Executive summary · readiness score & maturity · confidence score · top 5
opportunities (why / ROI / automation % / complexity / timeline / solutions) ·
business outcomes · expected KPIs · 18-month roadmap (quick wins / medium / strategic)
· technology recommendations · risk assessment. The report view includes a
print-to-PDF action; swap in `@react-pdf/renderer` or Puppeteer for a branded
server-side PDF.

---

## FastAPI + LangGraph variant

The spec preferred a Python backend. This repo runs the same architecture on Next.js
API routes for a single deployable unit, but the module boundaries map 1:1:

| This repo (TS) | FastAPI + LangGraph equivalent |
|----------------|-------------------------------|
| `ruleEngine.ts` | `services/rule_engine.py` (pure scoring) |
| `repository.ts` | `services/repository.py` (JSON → Postgres → Qdrant) |
| `llm/provider.ts` | `services/llm_provider.py` (provider abstraction) |
| `llm/service.ts` + `reportGenerator.ts` | a **LangGraph** state graph: `filter → retrieve → rank → summarize → roadmap`, with conditional routing, retries, and a guardrail node |
| API routes | FastAPI routers (`/api/*`) |

Keep the config JSON identical; point both stacks at the same files or DB.

---

## Scalability roadmap

1000+ use cases & 100+ industries (repository already metadata-driven) · **vector DB
+ RAG** (Qdrant/Chroma) for semantic retrieval as the repo grows · **Redis** caching
of repeated recommendations · **LangSmith** tracing for prompts/tokens/latency ·
multi-language questionnaires · auth & multi-tenant · CRM integration (Salesforce /
HubSpot) for captured leads · Power BI / analytics dashboard for lead scoring.
