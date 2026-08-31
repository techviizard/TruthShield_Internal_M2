# Tab: Learn & Resources

**File:** `src/components/tabs/education-resources-tab.tsx` · **Data:** none (static content) · **Status:** ✅ static

## What it is
Media-literacy education: courses/tutorials, tips to spot deepfakes/misinformation, and quizzes.

## How it's built
Static curriculum content rendered from in-file constants. **This is editorial content, not runtime data** - it's not part of the hardcoded-data removal.

## How it works (logic)
Renders sections/cards; quiz state is local.

## Future scope & enterprise enhancements
- Move curriculum to a **CMS/MDX** so non-engineers can edit; localize.
- Track quiz progress per user; certificates.
- Link lessons to live examples from the analysis history.

## Scope of work

Tracked centrally in [`05-scope-of-work/`](../05-scope-of-work/README.md).

| Item | Status | Note |
|---|---|---|
| Media literacy curriculum | ✅ Implemented | Static by design. Growth is editorial work, not engineering |
| Per-user progress tracking | ⏳ Planned | Depends on the auth layer |
| Localised curriculum beyond English | ⏳ Planned | Follows the locale file work in [03-delivery-backlog](../05-scope-of-work/03-delivery-backlog.md) |