import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Activity,
  FileSpreadsheet,
  RefreshCw,
  Building,
  BedDouble,
  Users,
  UserCheck,
  Droplets,
  Wrench,
  Bell,
  Palette,
  FileText,
  Award,
  PlayCircle,
  CheckSquare,
  AlertTriangle,
  Utensils,
  QrCode,
  Calendar,
  Receipt,
  Key,
  Shirt,
  Home,
  ShieldAlert,
  Search,
  LogOut,
  KeyRound,
  ChevronDown,
  Clock,
  Menu,
  X,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { CommandPalette } from '../ui/CommandPalette.js';
import { NotificationPopover, NotificationItem } from '../NotificationPopover.js';
import { Button } from '../ui/Button.js';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  badge?: string | number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

// Strictly 16px Lucide Icons mapper
function renderNavIcon(iconName: string) {
  const props = { className: 'w-4 h-4 shrink-0', strokeWidth: 1.75 };
  switch (iconName) {
    case 'LayoutDashboard':
      return <LayoutDashboard {...props} />;
    case 'Activity':
      return <Activity {...props} />;
    case 'FileSpreadsheet':
      return <FileSpreadsheet {...props} />;
    case 'RefreshCw':
      return <RefreshCw {...props} />;
    case 'Building':
      return <Building {...props} />;
    case 'BedDouble':
      return <BedDouble {...props} />;
    case 'Users':
      return <Users {...props} />;
    case 'UserCheck':
      return <UserCheck {...props} />;
    case 'Droplets':
      return <Droplets {...props} />;
    case 'Wrench':
      return <Wrench {...props} />;
    case 'Bell':
      return <Bell {...props} />;
    case 'Palette':
      return <Palette {...props} />;
    case 'FileText':
      return <FileText {...props} />;
    case 'Award':
      return <Award {...props} />;
    case 'PlayCircle':
      return <PlayCircle {...props} />;
    case 'CheckSquare':
      return <CheckSquare {...props} />;
    case 'AlertTriangle':
      return <AlertTriangle {...props} />;
    case 'Utensils':
      return <Utensils {...props} />;
    case 'QrCode':
      return <QrCode {...props} />;
    case 'Calendar':
      return <Calendar {...props} />;
    case 'Receipt':
      return <Receipt {...props} />;
    case 'Key':
      return <Key {...props} />;
    case 'Shirt':
      return <Shirt {...props} />;
    case 'Home':
      return <Home {...props} />;
    case 'ShieldAlert':
      return <ShieldAlert {...props} />;
    default:
      return <LayoutDashboard {...props} />;
  }
}

export const AppShell: React.FC<AppShellProps> = ({ currentPath, onNavigate, children }) => {
  const { user, logout } = useAuth();
  const [navGroups, setNavGroups] = useState<NavGroup[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [currentTimeIST, setCurrentTimeIST] = useState<string>('');

  // Platform shortcut detection (Ctrl K vs ⌘K)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

  // Dynamic document.title per page
  useEffect(() => {
    const PAGE_TITLE_MAP: Record<string, string> = {
      '/': 'Dashboard',
      '/student/dashboard': 'Student Dashboard',
      '/notifications': 'Notifications & Alerts',
      '/student/notices': 'Campus Notice Hub',
      '/notices': 'Campus Notice Hub',
      '/student/mess': 'Mess Attendance & Refund Ledger',
      '/mess/attendance': 'Mess Attendance & Refund Ledger',
      '/mess/refunds': 'Dining Rebate & Refund Ledger',
      '/mess/counter': 'Mess Attendance Counter',
      '/mess/check-in': 'Dining Hall Check-In',
      '/student/laundry': 'Smart Laundry Monitoring',
      '/laundry': 'Smart Laundry Monitoring',
      '/student/allotment': 'Hostel Room Allotment',
      '/allotment': 'Hostel Room Allotment',
      '/student/apply': 'Student Profile & Application',
      '/apply': 'Student Profile & Application',
      '/student/complaints': 'Confidential Complaints',
      '/complaints': 'Confidential Complaints',
      '/water-quality': 'Water Quality Surveillance',
      '/maintenance': 'Maintenance Schedule',
      '/pool': 'Public Transparency Pool',
      '/verify': 'Application Verification Queue',
      '/admin/audit': 'System Audit Log',
      '/admin/privilege-proof': 'Privilege Proof Console',
      '/change-password': 'Change Account Password',
    };
    const title = PAGE_TITLE_MAP[currentPath] || 'Campus Portal';
    document.title = `${title} — HostelConnect`;
  }, [currentPath]);

  // Update IST clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeIST(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch nav groups
  useEffect(() => {
    fetch('/api/nav', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { groups: [] }))
      .then((data) => setNavGroups(data.groups || []))
      .catch(() => setNavGroups([]));
  }, [user?.role]);

  // Fetch unread notification count
  const fetchNotifCount = () => {
    fetch('/api/notifications/count', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { unreadCount: 0 }))
      .then((data) => setUnreadCount(data.unreadCount || 0))
      .catch(() => setUnreadCount(0));
  };

  useEffect(() => {
    fetchNotifCount();
    const interval = setInterval(fetchNotifCount, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  // Fetch latest 8 notifications when popover opens (unread first)
  const toggleNotifPopover = () => {
    if (!isNotifPopoverOpen) {
      fetch('/api/notifications?page=1&pageSize=8', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : { notifications: [] }))
        .then((data) => setNotifications(data.notifications || []))
        .catch(() => setNotifications([]));
    }
    setIsNotifPopoverOpen((prev) => !prev);
  };

  const markNotificationRead = (notifId: number) => {
    // Optimistic update: drop badge and mark read immediately
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.notif_id === notifId ? { ...n, is_read: true } : n))
    );
    fetch(`/api/notifications/${notifId}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => {});
  };

  const markAllNotificationsRead = () => {
    // Optimistic update: zero unread badge immediately
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const displayName =
    user?.student?.full_name ||
    user?.authority?.full_name ||
    user?.loginId ||
    'Authenticated User';

  const roleLabel = user?.role?.replace('_', ' ') || 'USER';

  const renderSidebarContent = (onItemClick?: () => void) => (
    <>
      <div>
        {/* Institutional Wordmark Header (No Clipping) */}
        <div className="h-16 px-4 shrink-0 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-saffron text-white flex items-center justify-center font-bold text-xs shrink-0 tracking-tight">
              HC
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-serif font-bold text-sm tracking-tight leading-tight block truncate text-white">
                HostelConnect
              </span>
              <span className="text-[11px] text-slate-400 leading-tight block truncate">
                NSUT Dwarka
              </span>
            </div>
          </div>
          {onItemClick && (
            <button
              type="button"
              onClick={onItemClick}
              aria-label="Close navigation"
              className="lg:hidden p-1 rounded text-slate-400 hover:text-white focus:outline-none"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Role Indicator Ribbon */}
        <div className="px-5 py-2.5 bg-white/[0.04] border-b border-white/10 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-medium">Logged in as</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-saffron/20 text-saffron border border-saffron/40">
            {roleLabel}
          </span>
        </div>

        {/* Navigation Groups with Thin Custom Scrollbar */}
        <div className="py-4 px-3 space-y-6 overflow-y-auto max-h-[calc(100vh-170px)] scrollbar-thin">
          {navGroups.map((group, gIdx) => (
            <div key={`${group.title}-${gIdx}`} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
              {group.items.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onNavigate(item.path);
                      if (onItemClick) onItemClick();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-navy-active text-white border-l-2 border-saffron font-semibold'
                        : 'text-slate-300 hover:bg-white/[0.08] hover:text-white border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderNavIcon(item.icon)}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-semibold tabular-nums bg-white/20 text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar Footer with IST Clock */}
      <div className="p-3 border-t border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 py-1">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-saffron" strokeWidth={1.75} />
            <span className="tabular-nums font-mono">{currentTimeIST || 'IST'}</span>
          </div>
          <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
            UTC+05:30
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-paper">
      {/* Skip to Content for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-primary focus:text-white focus:rounded focus:text-xs focus:font-medium focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* 240px Fixed Left Rail Navigation for Desktop */}
      <aside className="hidden lg:flex w-[240px] shrink-0 min-h-screen bg-navy-sidebar text-white flex-col justify-between select-none z-20">
        {renderSidebarContent()}
      </aside>

      {/* Responsive Slide-over Mobile/Tablet Drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-[260px] max-w-[85vw] bg-navy-sidebar text-white flex flex-col justify-between z-10 h-full shadow-2xl">
            {renderSidebarContent(() => setIsMobileNavOpen(false))}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Persistent 64px Top Bar */}
        <header className="h-16 bg-surface border-b border-border px-3 sm:px-6 flex items-center justify-between sticky top-0 z-10">
          {/* Mobile Menu & Quick Search Button */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <Menu className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setIsCommandOpen(true)}
              className="flex items-center gap-2 sm:gap-2.5 h-9 px-2 sm:px-3 bg-surface-subtle border border-border hover:border-border-strong rounded text-xs text-ink-muted transition-colors w-32 sm:w-48 md:w-64 text-left focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <Search className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.75} />
              <span className="flex-1 truncate">Search...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono text-ink-secondary">
                {shortcutLabel}
              </kbd>
            </button>
          </div>

          {/* Right Topbar Actions */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={toggleNotifPopover}
                aria-label="View notifications"
                className="relative p-2 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <Bell className="w-4 h-4" strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-saffron text-white text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <NotificationPopover
                isOpen={isNotifPopoverOpen}
                onClose={() => setIsNotifPopoverOpen(false)}
                notifications={notifications}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onNavigate={onNavigate}
                userRole={user?.role}
              />
            </div>

            <div className="h-4 w-[1px] bg-border mx-1" />

            {/* User Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 pl-2.5 rounded hover:bg-surface-subtle transition-colors text-left focus:outline-none"
              >
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-semibold text-ink-primary leading-tight max-w-[130px] truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-ink-muted font-mono leading-tight">
                    {user?.loginId}
                  </span>
                </div>
                <div className="w-7 h-7 rounded bg-navy-sidebar text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <>
                  <div
                    onClick={() => setIsUserMenuOpen(false)}
                    className="fixed inset-0 z-30"
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 mt-1 w-56 bg-surface border border-border rounded-lg shadow-none py-1.5 z-40 text-xs">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="font-semibold text-ink-primary truncate">{displayName}</p>
                      <p className="text-[11px] text-ink-muted truncate mt-0.5">{roleLabel}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle text-left"
                    >
                      <User className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                      <span>User Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('/change-password');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle text-left"
                    >
                      <KeyRound className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                      <span>Change Password</span>
                    </button>

                    <div className="border-t border-border my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-status-danger-text hover:bg-status-danger-bg/50 text-left font-medium"
                    >
                      <LogOut className="w-4 h-4" strokeWidth={1.75} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main id="main-content" className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto min-w-0">{children}</main>
      </div>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelectResult={(res) => {
          setIsCommandOpen(false);
          onNavigate(res.url);
        }}
      />

      {/* User Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-primary/50 p-4">
          <div className="bg-surface border border-border rounded-lg max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center font-bold text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink-primary font-serif leading-tight">{displayName}</h3>
                  <span className="text-[11px] font-mono text-ink-muted">{user?.loginId} • {roleLabel}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-ink-muted hover:text-ink-primary p-1 rounded"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-ink-muted">Account Role:</span>
                <span className="text-ink-primary font-semibold">{user?.role}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-ink-muted">User ID:</span>
                <span className="text-ink-primary font-semibold">{user?.userId}</span>
              </div>
              {user?.student && (
                <>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-ink-muted">Roll Number:</span>
                    <span className="text-ink-primary font-semibold">{user.student.roll_no}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-ink-muted">Student Name:</span>
                    <span className="text-ink-primary">{user.student.full_name}</span>
                  </div>
                </>
              )}
              {user?.authority && (
                <>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-ink-muted">Designation:</span>
                    <span className="text-ink-primary font-semibold">{user.authority.designation}</span>
                  </div>
                  {user.authority.hostel_id && (
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-ink-muted">Assigned Hostel:</span>
                      <span className="text-ink-primary">Hostel {user.authority.hostel_id}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
              {user?.role === 'STUDENT' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    onNavigate('/student/apply');
                  }}
                >
                  View Full Application
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsProfileModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
