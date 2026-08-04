# App Shell & Routing

File: `src/app/page.tsx` (~560 lines). This is the whole visible frame. Layout wrapper: `src/app/layout.tsx`.

## There is only one route

TruthShield is a **single page**. It does **not** use Next.js file routing for features. Instead:

- `page.tsx` renders a **sidebar + header + footer + content area**.
- The content area shows **one of 28 tab components**, chosen by a `activeTab` value in the Zustand store (`src/lib/store.ts`).
- Switching "pages" = calling `setActiveTab(id)` — no URL change, no navigation.

```
page.tsx
 ├─ <header>  brand, command-palette trigger (⌘K), status, notifications, theme toggle, avatar
 ├─ <aside>   SidebarNav — nav items grouped by section
 ├─ <main>    renderTab() → the active tab component (wrapped in Framer Motion)
 └─ <footer>  version, stats, clock
```

## Key pieces inside `page.tsx`

| Piece | Role |
|-------|------|
| `navItems[]` | The 28 nav entries: `{ id, label, icon, section }`. **Add a feature by adding here + a `case` in `renderTab()`.** |
| `searchItems[]` | Command-palette (⌘K) quick-nav entries. |
| `renderTab()` | Big `switch (activeTab)` mapping id → component. |
| `SidebarNav` | Groups `navItems` by `section`, renders active state (teal indicator). |
| `GlobalSearch` | ⌘K dialog, fuzzy-filters `searchItems`. |
| `ThemeToggle` | next-themes light/dark (default **dark**). |

## Adding a new tab (recipe)

1. Create `src/components/tabs/my-feature-tab.tsx` exporting `MyFeatureTab`.
2. Add its `TabId` to the union in `src/lib/store.ts`.
3. Add an entry to `navItems[]` (id, label, icon, section) in `page.tsx`.
4. Add a `case 'myFeature': return <MyFeatureTab />` in `renderTab()`.
5. (Optional) add a `searchItems[]` entry for ⌘K.

## ⚠️ Known caveat: Framer Motion + `AnimatePresence mode="wait"`

The content area wraps the active tab in:

```tsx
<AnimatePresence mode="wait">
  <motion.div key={activeTab} …>{renderTab()}</motion.div>
</AnimatePresence>
```

`mode="wait"` holds the new tab until the old one's exit animation finishes. Exit animations are driven by `requestAnimationFrame`, which **pauses when the tab/window is not visible** (e.g. background tab, headless browser). In that state the header label updates but the body can appear "stuck" on the previous tab. It resolves as soon as the page is visible again.

**Recommendation:** for robustness, either drop `mode="wait"` or gate the animation on `document.visibilityState`. Not a functional bug for real users, but it surprises automated tests.

## Layout / providers (`layout.tsx`)

- Loads Geist + Geist Mono fonts.
- `next-themes` `ThemeProvider` (`attribute="class"`, `defaultTheme="dark"`).
- Mounts the shadcn `Toaster`. (HeroUI has its own `ToastProvider` — pick one when finishing the migration.)

## Future scope

- **Real routing:** promote heavy tabs to real Next routes (`/analyze/text`, …) for deep-linking, code-splitting, and SSR of read-only views. The `activeTab` switch is the single biggest scalability limiter — every tab is imported eagerly into one bundle.
- **Lazy-load tabs** with `next/dynamic` to cut the initial bundle (28 tabs currently ship together).
- **Auth + role-gated nav** (see `User.role`): hide/disable nav items by permission.
