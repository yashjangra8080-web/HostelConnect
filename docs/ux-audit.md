# HostelConnect — Comprehensive UX & Dead-Control Audit

**Date:** 03 November 2026  
**Auditor:** Antigravity Pairing Agent  
**Environment:** Windows (PowerShell), Chromium (Puppeteer), Node 20+, MySQL 8.0  
**Scope:** All 7 System Roles (`STUDENT`, `HOSTEL_OFFICE`, `CHIEF_WARDEN`, `WARDEN`, `MESS_MANAGER`, `CARETAKER`, `ADMIN`) across all screens, controls, navigation links, filters, modals, and actions.

---

## 1. Executive Summary

Every interactive control across the HostelConnect platform was systematically clicked, tested, and audited for functionality, responsiveness, keyboard accessibility, and adherence to the institutional design system (tokens only, no gradients, no glass/blur, zero emoji icons, tables-first layout, strict IST timezone).

Non-functional placeholders, dead click targets, and unhandled states were resolved in place. Irreversible actions now trigger accessible `<ConfirmDialog>` modals with explicit warnings and loading spinners instead of raw browser prompts.

---

## 2. Exhaustive Control-by-Control Audit Table

| Screen / View | Role(s) | Control / Element | Expected Behavior | Observed Result | Fix / Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Shell Header** | All | Notification Bell Button | Opens popover showing latest 8 notifications with unread badge | Bell clicked, opened accessible popover with unread-first sorting, relative IST time, mark all read, and view all link | **Verified Functional** |
| **Shell Header** | All | "Mark all as read" in Popover | Zeros unread badge immediately and calls `/api/notifications/read-all` | Unread badge immediately dropped to 0, backend updated | **Verified Functional** |
| **Shell Header** | All | "View all notifications" link | Navigates to `/notifications` page | Navigated to full `/notifications` ledger | **Verified Functional** |
| **Shell Header** | All | Quick Search Bar (`Ctrl K`) | Opens keyboard-accessible command palette | Shows `Ctrl K` on Windows/Linux and `⌘K` on macOS; opens command palette with quick navigation | **Verified Functional** |
| **Shell Header** | All | User Profile Menu Trigger | Opens dropdown with Profile, Change Password, Sign Out | Dropdown toggles cleanly with outside click & Esc support | **Verified Functional** |
| **Shell Header** | All | User Profile Item | Opens modal with student/authority details | Shows full name, role, login ID, roll number, and hostel assignment | **Added & Functional** |
| **Shell Header** | All | Change Password Item | Navigates to `/change-password` | Navigated to password update screen | **Verified Functional** |
| **Shell Header** | All | Sign Out Item | Clears auth session cookie and redirects to `/` | Session invalidated, redirected to login page | **Verified Functional** |
| **Shell Nav Rail** | All | Navigation Group Links | Swaps route view inside AppShell without full page reload | All navigation items route cleanly, active route highlighted with saffron border | **Verified Functional** |
| **Shell Nav Rail** | All | Mobile Hamburger Button (`< 1024px`) | Toggles slide-over navigation drawer on mobile viewports | Hamburger appears at `< 1024px`, clicking opens slide-over drawer with backdrop | **Verified Functional** |
| **Shell Nav Rail** | All | Mobile Drawer Close Button (`✕`) | Dismisses slide-over drawer | Clicking `✕` or backdrop closes drawer cleanly | **Verified Functional** |
| **Student Dashboard** | `STUDENT` | "Explore Inventory →" Button | Navigates to student allotment/rooms view | Navigated to `/student/allotment` | **Verified Functional** |
| **Student Dashboard** | `STUDENT` | "View My Attendance & Refund →" | Navigates to student dining attendance strip | Navigated to `/student/mess` | **Verified Functional** |
| **Student Dashboard** | `STUDENT` | "Check Washing Machines →" | Navigates to laundry monitor | Navigated to `/student/laundry` | **Verified Functional** |
| **Student Dashboard** | `STUDENT` | Orange Eyebrow Banner | Cluttered header above page title | Eyebrow removed; clean title, description, and status preserved | **Fixed (Removed)** |
| **Notifications Page** | All | All / Unread Filter Tabs | Filters notifications list by read state | Clicking Unread tab filters to only unread notifications; All shows complete history | **Verified Functional** |
| **Notifications Page** | All | Category Filter Dropdown | Filters notifications by notification type | Filtered by `ALLOTMENT`, `NOTICE`, `COMPLAINT`, `REFUND`, `MAINTENANCE`, `WATER`, `LAUNDRY` | **Verified Functional** |
| **Notifications Page** | All | Notification Item Link Click | Marks notification read and navigates to target link | Optimistically decrements unread badge, calls PATCH `/api/notifications/:id/read`, navigates to allowlisted target | **Verified Functional** |
| **Notifications Page** | All | Mark Read / Mark Unread Button | Toggles read status for individual notification | Read status toggles with immediate visual feedback | **Verified Functional** |
| **Notifications Page** | All | "Mark all as read" Button | Marks entire user notification inbox as read | All items updated to read, unread count reset | **Verified Functional** |
| **Notifications Page** | All | Pagination Controls | Navigates through multi-page notification list | Previous, Next, and numeric page buttons paginate cleanly | **Verified Functional** |
| **Notice Hub** | All | Notice Row Click | Opens detail drawer with full directives and deep-links url | Drawer slides open; URL updated to `/notices?open=<id>`; survives page refresh | **Verified Functional** |
| **Notice Hub** | All | Detail Drawer Close Button | Closes drawer and strips `?open=<id>` query parameter | Drawer closes, URL query param cleaned up | **Verified Functional** |
| **Notice Hub** | All | Search Input | Filters notices by keyword in title/body | Real-time query parameter filtering with debouncing | **Verified Functional** |
| **Notice Hub** | All | Category Filter Dropdown | Filters by `CIRCULAR`, `WATER_QUALITY`, `PEST_CONTROL`, `ELECTRICIAN`, `PLUMBER`, `GENERAL` | Filtered ledger immediately updates | **Verified Functional** |
| **Notice Hub** | All | "Active Only" Toggle | Filters out notices whose `ends_at` has passed | Only currently active notices displayed | **Verified Functional** |
| **Notice Hub** | All | Pagination Controls | Page through 46 realistic notices (12/page) | Correct total page count and smooth navigation | **Verified Functional** |
| **Notice Hub** | Staff | "Publish Official Circular" Button | Opens circular publishing modal | Modal opens with validation, hostel scope, date pickers, and pin toggle | **Verified Functional** |
| **Mess Attendance** | `STUDENT` | Non-Resident Student View (Dev Sethi) | Informs student that mess is for hostel residents | Replaced empty grid with explanatory `EmptyState` and link to Allotment | **Fixed & Verified** |
| **Mess Attendance** | `STUDENT` | Month Selector (`Sept`, `Oct`, `Nov 2026`) | Changes visible attendance month and dynamic header | Header dynamically updates to `Month Year — X days × 4 meals`; loads month data | **Verified Functional** |
| **Mess Attendance** | `STUDENT` | Attendance Cell Hover / Focus | Shows tooltip with date, meal, menu, window, status, check-in time | Accessible keyboard focus and tooltip display full meal breakdown | **Verified Functional** |
| **Mess Attendance** | `STUDENT` | Attendance / Ledger Tabs | Switches between attendance grid and monthly refund ledger | Seamless switching between visual calendar strip and tabular ledger | **Verified Functional** |
| **Mess Attendance** | `STUDENT` | "Enter code manually" Collapsible | Allows fallback manual token entry | Collapsed by default; expands smoothly with token input and submit action | **Verified Functional** |
| **Mess Attendance** | `STUDENT` | Refresh Mess Data Button | Refreshes student's monthly meals from API | Triggers fetch, shows loading skeleton, and repopulates grid | **Verified Functional** |
| **Mess Check-In** | `STUDENT` | Auto-Check-in URL (`/mess/check-in?t=...`) | Auto-submits dining QR token and displays outcome | Shows meal, hostel, and IST timestamp on success; plain-language error on invalid/expired | **Verified Functional** |
| **Refund Ledger** | `STUDENT` | Multi-Month History Table | Shows Sept (FINAL), Oct (PREVIEW), Nov (In progress) | Displays scheduled, eaten, missed, free skips, attendance refund, flat refund, and status | **Verified Functional** |
| **Refund Ledger** | `STUDENT` | Projected Refund Formula Panel | Spells out the calculation formula with the student's real numbers | Breakdowns formula step-by-step with en-IN currency formatting (`₹`) | **Verified Functional** |
| **Mess Manager Counter** | `MESS_MANAGER` | Counter Headcount Refresh | Updates today's meal counts against hostel residents | Headcount meters update with current turnout counts | **Verified Functional** |
| **Mess Manager Counter** | `MESS_MANAGER` | "Copy Token" Button | Copies 64-char active counter token to clipboard | Copies token and shows temporary checkmark state | **Verified Functional** |
| **Mess Manager Counter** | `MESS_MANAGER` | Student Search & Manual Mark Button | Marks manual attendance for resident via counter | Marks meal, logs audit trail, shows confirmation toast | **Verified Functional** |
| **Mess Manager Counter** | `MESS_MANAGER` | Orange Eyebrow Banner | Eyebrow above header title | Removed uppercase orange eyebrow | **Fixed (Removed)** |
| **Manager Refund Console**| `MESS_MANAGER` | "Preview Calculations" Button | Executes `sp_calculate_refunds` for current month | Calculates preview without locking rows; updates 8-bin histogram | **Verified Functional** |
| **Manager Refund Console**| `MESS_MANAGER` | "Finalize & Lock Refunds" Button | Irreversible action finalizing monthly refunds | Triggers `<ConfirmDialog>` stating resident count and total amount; locks rows immutably | **Verified Functional** |
| **Manager Refund Console**| `MESS_MANAGER` | "Export CSV" Button | Downloads CSV of monthly refunds | Generates and downloads RFC-4180 compliant CSV | **Verified Functional** |
| **Mess Config Screen** | `MESS_MANAGER` | "Save Parameters" Button | Saves fee, per-meal rate, and rebate cap | Validates input bounds, writes config, displays success toast | **Verified Functional** |
| **Mess Config Screen** | `MESS_MANAGER` | Orange Eyebrow Banner | Eyebrow above header title | Removed uppercase orange eyebrow | **Fixed (Removed)** |
| **Hostel Office Console** | `HOSTEL_OFFICE` | "Preview Dry-Run Allotment" | Simulates allotment cycle without database mutations | Opens dry-run summary modal with category, gender, and habit breakdown | **Verified Functional** |
| **Hostel Office Console** | `HOSTEL_OFFICE` | "Execute Authoritative Engine" | Executes `sp_run_allotment` for Cycle 1 | Replaced `window.confirm` with accessible `<ConfirmDialog>` with destructive badge | **Fixed & Verified** |
| **Hostel Office Console** | `HOSTEL_OFFICE` | "Publish Results to Pool" | Publishes cycle results to public pool | Replaced `window.confirm` with accessible `<ConfirmDialog>` with destructive badge | **Fixed & Verified** |
| **Hostel Office Console** | `HOSTEL_OFFICE` | Refresh Cycle Data Button | Reloads cycle status and application stats | Reloads cycle data and stepper states | **Verified Functional** |
| **Verification Queue** | `HOSTEL_OFFICE` | Status Filter Pills | Filters queue by `PENDING`, `VERIFIED`, `REJECTED` | Instant tab filter updates table rows | **Verified Functional** |
| **Verification Queue** | `HOSTEL_OFFICE` | Priority & Band Filters | Filters by distance priority (Outside Delhi vs Delhi) | Table correctly filters applicants | **Verified Functional** |
| **Verification Queue** | `HOSTEL_OFFICE` | Row Checkboxes & Batch Verify | Allows multi-select and batch approval | Selected count updates; batch verify updates statuses with toast feedback | **Verified Functional** |
| **Applicant Status** | `STUDENT` | "Accept Allotment" Button | Accepts room allotment within 7-day window | Opens confirmation modal, calls API, updates status to ACCEPTED | **Verified Functional** |
| **Applicant Status** | `STUDENT` | "Decline Allotment" Button | Declines room allotment | Opens confirmation modal, updates status to DECLINED | **Verified Functional** |
| **Applicant Status** | `STUDENT` | "Withdraw Application" Button | Withdraws application before allotment | Opens confirmation modal, updates status to WITHDRAWN | **Verified Functional** |
| **Complaints Inbox** | Staff | Complaint Row Click | Opens complaint detail drawer with reply thread | Drawer displays thread, audit logs, and status transition select | **Verified Functional** |
| **Complaints Inbox** | Staff | Status Transition Select | Advances status: `OPEN` → `SEEN` → `IN_PROGRESS` → `RESOLVED` / `REJECTED` | Trigger enforces valid state machine; invalid transitions rejected with 422 | **Verified Functional** |
| **Complaints Inbox** | Staff | "Post Response" Button | Adds official staff response to complaint thread | Inserts response, notifies student, updates thread | **Verified Functional** |
| **Smart Laundry** | All | Machine Card "Start Wash" | Initiates 45-minute washing cycle | Uses pessimistic row locking (`FOR UPDATE`); updates timer and busy indicator | **Verified Functional** |
| **Smart Laundry** | All | "Finish Wash Early" Button | Releases machine before 45-minute timer expires | Resets machine status to `FREE` | **Verified Functional** |
| **Smart Laundry** | Caretaker | "Mark Out of Order" Button | Sets machine to `OUT_OF_ORDER` for maintenance | Machine locked out; displays warning badge | **Verified Functional** |
| **Water Quality** | All | Hostel Selector | Filters water test records by hostel | Table updates to selected hostel's weekly tests | **Verified Functional** |
| **Water Quality** | Caretaker/Warden | "Add Test Report" Modal | Submits weekly TDS, pH, and chlorine readings | Validates values; trigger automatically sets `SAFE` or `UNSAFE` status | **Verified Functional** |
| **Maintenance** | All | Category Filter | Filters maintenance jobs by category | Filter updates list | **Verified Functional** |
| **Maintenance** | Caretaker | "Add Maintenance Entry" Modal | Logs contractor or facility maintenance request | Creates entry with scheduled date and status | **Verified Functional** |
| **Admin Privilege Proof** | `ADMIN` | Role Accordion Click | Expands `SHOW GRANTS` output for selected database role | Displays authenticated grants for `hc_admin`, `hc_warden`, `hc_student`, etc. | **Verified Functional** |
| **Admin Privilege Proof** | `ADMIN` | Refresh Privilege Proof Button | Queries live database grants again | Re-runs grants verification and updates timestamp | **Verified Functional** |

---

## 3. Responsive Breakpoint Verification

All screens and navigation flows were tested across four standard viewports:
1. **1440px (Wide Desktop):**
   - Full 240px sidebar navigation pinned.
   - Max-width content containers (`max-w-6xl` / `max-w-7xl`) centered with balanced margins.
   - Zero horizontal overflow.
2. **1280px (Standard Desktop):**
   - Clean tabular views with internal horizontal scroll on data tables.
   - Topbar search with `Ctrl K` badge and notifications popover aligned to right bell icon.
3. **768px (Tablet):**
   - Left navigation automatically collapses into slide-over drawer triggered by hamburger button.
   - Tables scroll horizontally within their respective cards (`overflow-x-auto`).
   - Skeletons and empty states maintain proper padding.
4. **390px (Mobile Portrait — iPhone 12/13/14):**
   - Full slide-over navigation with touch-friendly targets (minimum 44px tap targets).
   - Notification popover sizes to fit mobile viewport width without clipping.
   - Student Mess Attendance calendar strip scrolls smoothly with sticky meal labels (`Breakfast`, `Lunch`, `Snacks`, `Dinner`).
   - Page-level horizontal scroll completely eliminated (`overflow-x-hidden`).

---

## 4. Accessibility & Polish Compliance

- **Contrast:** All text satisfies WCAG 2.1 AA standards (minimum 4.5:1 for body text, 3:1 for large headers and status tags).
- **Tabular Numerals:** All financial figures, dates, times, percentages, and counters use `tabular-nums` (`font-variant-numeric: tabular-nums`).
- **Date & Currency Formatting:** Strict en-IN number formatting (`₹1,23,456.00`) and IST date formatting (`02 Nov 2026, 13:45 IST`).
- **Focus Indicators:** Interactive buttons, inputs, links, and grid cells display visible focus rings (`focus:ring-2 focus:ring-primary focus:outline-none`).
- **Reduced Motion:** Animations respect user preference via Tailwind's `motion-safe` utilities.
