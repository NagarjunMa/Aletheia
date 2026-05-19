# Aletheia — Codebase Reference Index

Permanent, hand-written reference covering every functional surface of the codebase. Each file answers four questions per topic: **what / why / where / how**.

Use this when you (or a future Claude session) need to find a feature without re-exploring the repo. For runtime conventions, defer to `/CLAUDE.md`. For history of changes, defer to `/.claude/claude-progress.txt`.

## Files in this directory

| File | Topic |
|------|-------|
| `01-overview.md` | What Aletheia is, the two surfaces, end-to-end user journey, condensed tech stack |
| `02-web-app-routes.md` | Every Next.js page + API route — path, auth model, schema, response shape, failure modes |
| `03-ai-pipeline.md` | The product moat: sanitizer, fingerprint detector, style analyzer, prompt builder, stage order |
| `04-extension.md` | Chrome MV3 extension: manifest, service worker, content scripts, popup, settings, build |
| `05-database.md` | Supabase schema: active tables, RPC functions, RLS approach, migration milestones |
| `06-infrastructure.md` | Middleware, CSP nonce, CORS, logger split, Supabase factories, Sentry, CI, deploy |
| `07-testing.md` | Vitest unit, guardrails, Playwright smoke, extension suite, schema-in-`schema.ts` pattern |
| `08-conventions-and-security.md` | Condensed DO/DON'T + summary of 28 production-readiness fixes by tier |

## Related references (do not duplicate — read alongside)

| Source | Use for |
|--------|---------|
| `/CLAUDE.md` | Authoritative conventions and architecture cheat sheet |
| `/README.md` | Public-facing setup, env vars, command reference |
| `/.claude/claude-progress.txt` | Phase-by-phase history of every cleanup / improvement (1–24) |
| `/FUNCTIONS.md` | Per-function reference at the repo root (~117 functions, all layers) |
| `/.claude/context/project-overview.md` | Older condensed overview |
| `/.claude/context/architecture-decisions.md` | Older ADR-style notes |
| `/.claude/context/production-ready-overview.md` | Older production-ready summary |
| `/.claude/production-readiness-evaluation.md` | Full audit trail with severity scoring |
| `/.claude/tier1-security-fixes.md` | Detailed before/after for the 5 Tier-1 fixes |
| `/.claude/phase-24-strategic-deletion.md` | MVP right-sizing plan + delta |

## Style rules (for anyone editing these docs)

- Tables over prose for inventories.
- Code identifiers and file paths in backticks.
- File paths relative to repo root.
- No emojis, no marketing copy.
- Each topic answers what/why/where/how in that order.
- If a doc contradicts `CLAUDE.md`, `CLAUDE.md` wins. Update the doc, not the source of truth.
- When refactors land, update these docs in the same PR. Stale reference is worse than no reference.
