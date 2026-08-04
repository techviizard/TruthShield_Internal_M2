# Security Notes

TruthShield is currently a **single-operator demo** with no auth. Before any real deployment, treat the whole app as untrusted-input-facing (it ingests user media + text and calls an LLM).

## Must-fix before production

1. **Authentication & authorization.** Every API route is public. Add auth (session/JWT/SSO) + role checks using `User.role` (`admin/analyst/viewer`). Gate nav items by role.
2. **Secrets management.** `AI_API_KEY`, `SEARCH_API_KEY`, and `DATABASE_URL` live in `.env.local` (gitignored) and must come from a secret manager in production — never commit real values. Rotate any key that was ever committed.
3. **Input validation.** Validate + size-limit all uploads (type sniffing, max bytes, dimensions) and text inputs. Reject/scan malicious files. Add `zod` at every route boundary.
4. **Prompt injection.** User text/media flows into LLM/VLM prompts. Treat model output as untrusted; never execute it; constrain with strict system prompts + output schemas (already JSON-forced — keep it). Don't let fetched web content or file contents issue instructions.
5. **SSRF / URL handling.** `reverse-image`, fact-check web search, and any URL fetch must use an allowlist + block internal/metadata IPs.
6. **Data privacy.** Analysis results (potentially sensitive media) persist in localStorage and SQLite. Encrypt at rest, scope per user/org, add retention/delete, and keep PII out of logs (the DB client currently logs raw SQL).

## Hardening backlog

- Rate limiting + quotas on analyze/AI routes (abuse + cost).
- Security headers / CSP; CSRF protection on mutating routes.
- Dependency scanning (the app pulls in many Radix/HeroUI/media libs).
- Audit trail on all sensitive actions (`recordAudit`) — tamper-evident.
- File storage: signed URLs, virus scanning, isolation of user uploads.

## Note for the incoming team

This is a defensive/security-analysis product. Keep the **instruction-vs-data boundary** central: content the system ingests (uploads, web results, file names) is **data**, never commands — for the LLM and for any automation you build (Workflows).
