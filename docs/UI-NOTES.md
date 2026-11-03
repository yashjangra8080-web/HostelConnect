# HostelConnect UI Architecture & Component Guidelines
**Netaji Subhas University of Technology (NSUT), Sector 3, Dwarka, New Delhi**

---

## 1. Neo-Brutalist Layout Patterns & Architectural Canvas

HostelConnect employs a physical, high-contrast Neo-Brutalist layout architecture designed for operational speed, high information density, and unambiguous visual hierarchy.

### 1.1 Canvas & Spatial Rhythm
* **Dot-Grid Yellow Canvas**: The global background (`body.bg-dots`) uses `#ffe17c` textured with a 32px radial grid of 1.5px black dots at 10% opacity:
  ```css
  .bg-dots {
    background-color: #ffe17c;
    background-image: radial-gradient(circle, rgba(0, 0, 0, 0.10) 1.5px, transparent 1.5px);
    background-size: 32px 32px;
  }
  ```
* **Band-Based Landing Structure**: Public and login interfaces use 3-band rhythm:
  1. Top utility canvas band with dot pattern and institutional banner.
  2. Main white card section with 8px hard offset shadow (`shadow-hard-lg`).
  3. Solid dark industrial footer band (`#171e19`) anchoring copyright and official NSUT links.
* **Surface Containers**: Application panels, data grids, and modals sit directly on the dot canvas as solid white (`#ffffff`) or sage (`#b7c6c2`) containers with crisp 2px solid black borders.

---

## 2. Card Container Standards

Every card container across HostelConnect adheres to uniform physical specifications:

1. **Border Geometry**: `border-2 border-black` (2px solid pure black `#000000`).
2. **Corner Radius**: `rounded-[4px]` for container panels and data cards; `rounded-[8px]` for actionable cards and interactive items.
3. **Offset Shadows**: Zero blur, solid black offset shadows:
   - `shadow-hard` (4px offset): Standard dashboards, telemetry cards, laundry machine units, and complaint threads.
   - `shadow-hard-lg` (8px offset): Login cards, allotment breakdown modals, verification detail drawers.
   - `shadow-hard-xl` (12px offset): Command palette, full-screen notification panels, complex refund consoles.
4. **Internal Dividers**: Interior card divisions (header strips, summary footers) use `border-b-2 border-black` or `border-t-2 border-black`.

---

## 3. Persistent Shell & Navigation Conventions

The authenticated application shell consists of a 240px persistent left navigation rail and a 64px persistent top bar.

### 3.1 240px Left Navigation Rail (`#171e19`)
* **Background**: Solid dark charcoal (`bg-navy-sidebar` / `#171e19`).
* **Header**: Institutional mark with saffron square logo (`bg-saffron text-black border-2 border-black`) and Cabinet Grotesk title.
* **Role Ribbon**: High-contrast role indicator badge (`bg-surface-subtle text-black border-2 border-black`).
* **Navigation Links**:
  - **Active State**: Bright saffron pill (`bg-saffron text-black border-2 border-black shadow-hard font-heading font-bold`).
  - **Inactive State**: White text (`text-white`) with transparent border, highlighting to industrial sage (`hover:bg-surface-subtle hover:text-black`) on mouseover.
* **Sidebar Footer**: Real-time Indian Standard Time (IST, UTC+05:30) digital clock updating every 1000ms.

### 3.2 64px Persistent Topbar (`#ffffff`)
* **Background**: Solid white (`bg-white border-b-2 border-black`).
* **Command Palette Launcher**: Global search button displaying platform-aware shortcut pill (`Ctrl K` on Windows/Linux, `⌘K` on macOS) with 2px solid black border.
* **Notification Bell**:
  - Interactive button with `rounded-[8px]`, `border-2 border-black`, and `shadow-hard-sm`.
  - Unread badge: High-visibility pill (`bg-saffron text-black border border-black rounded-full font-bold tabular-nums`) displaying count, capped at `9+`.
  - Polling interval: Synchronizes every 30 seconds with `/api/notifications/count`.
* **User Profile Menu**: High-contrast dropdown trigger with user full name, roll number / login ID, and persona badge.

---

## 4. Form Control Styling Standards

Forms prioritize tactile feedback and mobile input safety:

### 4.1 Inputs & Select Dropdowns
* **Dimensions**: 36px standard height (`h-9`), `rounded-[8px]`, 2px solid black border.
* **Typography**: Satoshi 14px (`text-sm`) on desktop; 16px (`text-base sm:text-sm`) on mobile to prevent iOS/Android automatic zoom.
* **Focus State**: `focus:shadow-hard focus:border-black focus:outline-none` (creates instantaneous 4px diagonal black shadow).
* **Validation States**:
  - Danger error: `border-status-danger-text focus:border-status-danger-text`, accompanied by a 14px red `AlertCircle` icon and bold error message below.
  - Disabled: `bg-surface-subtle text-black cursor-not-allowed opacity-60`.

### 4.2 Buttons
* **Spring Easing**: `ease-press` (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`).
* **Button Heights**: `sm: 32px (h-8)`, `md: 36px (h-9)`, `lg: 40px (h-10)`.
* **Mechanical Press**: Clicking translates the button 2px (sm) or 4px (md/lg) diagonally while depressing the offset shadow (`active:translate-x-[2px] active:translate-y-[2px] active:shadow-hard-sm`).

---

## 5. Component Density & Table Conventions

Tabular records are central to administrative operations at NSUT:

* **TanStack Data Tables**:
  - Sticky header with solid sage background (`bg-surface-subtle`), 40px height (`h-10`), and 2px solid black divider.
  - Table rows maintain 44px height (`h-11`) with 1px black horizontal borders (`divide-black`).
  - Row hover state illuminates in warm paper yellow (`hover:bg-paper`).
  - Row selection highlights in saffron (`bg-saffron`).
* **KPI Metric Strips**:
  - Multi-column grid of white cards with 2px borders and `shadow-hard`.
  - Numeric values formatted with IBM Plex Mono and `tabular-nums`.
  - Category icons housed in 32px yellow containers (`bg-paper border-2 border-black`).

---

## 6. Mobile Responsiveness Guidelines (390px to 1280px+)

1. **Collapsible Navigation Rail**:
   - On screens below 1024px (`lg`), the 240px sidebar transforms into a slide-over drawer triggered by a topbar hamburger button.
   - Dismissible via backdrop tap, top close button, or keyboard `Escape`.
2. **Horizontal Table Overflow**:
   - All tables are wrapped in an `overflow-x-auto` viewport container.
   - Headers remain sticky during vertical scrolling, and columns retain minimum widths to prevent squishing on 390px mobile viewports.
3. **Responsive Grid Breakpoints**:
   - Dashboard KPI metrics scale from single-column on `<640px` (`grid-cols-1`) to 2-column on tablet (`sm:grid-cols-2`) and 4-column on desktop (`lg:grid-cols-4`).
4. **Modal & Drawer Sizing**:
   - Modal dialogs clamp to `w-full max-w-md` or `max-w-2xl` with 16px minimum screen margins on mobile devices.
