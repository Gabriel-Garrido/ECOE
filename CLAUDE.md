# CLAUDE.md — Quismart (ECOE-MVP)

## Project Overview
Clinical evaluation platform (ECOE/OSCE) built with React 18 + Vite + TypeScript + Tailwind CSS 3.4.
Backend: Django REST API. Auth: JWT (access + refresh tokens in localStorage).

## Branding: Universidad Mayor

### Color Tokens (defined in `tailwind.config.js`)
All UI must use these tokens — never hardcode hex values or use default Tailwind blues.

| Token | Hex | Usage |
|-------|-----|-------|
| `brand-yellow` | #FEDA3F | Accent, active nav indicator, decorative highlights |
| `brand-yellow-alt` | #FECE40 | Alternative yellow accent |
| `brand-yellow-light` | #FFF8E1 | Light yellow backgrounds |
| `brand-teal` | #12636B | **Primary action color**: buttons, links, headings, focus rings |
| `brand-teal-dark` | #0E4F56 | Hover state for teal elements |
| `brand-teal-light` | #E8F4F5 | Light teal backgrounds, info banners |
| `brand-red` | #A4222B | Errors, danger buttons, alert states only |
| `brand-red-dark` | #8B1D24 | Hover state for red elements |
| `brand-red-light` | #FDF2F2 | Light red backgrounds for error messages |
| `neutral-dark` | #343742 | Sidebar/header backgrounds, main dark surface |
| `neutral-gray-dark` | #3C3C3B | Body text, headings |
| `neutral-gray` | #888992 | Secondary text, ghost buttons, placeholders |
| `neutral-gray-soft` | #B7BBB4 | Tertiary text |
| `neutral-gray-light` | #CCCCCC | Borders, dividers |
| `neutral-gray-pale` | #E3E3E3 | Light backgrounds |

### Color Rules
1. **Primary interaction = teal** (`brand-teal` for buttons, links, focus)
2. **Yellow = accent only** — active nav items, decorative dividers, subtle highlights. Never as dominant background.
3. **Red = errors/danger only** — error messages, danger buttons, rejected badges
4. **Dark sidebar/header** — use `neutral-dark` (NOT blue/navy)
5. Keep page backgrounds light (`bg-gray-50`)
6. Cards: white with `border-gray-200` and `shadow-sm`

### Logo Assets
Located in `src/assets/branding/logos/`:
- `logo-primary-horizontal-tagline-transparent.png` → navbar desktop, evaluator header, wide layouts
- `logo-primary-vertical-tagline-transparent.png` → login page, splash, auth screens
- `logo-primary-square-yellow-bg.png` → mobile header, compact spaces, sidebar collapsed
- **Never deform, crop, or stretch logos.** Always use `object-contain`.
- The `AppLogo` component (`src/components/AppLogo.tsx`) handles all variants.

### Brand Divider
`src/assets/branding/ui/brand-divider-dark-gray-transparent.png` — decorative strip used on login page.

## Architecture

### Component Structure
- `src/components/ui/` — Reusable UI primitives (Button, Input, Card, Modal, Badge, Spinner, Toast, EmptyState, Breadcrumb)
- `src/components/AppLogo.tsx` — Brand logo component with `horizontal | vertical | square` variants
- `src/layouts/` — AdminLayout (sidebar) and EvaluatorLayout (top header)
- `src/pages/` — Route pages organized by role (`auth/`, `admin/`, `evaluator/`)
- `src/api/` — Axios API client modules
- `src/context/` — AuthContext, ToastContext

### Styling Approach
- Utility-first Tailwind CSS
- Global component classes in `index.css` (`.btn-primary`, `.input`, `.label`, `.card`, `.error-text`)
- `clsx` for conditional class merging in components
- **No dark mode** — institutional, light-mode-only design

### Key Patterns
- Forms: react-hook-form + zod validation
- Server state: TanStack React Query
- Path alias: `@` → `src/`
- UI language: Spanish (es-CL)
- Two roles: ADMIN (sidebar layout), EVALUATOR (header layout)

## When Adding New Pages
1. Use `brand-teal` for primary buttons, links, and headings
2. Use `neutral-dark` for section titles
3. Cards: `bg-white rounded-xl border border-gray-200 shadow-sm`
4. Use existing UI components from `src/components/ui/`
5. Follow the spacing pattern: `p-4 lg:p-6` for page content
6. Use `AppLogo` component for any logo display — never reference image paths directly
7. Tables: `bg-gray-50` header, `border-gray-100` rows
8. Info banners: `bg-brand-teal-light border-brand-teal/20`
9. Error banners: `bg-brand-red-light border-red-200`
