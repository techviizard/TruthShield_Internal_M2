# Tab: Settings

**File:** `src/components/tabs/settings-tab.tsx` · **Data:** store preferences · **Status:** ✅

## What it is
User/platform preferences: language, analysis sensitivity, notifications, API/config toggles.

## How it's built
Reads/writes store preference fields (`selectedLanguage`, `analysisSensitivity`, `notificationsEnabled`, …), which `persist` to localStorage.

## How it works (logic)
1. Controls bind to store setters (`setSelectedLanguage`, `setAnalysisSensitivity`, `setNotificationsEnabled`).
2. Values persist client-side and influence analysis calls.

## Future scope & enterprise enhancements
- Persist to the DB (`UserPreferences` model) per user, not just localStorage.
- Org-level settings + RBAC; secrets (API keys) via a secure vault, never localStorage.
- Settings audit trail; import/export.
