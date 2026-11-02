# HostelConnect Design System & UI Component Documentation
**Netaji Subhas University of Technology (NSUT), Sector 3, Dwarka, New Delhi**

---

## 1. Design System Overview & Architectural Tokens

HostelConnect adheres strictly to institutional dignity, data density, and administrative clarity. The interface prohibits gradients, decorative drop shadows, emoji icons, and translucent glassmorphism.

### 1.1 Strict Constraints
* **Solid Surfaces**: Flat white panels (`#FFFFFF`) with 1px hairline borders (`#E2E8F0`).
* **Zero Gradients**: Solid institutional colors derived from semantic tokens.
* **Zero Blur / Glassmorphism**: Solid color backdrops (`rgba(15, 23, 42, 0.5)`).
* **Zero Emoji Icons**: 100% self-hosted Lucide SVG icons with a uniform stroke width of `1.75px` constrained to **16px** (`w-4 h-4`).
* **Tabular Numerals**: `font-variant-numeric: tabular-nums` (`.tabular-nums`) applied to all numerical data, currency amounts (₹ INR), dates, roll numbers, and counts.
* **Timezone Standard**: Displayed strictly in Indian Standard Time (IST, UTC+05:30).
* **Accessibility**: Respects `prefers-reduced-motion` to disable animations and loading pulses; ensures WCAG 2.1 AA contrast ratios (minimum 4.5:1).

### 1.2 Color Token Reference
| Semantic Token | Value | Tailwind Class | Institutional Purpose |
| :--- | :--- | :--- | :--- |
| `canvas-bg` | `#F4F6FB` | `bg-paper` | Application background canvas |
| `surface` | `#FFFFFF` | `bg-surface` | Card panels, table wrappers, dialog sheets |
| `surface-subtle`| `#F8FAFC` | `bg-surface-subtle` | Table header background, alternating rows |
| `border` | `#E2E8F0` | `border-border` | Hairline perimeter dividers and borders |
| `border-strong` | `#CBD5E1` | `border-border-strong` | Focused inputs, emphasized outlines |
| `navy-sidebar` | `#0C2054` | `bg-navy-sidebar` | 240px persistent navigation rail |
| `navy-active` | `#1E3A8A` | `bg-navy-active` | Active navigation pill |
| `primary` | `#2F5BD6` | `bg-primary` | Primary buttons, active tabs, action highlights |
| `primary-hover` | `#1B43A6` | `hover:bg-primary-hover`| Hover state for primary buttons |
| `primary-subtle`| `#EEF2FF` | `bg-primary-subtle` | Selection tint, contextual container tint |
| **ONE Saffron Accent** | `#D95D0F` | `bg-saffron`, `text-saffron` | Institutional seal, priority tag, active nav border |
| `saffron-subtle`| `#FFF7ED` | `bg-saffron-subtle` | Saffron badge background tint |
| `status-success`| `#059669` / `#ECFDF5` | `text-status-success-text` | Verified applications, safe water, online status |
| `status-warning`| `#D97706` / `#FFFBEB` | `text-status-warning-text` | Waitlisted candidates, pending actions |
| `status-danger` | `#DC2626` / `#FEF2F2` | `text-status-danger-text` | Rejected applications, locked accounts, errors |
| `status-neutral`| `#4B5563` / `#F3F4F6` | `text-status-neutral-text` | Metadata, archived records, inactive items |

### 1.3 Self-Hosted Typography
All font files are bundled locally into `dist/assets/` via `@fontsource`:
* **Wordmark & Headings**: `Source Serif 4` (Weights: 400, 600, 700)
* **Interface, Body & Forms**: `IBM Plex Sans` (Weights: 400, 500, 600, 700)
* **Identifiers & Numerals**: `IBM Plex Mono` (Weights: 400, 500, 600) with `tabular-nums`

---

## 2. Component Specifications & Props

All components are located in `web/src/components/ui/`.

### 2.1 `Button`
Flat, institutional action button supporting loading states, icons, and focus rings.

```typescript
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'subtle' | 'saffron';
  size?: 'sm' | 'md' | 'lg'; // sm: 32px, md: 36px, lg: 40px
  isLoading?: boolean;       // Displays 16px Loader2 spinner, disables button
  leftIcon?: React.ReactNode;// Strictly 16px Lucide icon
  rightIcon?: React.ReactNode;
}
```

### 2.2 `Input`
Accessible form input with optional labels, helper text, error messages, and icon slots.

```typescript
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;            // Text label above input
  error?: string;            // Danger alert message below input, turns border red
  helperText?: string;       // Secondary description text below input
  leftIcon?: React.ReactNode;// 16px icon (e.g. Search, User, Lock)
  rightIcon?: React.ReactNode;
  isLoading?: boolean;       // Displays right spinner
  tabularNums?: boolean;     // Enforces font-variant-numeric: tabular-nums
}
```

### 2.3 `Select`
Standardized hairline select dropdown with chevron icon and validation states.

```typescript
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  leftIcon?: React.ReactNode;
}
```

### 2.4 `Checkbox`
Hairline institutional checkbox supporting checked, unchecked, and indeterminate states.

```typescript
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  helperText?: string;
  indeterminate?: boolean;  // Renders 12px Minus icon
}
```

### 2.5 `StatusTag`
Pill-shaped badge (`rounded-full`) rendering semantic colors, 1px borders, and text.

```typescript
export interface StatusTagProps {
  status: 'success' | 'warning' | 'danger' | 'neutral' | 'saffron' | 'primary';
  label: React.ReactNode;
  icon?: React.ReactNode;   // 16px icon slot
  size?: 'sm' | 'md';       // sm: 11px text, md: 12px text
  className?: string;
}
```

### 2.6 `DataTable` (TanStack Table v8)
High-density data grid featuring sticky headers, server-side sorting, row selection, and keyboard focus.

```typescript
export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData, index: number) => string;
}
```

### 2.7 `Pagination`
Toolbar with total record counts, page size selector (10, 25, 50, 100), range indicator, and navigation buttons.

```typescript
export interface PaginationProps {
  page: number;             // 1-based index
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];// Defaults: [10, 25, 50, 100]
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
}
```

### 2.8 `FilterBar` & `useUrlFilters`
Query filter bar with instant search input, active filter chips, and bidirectional URL parameter synchronization.

```typescript
export interface FilterChip {
  key: string;
  label: string;
  value: string;
  displayValue?: string;
}

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeChips: FilterChip[];
  onRemoveChip: (key: string) => void;
  onClearAll: () => void;
  children?: React.ReactNode;
}
```

### 2.9 `Drawer`
Right-side slide-over panel with solid dim backdrop (no blur), hairline left border, header, scrollable body, and ESC dismissal.

```typescript
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;           // Defaults: 'max-w-md'
}
```

### 2.10 `Tabs`
Underline (`line`) or enclosed (`pill`) tab navigation with badge counts and left/right arrow key navigation.

```typescript
export interface TabItem {
  id: string;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'line' | 'pill';
}
```

### 2.11 `Toast` (`ToastProvider`, `useToast`)
Auto-dismissing alert notifications with hairline borders, semantic icons, and stacked corner positioning.

```typescript
export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description?: string;
  duration?: number;        // Default: 4000ms
}
```

### 2.12 `Skeleton`
Subtle loading placeholder respecting `prefers-reduced-motion`.

```typescript
export interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect' | 'button' | 'row';
  width?: string | number;
  height?: string | number;
  count?: number;
}
```

### 2.13 `EmptyState`
Flat centered state container with 16px neutral icon, title, description, and action button.

```typescript
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}
```

### 2.14 `ErrorState`
Hairline red-bordered alert box with 16px alert icon, message, and retry button.

```typescript
export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}
```

### 2.15 `KPIStrip`
Flat horizontal metric strip separated strictly by hairline vertical dividers (**not a card grid**).

```typescript
export interface KPIItem {
  id: string;
  label: string;
  value: string | number;   // Formatted with tabular-nums
  subtext?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

export interface KPIStripProps {
  items: KPIItem[];
}
```

### 2.16 `Stepper`
Workflow progress tracker with numbered and completed checkmark circles, hairline connector bars, and interactive steps.

```typescript
export interface StepItem {
  id: string | number;
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number;      // 0-based index
  onStepClick?: (stepIndex: number) => void;
}
```

### 2.17 `ConfirmDialog`
Modal dialog with solid backdrop, informative/destructive styles, cancel and confirm actions, and keyboard ESC trap.

```typescript
export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}
```

### 2.18 `CommandPalette` (`Ctrl+K`)
Global search palette with debounced queries to `/api/search?q=`, arrow key navigation, Enter selection, and ESC dismissal.

```typescript
export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult?: (result: CommandPaletteResult) => void;
}
```

---

## 3. App Shell & Route Guards

### 3.1 240px Left Navigation Rail
* Displays institutional seal with Saffron accent (`#D95D0F`) and Source Serif 4 wordmark.
* Dynamic navigation groups loaded from `GET /api/nav` based on the authenticated session's role (`ADMIN`, `HOSTEL_OFFICE`, `CHIEF_WARDEN`, `WARDEN`, `MESS_MANAGER`, `CARETAKER`, `STUDENT`).
* Active links marked with navy highlight (`#1E3A8A`) and 2px Saffron left border indicator.
* Bottom panel includes live IST clock updating every second.

### 3.2 64px Top Bar
* Quick search input triggering the `CommandPalette` (`Ctrl+K`).
* Notification bell with unread count badge queried from `GET /api/notifications/count` opening a sliding right drawer.
* User menu dropdown with user role badge, change password shortcut, and logout action.

### 3.3 Route Protection Flow
1. **Unauthenticated** $\rightarrow$ Forced redirect to `/login`.
2. **`must_change_password: true`** $\rightarrow$ Forced redirect to `/change-password` before any application route can be reached.
3. **Role mismatch** $\rightarrow$ Access denied; redirect to user's permitted dashboard.
