# 05 — Database (Supabase / Postgres)

Single project. RLS enabled on all user-facing tables. Types generated to `lib/database/types.ts` via `npx supabase gen types typescript --linked` — do not hand-edit.

Migrations live in `supabase/migrations/` and follow `YYYYMMDD_NNN_description.sql`. Apply via Supabase CLI (`supabase db push`) or SQL Editor.

## Active tables

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `profiles` | Synced from `auth.users`. User identity. | `id` (PK = `auth.users.id`), `email`, `full_name`, `avatar_url`, `cpl_score`, `preferences` (JSONB), `writing_style` (JSONB) |
| `user_preferences` | Per-user settings + the **learned style profile**. | `user_id` (UNIQUE — added in `20260510`), `style_patterns` (JSONB — the `StylePatterns` blob), `approved_message_count`, `rejected_message_count`, `vocabulary_profile` (JSONB), `theme`, `timezone`, `formality_level`, `share_analytics` |
| `extension_rate_limits` | Daily generation quota — fail-closed gate for `/api/extension/generate`. | `user_id` (PK), `request_count`, `window_start` (24-hr rolling), `created_at`, `updated_at`. **No RLS policies** — service-role only. |
| `generated_drafts` | Every generated message persisted. | `id`, `user_id`, `content`, `draft_type` enum, `cpl_score`, `is_accepted`, `metadata` (JSONB), thread linkage fields |
| `user_feedback` | Thumbs-up/down per draft. **Sync-inserted** by `POST /api/extension/feedback` before response — protects eval signal against worker crash. | `id`, `user_id`, `draft_id`, `feedback_type` (`approved` / `rejected`), `rating` (5 = approved, 1 = rejected), `comment` (rejection reason), `metadata` (JSONB — `{ category, message_length, has_subject, promptVersion, model, temperature, intent, generationTimeMs, inputTokens, outputTokens }`) |
| `user_inputs` | Request history. | `id`, `user_id`, `content`, `raw_text`, `metadata` |
| `threads` | Conversation container (used by web app). | `user_id`, `folder_id`, `name`, `category`, `context` (JSONB), `message_count`, `total_drafts_generated`, `average_cpl_score`, `is_active`, `is_archived`, `is_pinned` |
| `thread_folders` | Organize threads. | `user_id`, `name`, `icon`, `color`, `is_default`, `is_open`, `sort_order` |

### Dropped in Phase 3 cleanup (`20260401_cleanup_dead_schema.sql`)

`usage_analytics`, `messages`, `user_inputs` (chatbot era — partially kept for extension), `conversations`, `production_metrics` (no writers), and 6 functions (`match_user_style_vectors`, `find_similar_style_vectors`, `get_user_voice_stats`, `aggregate_style_analytics`, `cleanup_old_analytics`, `cleanup_old_conversations`). `conversation_category` type also dropped.

## RLS policies

Created in `20260218004_create_rls_policies.sql`. Pattern (paraphrased):

```
ENABLE RLS on <table>;
CREATE POLICY users_select_own ON <table> FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY users_insert_own ON <table> FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_update_own ON <table> FOR UPDATE USING (auth.uid() = user_id);
```

Exceptions:
- `profiles.id = auth.uid()` (not `user_id` — `id` is the user's UUID).
- `extension_rate_limits` — RLS enabled, **no policies created**. Effect: only `service_role` can touch it. Used as a fail-closed gate (the route uses the service-role client to call the RPC).

## RPC functions

| RPC | File | Purpose |
|-----|------|---------|
| `check_and_increment_rate_limit(p_user_id UUID, p_daily_limit INT DEFAULT 30)` | `20260310_atomic_rate_limit.sql` | Atomic: lock row `FOR UPDATE`, reset if `window_start` >24h old, increment, return `{ allowed, remaining, reset_time }`. Called from `app/api/extension/generate/route.ts` `checkRateLimit()`. |
| `increment_approved_count(p_user_id UUID, p_style_patterns JSONB)` | `20260510_atomic_style_increment.sql` | `INSERT ... ON CONFLICT (user_id) DO UPDATE` — bumps `approved_message_count`, overwrites `style_patterns`. `SECURITY DEFINER`. Called from feedback route on thumbs-up. |
| `increment_rejected_count(p_user_id UUID)` | Same file | Same upsert pattern, bumps `rejected_message_count`. Called on thumbs-down. |

All three are `SECURITY DEFINER` and granted to `authenticated, service_role`.

## Enums

| Enum | Values | Notes |
|------|--------|-------|
| `draft_type` | `adaptive_polish` (active), `grammar_fix` (legacy — kept because `sanitizer.test.ts` still references it) | Defined in `20260218001_create_enums.sql` |
| `conversation_category` | — | **Dropped** in `20260401_cleanup_dead_schema.sql` |

## Migration history (the 10 we actually have)

| File | Date | Change |
|------|------|--------|
| `20260217_create_extension_rate_limits.sql` | 2026-02-17 | Create `extension_rate_limits` table, index, trigger, RLS (no policies) |
| `20260218001_create_enums.sql` | 2026-02-18 | `draft_type`, `conversation_category` enums |
| `20260218002_create_tier1_tables.sql` | 2026-02-18 | `profiles`, `user_preferences`, `thread_folders` (no inter-table deps) |
| `20260218003_create_tier2_tables.sql` | 2026-02-18 | `threads`, `conversations`, `messages`, `user_inputs`, `generated_drafts`, `user_feedback`, `usage_analytics`, `user_embeddings`, `api_usage_logs`, `user_sessions` |
| `20260218004_create_rls_policies.sql` | 2026-02-18 | RLS + per-table policies |
| `20260218005_create_indexes.sql` | 2026-02-18 | Performance indexes (user_id, timestamps) |
| `20260309_add_style_counts.sql` | 2026-03-09 | Add `approved_message_count` + `rejected_message_count` to `user_preferences` |
| `20260310_atomic_rate_limit.sql` | 2026-03-10 | Create `check_and_increment_rate_limit` RPC (fail-closed) |
| `20260401_cleanup_dead_schema.sql` | 2026-04-01 | Drop 5 unused tables + 6 functions + 1 type. See Phase 3 in `claude-progress.txt`. |
| `20260510_atomic_style_increment.sql` | 2026-05-10 | UNIQUE constraint on `user_preferences.user_id`. Create `increment_approved_count` + `increment_rejected_count` RPCs (`SECURITY DEFINER`, upsert). |

## Regenerating types

```bash
npx supabase gen types typescript --linked > lib/database/types.ts
```

`lib/database/types.ts` is excluded from ESLint (`.eslintignore`) because it's generated.

## How routes touch the DB

| Route | Tables / RPCs |
|-------|---------------|
| `POST /api/extension/generate` | `extension_rate_limits` (via RPC), `user_preferences` (read style) |
| `POST /api/extension/feedback` | `user_feedback` (insert), `user_preferences` (RPC upsert) |
| `GET /api/extension/session` | `auth.users` (via Supabase Auth) |
| `GET /api/auth/me` | `auth.users`, `extension_rate_limits` (read) |
| `PATCH /api/settings` | `user_preferences` (upsert) |
| `POST /api/feedback` | `feedback` (insert, public form) |
| `/auth/callback` | `profiles` (via `ensureUserProfile` upsert) |
| `/dashboard` SSR | `profiles`, `generated_drafts`, `extension_rate_limits`, `user_feedback` (counts) |
| `/profile` SSR | `profiles` |
| `/settings` SSR + client island | `user_preferences` |

## Client factory contract

| Function | Auth model | Use case |
|----------|-----------|----------|
| `createClient()` from `lib/supabase/server.ts` | Cookie session | Server components, server actions, `PATCH /api/settings` |
| `createServiceClient()` from `lib/supabase/server.ts` | `SUPABASE_SERVICE_ROLE_KEY` | RPC calls, admin/background, `extension_rate_limits` access |
| `createClient()` from `lib/supabase/client.ts` | Anon key (browser) | Client components |
| `createClient()` from `@supabase/supabase-js` (raw) | Anon key | `app/api/extension/generate/route.ts` for `auth.getUser(accessToken)` bearer validation only |

**Never mix.** Service role bypasses RLS — only use for admin / background. RLS is the security boundary.

## Cross-references

- Routes that call these tables → `02-web-app-routes.md`
- Style-learning loop that writes to `user_preferences` → `03-ai-pipeline.md#style-learning-loop`
- Why `extension_rate_limits` is fail-closed → `08-conventions-and-security.md#tier-1-critical-security`
