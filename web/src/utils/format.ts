/**
 * Common formatting and routing utilities for HostelConnect UI
 * Strictly adheres to docs/DESIGN.md & docs/UI-NOTES.md:
 * - IST timezone (+05:30)
 * - Tabular numbers
 * - en-IN currency
 * - Relative time formatting
 */

/**
 * Formats a date string into Indian Standard Time (IST) display: e.g. "02 Nov 2026"
 */
export function formatDateIST(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

/**
 * Formats a date string into IST with time: e.g. "02 Nov 2026, 09:30 AM"
 */
export function formatDateTimeIST(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

/**
 * Relative time in IST (e.g. 'just now', '15 m ago', '2 h ago', '3 d ago', or '12 Oct')
 */
export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} d ago`;

  return formatDateIST(date);
}

/**
 * Formats numbers in Indian Lakhs/Crores notation (e.g. ₹1,23,456.00)
 */
export function formatCurrencyINR(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num)) return '₹0.00';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Allowlist of permissible relative internal application routes.
 * Blocks any external, protocol-relative, javascript:, or untrusted URLs.
 */
export const ALLOWED_INTERNAL_ROUTES = [
  '/student/allotment',
  '/student/apply',
  '/student/complaints',
  '/student/laundry',
  '/student/mess',
  '/student/notices',
  '/student/refunds',
  '/student',
  '/allotment',
  '/apply',
  '/office/applications',
  '/office/ranking',
  '/office/allotment-run',
  '/office/rooms',
  '/office/residents',
  '/office/notices',
  '/office',
  '/admin/applications',
  '/admin/allotment-cycles',
  '/admin/rooms',
  '/admin/residents',
  '/admin/notices',
  '/admin/water-quality',
  '/admin/maintenance',
  '/admin/privilege-proof',
  '/admin',
  '/chief-warden/complaints',
  '/chief-warden/water-quality',
  '/chief-warden/notices',
  '/chief-warden',
  '/warden/rooms',
  '/warden/residents',
  '/warden/complaints',
  '/warden/notices',
  '/warden/maintenance',
  '/warden/mess',
  '/warden',
  '/caretaker/rooms',
  '/caretaker/laundry',
  '/caretaker/maintenance',
  '/caretaker',
  '/mess/attendance',
  '/mess/counter',
  '/mess/check-in',
  '/mess/refunds',
  '/mess/config',
  '/mess',
  '/transparency',
  '/pool',
  '/verify',
  '/rooms',
  '/residents',
  '/complaints',
  '/notices',
  '/water-quality',
  '/maintenance',
  '/laundry',
  '/notifications',
  '/change-password',
  '/',
];

/**
 * Validates whether a target link string is safe and matches the allowed internal route hierarchy.
 */
export function isAllowedInAppRoute(link: string | null | undefined): boolean {
  if (!link || typeof link !== 'string') return false;
  const trimmed = link.trim();
  // Must be a relative path starting with '/'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return false;
  }
  // Extract path without query parameters or hashes
  const basePath = trimmed.split('?')[0].split('#')[0];
  return ALLOWED_INTERNAL_ROUTES.some((route) => basePath === route);
}
