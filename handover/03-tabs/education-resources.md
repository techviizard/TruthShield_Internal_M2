# Tab: Learn & Resources

**File:** `src/components/tabs/education-resources-tab.tsx` · **Data:** none (static content) · **Status:** ✅ static

## What it is
Media-literacy education: courses/tutorials, tips to spot deepfakes/misinformation, and quizzes.

## How it's built
Static curriculum content rendered from in-file constants. **This is editorial content, not runtime data** — it's not part of the hardcoded-data removal.

## How it works (logic)
Renders sections/cards; quiz state is local.

## Future scope & enterprise enhancements
- Move curriculum to a **CMS/MDX** so non-engineers can edit; localize.
- Track quiz progress per user; certificates.
- Link lessons to live examples from the analysis history.
