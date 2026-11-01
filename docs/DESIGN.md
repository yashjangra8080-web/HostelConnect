# HostelConnect Design System Specification
**Netaji Subhas University of Technology (NSUT), Dwarka, New Delhi**

---

## 1. Design Philosophy & Constraints

HostelConnect is an enterprise-grade university hostel management platform for NSUT Dwarka. The interface adheres strictly to institutional dignity, administrative clarity, high data density, and accessibility.

### Strict Core Principles
1. **Tokens Only**: All styles must derive directly from semantic CSS variables / Tailwind tokens defined below. No arbitrary or hardcoded hex/RGB values in components.
2. **No Gradients**: All backgrounds and buttons are solid, flat institutional colors. Gradients are prohibited.
3. **No Glassmorphism or Blur**: No `backdrop-blur`, semi-transparent frosted glass, or diffuse glowing shadows. Surfaces are crisp, solid `#FFFFFF` or subtle neutral containers.
4. **Tables Over Cards**: Wherever structured or tabular records exist (students, applicants, meals, refunds, complaints, laundry machines, maintenance logs), render high-density TanStack Tables with column sorting, filtering, and pagination. Card grids are strictly forbidden where a table fits.
5. **Zero Emoji Icons**: No emojis anywhere in the UI. All icons are rendered via self-hosted Lucide SVG icons with a uniform `1.75px` stroke and semantic color tint containers.
6. **Timezone**: All dates, timestamps, countdowns, and audit logs are strictly displayed in Indian Standard Time (IST, UTC+05:30).

---

## 2. Institutional Color Palette & Tokens

### 2.1 Brand & Layout Structure
| Token Name | Hex Value | Purpose / Usage |
| :--- | :--- | :--- |
| `--sidebar-bg` | `#0C2054` | Primary 240px navigation sidebar background (Authoritative NSUT Dark Navy) |
| `--sidebar-active` | `#1E3A8A` | Active navigation item background pill |
| `--sidebar-hover` | `rgba(255, 255, 255, 0.08)` | Hover state for inactive navigation items |
| `--primary` | `#2F5BD6` | Primary action buttons, active tab indicators, key focus highlights |
| `--primary-hover` | `#1B43A6` | Hover state for primary buttons |
| `--primary-subtle` | `#EEF2FF` | Contextual badge background, light selection tint, icon containers |
| `--topbar-bg` | `#FFFFFF` | 64px persistent top navigation header bar |
| `--bg` | `#F4F6FB` | Institutional application canvas background |
| `--bg-surface` | `#FFFFFF` | Card surfaces, modal sheets, table container wrapper |
| `--bg-subtle` | `#F8FAFC` | Secondary panel backgrounds, alternating table rows, disabled fills |
| `--border` | `#E2E8F0` | Default border color for tables, cards, inputs, and dividers |
| `--border-strong` | `#CBD5E1` | Focused or emphasized borders |

### 2.2 Semantic & Status Tokens
| State | Text / Icon | Background Tint | Border |
| :--- | :--- | :--- | :--- |
| **Success** | `#059669` | `#ECFDF5` | `#A7F3D0` |
| **Warning** | `#D97706` | `#FFFBEB` | `#FDE68A` |
| **Danger** | `#DC2626` | `#FEF2F2` | `#FECACA` |
| **Neutral** | `#4B5563` | `#F3F4F6` | `#E5E7EB` |

### 2.3 Text & Ink Hierarchy
| Token Name | Hex Value | Purpose / Usage |
| :--- | :--- | :--- |
| `--text-primary` | `#0F172A` | Primary headings, titles, table data values, high-contrast labels |
| `--text-secondary` | `#475569` | Subtitles, table column headers, helper notes |
| `--text-muted` | `#64748B` | Timestamps, placeholders, inactive meta information |
| `--text-on-dark` | `#FFFFFF` | Text rendered on dark navy sidebar or primary button fills |

---

## 3. Typography System

Typography balances institutional gravitas with high information density.

### 3.1 Font Families
- **Headings & Brand**: `Plus Jakarta Sans`, sans-serif (Weights: 600 SemiBold, 700 Bold, 800 ExtraBold)
- **Interface, Forms & Data Tables**: `Inter`, system-ui, sans-serif (Weights: 400 Regular, 500 Medium, 600 SemiBold)
- **Code, Identifiers & Numerals**: `JetBrains Mono`, monospace (Weight: 500 Medium)

### 3.2 Type Scale
- `text-xs`: `0.75rem` (12px), Line height: `1.4` (Helper labels, uppercase badge labels)
- `text-sm`: `0.8125rem` (13px), Line height: `1.45` (Table secondary meta, compact rows)
- `text-base`: `0.875rem` (14px), Line height: `1.5` (Standard dense UI body text, table cells)
- `text-input`: `1.0rem` (16px), Line height: `1.5` (Inputs, preventing unwanted mobile zoom)
- `text-lg`: `1.125rem` (18px), Line height: `1.35` (Modal headings, card panel titles)
- `text-xl`: `1.25rem` (20px), Line height: `1.3` (Sub-section headers)
- `text-2xl`: `1.5rem` (24px), Line height: `1.25` (Page primary title)

### 3.3 Numeric & Value Formatting
- **Tabular Numerals**: Apply `font-variant-numeric: tabular-nums` to all numbers, ranks, counts, and rupee amounts.
- **Currency**: Format INR using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` (e.g. `₹1,640.00`).
- **Dates & Times**: Strict `Asia/Kolkata` IST format (e.g. `01 Nov 2026, 07:30 PM`).

---

## 4. Component Standards

### 4.1 Tables (TanStack Table)
- **Container**: Solid white background (`--bg-surface`), 1px solid border (`--border`), subtle shadow, 8px border-radius.
- **Header**: 40px height, background `--bg-subtle`, text `--text-secondary`, font weight 600, text size `12px` uppercase tracking.
- **Rows**: Dense 44px height, borders between rows `1px solid var(--border)`. Hover state: background `rgba(47, 91, 214, 0.04)`.
- **Pagination & Controls**: Bottom toolbar displaying total records count, current page range, page-size dropdown (10, 25, 50, 100), and previous/next page buttons.
- **Sorting**: Clickable column headers showing ascending/descending directional indicator icon.

### 4.2 Buttons & Controls
- **Primary**: Background `--primary`, text `--text-on-dark`, hover `--primary-hover`, 6px border-radius, font-weight 500, no drop shadows.
- **Secondary / Outline**: Background transparent or `--bg-surface`, border `1px solid var(--border)`, text `--text-primary`, hover `--bg-subtle`.
- **Destructive**: Background `--danger`, text `--text-on-dark`, hover opacity 0.9.
- **Focus Rings**: `box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px var(--primary)`.

### 4.3 Status Badges & Pills
- Pill shape: 9999px border-radius, font size `11px` or `12px`, font-weight 600, padding `2px 8px`.
- Renders with corresponding semantic text color, background tint, and 1px border.

### 4.4 Iconography
- Self-hosted Lucide icons with `stroke-width="1.75"`.
- Never use emojis in labels, headers, or buttons.
