# HostelConnect Neo-Brutalist Design System Specification
**Netaji Subhas University of Technology (NSUT), Dwarka, New Delhi**

---

## 1. Design Philosophy & Core Principles

HostelConnect is the mission-critical institutional hostel management platform for NSUT Dwarka. The interface implements an unapologetic **Neo-Brutalist** aesthetic that unites institutional authority, high data density, physical tactility, and uncompromising visual clarity.

### Strict Core Principles
1. **Tokens Only**: All styles must derive directly from semantic Tailwind tokens and CSS variables. Arbitrary or inline hardcoded hex values are strictly forbidden across production code.
2. **Neo-Brutalist Physicality**: Every card, button, modal, input, and table adheres to **2px solid pure black borders** (`#000000`) and **hard, zero-blur offset shadows** (`shadow-hard-sm`, `shadow-hard`, `shadow-hard-lg`, `shadow-hard-xl`).
3. **Flat Solid Canvas**: The application canvas is rendered in warm, tactile yellow (`#ffe17c`) layered with an industrial, subtle geometric dot grid (`.bg-dots`, 32px radial pattern at 10% black opacity). Surfaces are solid, crisp white (`#ffffff`) or industrial sage accent (`#b7c6c2`).
4. **Physical Button Physics**: Interactive elements deliver immediate mechanical feedback using a spring-loaded press timing function (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`), translating downward/rightward on `:hover` and `:active` while depressing the hard offset shadow.
5. **No Blur or Glassmorphism**: Frosted glass (`backdrop-blur`), translucent overlays, and diffuse glowing shadows are strictly prohibited. Modals and drawers use solid dimming backdrops (`rgba(0, 0, 0, 0.60)`).
6. **No Gradients**: All backgrounds, fills, and headers are 100% solid, flat colors.
7. **Tables Over Cards**: Wherever tabular or structured administrative records exist (students, applicants, meal logs, refund ledgers, complaints, machines, maintenance schedules), render high-density TanStack Tables. Card grids are never used as a substitute for structured data tables.
8. **Zero Emoji Icons**: Emojis are strictly banned from UI labels, headers, and buttons. All iconography is rendered via Lucide SVG icons (stroke width `1.75px` to `2.5px`).
9. **Timezone & Formatting Standards**: All dates, audit timestamps, countdowns, and operational meal windows are strictly displayed in Indian Standard Time (IST, UTC+05:30). Currency is formatted in Indian Rupees (₹ INR). Tabular numbers (`tabular-nums`) are enforced on all counts, ranks, roll numbers, and dates.

---

## 2. Design Tokens Reference

### 2.1 Core Palette

| Role | Hex Value | Semantic Token | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| **Canvas / Paper** | `#ffe17c` | `bg-paper` | Application canvas, dot pattern background, subtle hover fills |
| **Dark / Sidebar** | `#171e19` | `bg-navy-sidebar` | 240px persistent navigation rail, high-contrast dark sections |
| **Accent (Sage)** | `#b7c6c2` | `bg-surface-subtle` | Table sticky headers, secondary metric panels, inactive pill states |
| **Surface** | `#ffffff` | `bg-surface` | White cards, table bodies, modals, drawers, input fields |
| **Ink / Borders / Shadows** | `#000000` | `text-black`, `border-black` | All typography, 2px perimeter borders, and zero-blur offset shadows |
| **Saffron / Active / Star** | `#ffbc2e` | `bg-saffron` | Active navigation pills, selected table rows, hover accents, priority tags |

### 2.2 Semantic & Status Tokens

Status tokens preserve institutional meaning while adopting standard 2px solid black borders:

| Status | Text Color | Background Fill | Border | Usage Example |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `#059669` | `#ECFDF5` | `#000000` (2px) | Verified applicants, safe water test, online machine |
| **Warning** | `#D97706` | `#FFFBEB` | `#000000` (2px) | Pending verification, waitlisted rank, caution limit |
| **Danger** | `#DC2626` | `#FEF2F2` | `#000000` (2px) | Rejected applications, unsafe water report, out of order |
| **Neutral** | `#4B5563` | `#F3F4F6` | `#000000` (2px) | Inactive filters, metadata badges, archived logs |

### 2.3 Ink & Contrast Hierarchy

All text pairings are calibrated to exceed WCAG 2.1 AA contrast requirements (minimum 4.5:1 ratio):

| Token | CSS Variable / Value | Contrast Ratio | Context |
| :--- | :--- | :--- | :--- |
| `ink.primary` | `#000000` | > 12:1 on `#ffe17c`, 21:1 on `#ffffff` | Primary headings, table data values, high-contrast labels |
| `ink.secondary` | `#171e19` | > 10:1 on `#ffe17c`, 18:1 on `#ffffff` | Subtitles, section headers, form labels |
| `ink.muted` | `rgba(0, 0, 0, 0.65)` | > 5.5:1 on `#ffffff` | Timestamps, secondary helper descriptions |
| `ink.light` | `rgba(0, 0, 0, 0.55)` | > 4.6:1 on `#ffffff` | Placeholders, inactive meta hints |
| `ink.onDark` | `#ffffff` | 17.5:1 on `#171e19`, 21:1 on `#000000` | Text on dark sidebar, primary black buttons |

### 2.4 Hard Offset Shadow Scale

Every shadow is a zero-blur, solid `#000000` box-shadow offset diagonally:

```css
boxShadow: {
  'hard-sm': '2px 2px 0px 0px #000',   /* Filter chips, small badges, subtle buttons */
  'hard':    '4px 4px 0px 0px #000',   /* Standard cards, buttons, KPI strips, tables */
  'hard-lg': '8px 8px 0px 0px #000',   /* Modal dialogs, login cards, feature headers */
  'hard-xl': '12px 12px 0px 0px #000', /* Command palette, drawer sheets, alert panels */
}
```

### 2.5 Borders & Geometry

- **Border Width**: `DEFAULT: '2px'` (`border` renders `border-width: 2px`). All structural borders are `2px solid #000000`. Hairline (`1px`) is reserved exclusively for interior table row dividers (`divide-black`) and compact badges.
- **Corner Radii**:
  - `rounded-[8px]`: Interactive buttons, form inputs, navigation items, dialog close triggers.
  - `rounded-[6px]`: Filter chips, status tags, badge containers.
  - `rounded-[4px]`: Content cards, table containers, popover sheets, modal shells.
  - `rounded-full`: Step indicator circles, avatar counters.

---

## 3. Typography System

### 3.1 Font Stacks

```javascript
fontFamily: {
  heading: ['"Cabinet Grotesk"', '"General Sans"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
  sans:    ['"Satoshi"', '"Inter"', 'system-ui', 'sans-serif'],
  mono:    ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
}
```

- **Headings & Hero Titles**: **Cabinet Grotesk** (Weights 400, 500, 700, 800). Page titles and prominent card headers use weight **800** with negative letter-spacing (`tracking-tight`).
- **Body, UI & Forms**: **Satoshi** (Weights 400, 500, 700). Default body text is set to weight **500** for strong optical contrast against yellow and white surfaces.
- **Numbers, Codes, Times & Identifiers**: **IBM Plex Mono** with `tabular-nums` (`font-variant-numeric: tabular-nums`). Enforced on all roll numbers, merit ranks, currency amounts, and IST timestamps.
- **Font Delivery**: Primary fonts are loaded via Fontshare CDN in `web/index.html`. Offline fallbacks (`@fontsource/space-grotesk` and `@fontsource/inter`) are locally bundled via npm.

---

## 4. Component Standards

### 4.1 Button Physics & Variants

All buttons feature 2px black borders, `rounded-[8px]`, `font-heading font-bold`, and the custom spring transition:
`transition-[transform,box-shadow,background-color] duration-150 ease-press` (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`).

- **Primary**: Solid black fill (`bg-black text-white`). Size `md`/`lg` starts with `shadow-hard-lg`, moves `translate-x-1 translate-y-1 shadow-hard` on hover, and active presses to `shadow-hard`. Size `sm` uses `shadow-hard` shifting `translate-x-[2px] translate-y-[2px] shadow-hard-sm`.
- **Secondary / Outline**: Crisp white fill (`bg-white text-black shadow-hard`). On hover/active: shifts `translate-x-[2px] translate-y-[2px] shadow-hard-sm` and highlights with `hover:bg-saffron`.
- **Saffron**: Accent saffron fill (`bg-saffron text-black shadow-hard`). Shifts downward on press with tactile spring return.
- **Destructive**: Alert red fill (`bg-status-danger-text text-white shadow-hard`). Shifts on hover and click for critical irreversible actions.
- **Subtle**: Transparent fill with 2px black border, highlighting to `bg-saffron` on hover.

### 4.2 Data Tables (TanStack Table v8)

- **Container**: White background (`bg-white`), 2px solid black border (`border-2 border-black`), `rounded-[4px]`, hard offset shadow (`shadow-hard`).
- **Sticky Header**: 40px height (`h-10`), solid sage background (`bg-surface-subtle`), 2px solid black bottom divider (`border-b-2 border-black`), uppercase heavy typography (`font-heading font-extrabold text-xs tracking-wider text-black`).
- **Rows**: 44px height (`h-11`), divided by 1px solid black borders (`divide-black`). Hover state fills with warm paper yellow (`hover:bg-paper`). Selected rows illuminate in saffron (`bg-saffron`).
- **Pagination**: Integrated bottom toolbar with total record counts, page size selection, and numeric pagination buttons with `shadow-hard-sm` on active page.

### 4.3 Form Controls (Input & Select)

- **Surfaces**: Solid white (`bg-white`), 2px black border (`border-2 border-black`), `rounded-[8px]`, 36px standard height (`h-9`), font size 14px (16px on mobile to prevent viewport zoom).
- **Focus State**: Focused controls produce a sharp offset shadow (`focus:shadow-hard focus:border-black`) without diffuse rings.
- **Error State**: Displays `border-status-danger-text focus:border-status-danger-text`, accompanied by a 14px Lucide `AlertCircle` and bold error text below.
- **Disabled State**: Solid sage fill (`bg-surface-subtle text-black cursor-not-allowed opacity-60`).

### 4.4 Status Badges (`StatusTag`)

- **Shape**: Compact rectangular pill (`rounded-[6px]`), 2px solid black border (`border-2 border-black`), heavy font (`font-bold tabular-nums text-xs sm:text-[11px]`).
- **Variants**: Standardized semantic pairings (`bg-status-success-bg text-status-success-text`, `bg-status-warning-bg text-status-warning-text`, `bg-status-danger-bg text-status-danger-text`, `bg-saffron text-black`).

### 4.5 Modals & Slide-Over Drawers

- **Backdrop**: Solid dimming overlay (`bg-black/60`), zero glassmorphism, zero blur.
- **Card**: Solid white surface, 2px solid black perimeter, `shadow-hard-lg` (modals) or `shadow-hard-xl` (drawers), `rounded-[4px]`.
- **Header**: Divided by 2px black bottom border (`border-b-2 border-black`), featuring high-contrast icon container and 24px close button (`hover:bg-saffron border-2 border-black rounded-[8px]`).

---

## 5. Accessibility & Motion Guidelines

1. **3px High-Contrast Focus Ring**: All keyboard-focusable elements receive a universal 3px solid black outline with 2px offset:
   ```css
   *:focus-visible {
     outline: 3px solid #000000;
     outline-offset: 2px;
   }
   ```
2. **Motion Reduction**: Full compliance with `@media (prefers-reduced-motion: reduce)`. All animations, pulse loaders, and transform transitions collapse to instant zero-duration execution.
3. **High Contrast Ratios**: All text elements satisfy WCAG 2.1 AA standards (4.5:1 for body copy, 3:1 for large headings) across both canvas yellow, sage containers, and white surfaces.
