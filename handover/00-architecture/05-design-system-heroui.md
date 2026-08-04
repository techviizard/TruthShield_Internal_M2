# Design System (HeroUI v3 + Tailwind v4 tokens)

## The one thing to understand

**Everything is themed by CSS variables.** Both the legacy shadcn primitives (`src/components/ui/*`) and any new HeroUI components read the *same* semantic tokens (`--background`, `--card`, `--primary`, `--border`, …) defined in `src/app/globals.css`. Change a token → the whole app (48 primitives × 28 tabs) reskins at once. This is why the revamp was low-risk.

## Token layers in `globals.css`

```
@import "@heroui/react/styles";   /* pulls Tailwind v4 + HeroUI base/theme/components */

:root { … light values … }
.dark, [data-theme="dark"] { … dark values … }   ← app default is dark
```

### Brand palette (current)

| Token | Meaning | Dark value |
|-------|---------|-----------|
| `--background` | page | true black `#000` |
| `--card` / `--surface` | raised surface | `~#0d0d0d` |
| `--popover` / `--overlay` | floating | `~#141414` |
| `--sidebar` | base surface | `~#050505` |
| `--brand-orange` | **primary CTA / brand** | `~#f6821f` |
| `--brand-teal` | **secondary / links / active-nav / focus** | `~#2dd4bf` |
| `--primary` | = orange | brand-orange |
| `--ring` / `--sidebar-primary` | = teal | brand-teal |
| `--destructive` / `--danger` | error/threat | red |
| `--chart-1..5` | data-viz | orange, teal, amber, emerald, rose |

**Accent rule:** orange = primary action/brand. teal = secondary/interactive/active. Threat scale (emerald→amber→red→rose) is independent of both. **Never hard-code a hex in a component — use the token.**

## Gotcha: Tailwind v4 arbitrary color vars

`bg-[var(--x)]` works (defaults to a color property). But `text-[var(--x)]` is **ambiguous** (could be length) and Tailwind may drop it. Two safe forms:

- explicit: `text-[color:var(--brand-teal)]`
- or the helper classes added in `globals.css`: `.text-brand-orange`, `.text-brand-teal`, `.nav-active`.

Use the helper classes for brand text; use tokens (`text-primary`, `text-muted-foreground`) for everything else.

## HeroUI v3 usage notes

HeroUI v3 components are **compositional** and built on react-aria:

- Buttons use `onPress` (not `onClick`) and `isDisabled` (not `disabled`); `variant` ∈ `primary|secondary|tertiary|outline|ghost|danger|danger-soft`; `isIconOnly` for icon buttons.
- `variant="primary"` uses the shared `--accent` token. In this app `--accent` is kept **neutral** (so shadcn hover states don't turn orange). For a brand-orange HeroUI button, add `className` with `bg-primary text-primary-foreground`.
- Compound components: `Avatar` + `AvatarFallback`, `Tooltip` = `TooltipRoot/Trigger/Content`, `Kbd` takes children. Don't guess props — check `node_modules/@heroui/react/dist/components/<name>/*.d.ts`.

## Migration state (shadcn → HeroUI)

- ✅ Shell (`page.tsx`) uses HeroUI `Button/Chip/Kbd/Avatar/Separator`.
- ✅ Token layer drives both systems, so the *look* is unified already.
- 🟡 The 48 `src/components/ui/*` primitives are still shadcn/Radix under the hood. Plan (adapter approach): rewrite each to wrap the HeroUI equivalent while keeping the same import path + props, so the 28 tabs don't change their imports. See the original design spec: `docs/superpowers/specs/2026-07-25-heroui-v3-revamp-design.md`.

## Future scope

- Finish the primitive adapter layer; then delete unused Radix deps.
- Add a **light theme** pass (tokens exist; values need tuning) and a theme switcher already present.
- Extract tokens into a small `theme.css` + document a Figma/token map for designers.
- Add visual regression tests (Playwright + screenshots) keyed on the token contract.
