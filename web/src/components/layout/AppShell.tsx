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
  const props = { className: 'w-4 h-4 shrink-0', strokeWidth: 2 };
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
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);
  const [currentTimeIST, setCurrentTimeIST] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Platform-aware shortcut indicator
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

  // Synchronize document.title per page
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Dashboard — HostelConnect',
      '/student/apply': 'Application Profile — HostelConnect',
      '/student/allotment': 'My Room & Allotment — HostelConnect',
      '/student/mess': 'Mess Attendance — HostelConnect',
      '/student/refunds': 'Mess Refund Ledger — HostelConnect',
      '/student/complaints': 'File Complaint — HostelConnect',
      '/student/notices': 'Campus Notices — HostelConnect',
      '/student/laundry': 'Smart Laundry — HostelConnect',
      '/notifications': 'Notifications & Alerts — HostelConnect',
      '/water-quality': 'Water Quality Telemetry — HostelConnect',
      '/maintenance': 'Maintenance Schedules — HostelConnect',
      '/complaints': 'Grievance Central Inbox — HostelConnect',
      '/verify': 'Application Verification Queue — HostelConnect',
      '/pool': 'Public Transparency Pool — HostelConnect',
      '/office/allotment-run': 'Hostel Office Allotment Console — HostelConnect',
      '/rooms': 'Room Occupancy Matrix — HostelConnect',
      '/residents': 'Student Resident Directory — HostelConnect',
      '/mess': 'Dining Operations Counter — HostelConnect',
      '/mess/counter': 'Dining Operations Counter — HostelConnect',
      '/mess/refunds': 'Mess Refund Console — HostelConnect',
      '/mess/config': 'Mess Configuration — HostelConnect',
      '/admin/privilege-proof': 'Database Privilege Proof — HostelConnect',
      '/change-password': 'Change Password — HostelConnect',
    };
    document.title = titles[currentPath] || 'HostelConnect — NSUT Dwarka';
  }, [currentPath]);

  // Maintain live IST clock in sidebar footer
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const istString = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setCurrentTimeIST(istString);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch dynamic navigation groups from backend
  useEffect(() => {
    fetch('/api/nav', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { groups: [] }))
      .then((data) => setNavGroups(data.groups || []))
      .catch(() => setNavGroups([]));
  }, [user]);

  // Polling unread notification badge count every 30 seconds
  useEffect(() => {
    const fetchUnread = () => {
      fetch('/api/notifications/count', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : { unreadCount: 0 }))
        .then((data) => setUnreadCount(Number(data.unreadCount ?? data.count) || 0))
        .catch(() => {});
    };
    fetchUnread();
    const pollInterval = setInterval(fetchUnread, 30000);
    return () => clearInterval(pollInterval);
  }, [user]);

  // Fetch recent notifications when popover is toggled open
  const toggleNotifPopover = () => {
    if (!isNotifPopoverOpen) {
      fetch('/api/notifications?limit=8', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : { notifications: [] }))
        .then((data) => setNotifications(data.notifications || []))
        .catch(() => setNotifications([]));
    }
    setIsNotifPopoverOpen((prev) => !prev);
  };

  const markNotificationRead = (notifId: number) => {
    // Optimistic update
    setUnreadCount((c) => Math.max(0, c - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.notif_id === notifId ? { ...n, is_read: true } : n))
    );
    fetch(`/api/notifications/${notifId}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => {});
  };

  const markAllNotificationsRead = () => {
    // Optimistic update
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
        {/* Brand Header */}
        <div className="h-16 px-4 shrink-0 border-b-2 border-black flex items-center justify-between bg-navy-sidebar">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-[4px] bg-saffron text-black border-2 border-black flex items-center justify-center font-heading font-extrabold text-xs shrink-0 tracking-tight shadow-hard-sm">
              HC
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-heading font-extrabold text-sm tracking-tight leading-tight block truncate text-white">
                HostelConnect
              </span>
              <span className="text-[11px] text-surface-subtle leading-tight block truncate font-bold">
                NSUT Dwarka
              </span>
            </div>
          </div>
          {onItemClick && (
            <button
              type="button"
              onClick={onItemClick}
              aria-label="Close navigation"
              className="lg:hidden p-1 rounded-[8px] border-2 border-black bg-white text-black hover:bg-saffron focus:outline-none"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Role Indicator Ribbon */}
        <div className="px-4 py-2.5 bg-black/40 border-b-2 border-black flex items-center justify-between text-xs">
          <span className="text-[11px] text-surface-subtle font-bold">Logged in as</span>
          <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider bg-surface-subtle text-black border-2 border-black">
            {roleLabel}
          </span>
        </div>

        {/* Navigation Groups with Thin Custom Scrollbar */}
        <div className="py-4 px-3 space-y-6 overflow-y-auto max-h-[calc(100vh-170px)] scrollbar-thin">
          {navGroups.map((group, gIdx) => (
            <div key={`${group.title}-${gIdx}`} className="space-y-1.5">
              <div className="px-3 pb-1 text-[10px] font-heading font-extrabold uppercase tracking-wider text-surface-subtle">
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[4px] text-xs transition-colors text-left ${
                      isActive
                        ? 'bg-saffron text-black border-2 border-black shadow-hard font-heading font-bold'
                        : 'text-white hover:bg-surface-subtle hover:text-black font-medium border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderNavIcon(item.icon)}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className="ml-2 px-1.5 py-0.2 rounded-[4px] text-[10px] font-bold tabular-nums bg-white text-black border-2 border-black">
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
      <div className="p-3 border-t-2 border-black bg-black/30">
        <div className="bg-surface-subtle text-black border-2 border-black rounded-[4px] px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-black" strokeWidth={2} />
            <span className="tabular-nums font-mono">{currentTimeIST || 'IST'}</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider">
            UTC+05:30
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-dots">
      {/* Skip to Content for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-black focus:text-white focus:border-2 focus:border-white focus:rounded-[4px] focus:text-xs focus:font-bold"
      >
        Skip to main content
      </a>

      {/* 240px Fixed Left Rail Navigation for Desktop */}
      <aside className="hidden lg:flex w-[240px] shrink-0 min-h-screen bg-navy-sidebar text-white flex-col justify-between select-none z-20 border-r-2 border-black">
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
          <aside className="relative w-[260px] max-w-[85vw] bg-navy-sidebar text-white flex flex-col justify-between z-10 h-full border-r-2 border-black shadow-hard-xl">
            {renderSidebarContent(() => setIsMobileNavOpen(false))}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Persistent 64px Top Bar: bg-white, border-b-2 border-black */}
        <header className="h-16 bg-white border-b-2 border-black px-3 sm:px-6 flex items-center justify-between sticky top-0 z-10">
          {/* Mobile Menu & Quick Search Button */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-[8px] border-2 border-black bg-white hover:bg-paper text-black focus:outline-none"
            >
              <Menu className="w-5 h-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setIsCommandOpen(true)}
              className="flex items-center gap-2 sm:gap-2.5 h-9 px-2 sm:px-3 bg-white border-2 border-black rounded-[8px] text-xs font-bold text-black transition-all hover:bg-paper shadow-hard-sm w-36 sm:w-48 md:w-64 text-left focus:outline-none"
            >
              <Search className="w-4 h-4 text-black shrink-0" strokeWidth={2} />
              <span className="flex-1 truncate">Search...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-[4px] bg-white border-2 border-black text-[10px] font-mono text-black font-bold">
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
                className="relative p-2 rounded-[8px] border-2 border-black bg-white hover:bg-saffron text-black transition-colors focus:outline-none shadow-hard-sm"
              >
                <Bell className="w-4 h-4" strokeWidth={2} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1 min-w-[16px] h-4 rounded-full bg-saffron text-black border border-black text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
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

            <div className="h-6 w-[2px] bg-black mx-1" />

            {/* User Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1.5 pl-2.5 rounded-[8px] border-2 border-black bg-white hover:bg-paper transition-colors text-left focus:outline-none shadow-hard-sm"
              >
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-black leading-tight max-w-[130px] truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-black/70 font-mono leading-tight font-bold">
                    {user?.loginId}
                  </span>
                </div>
                <div className="w-7 h-7 rounded-[4px] bg-navy-sidebar text-white border-2 border-black flex items-center justify-center text-xs font-bold shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-black" strokeWidth={2} />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <>
                  <div
                    onClick={() => setIsUserMenuOpen(false)}
                    className="fixed inset-0 z-30"
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-black rounded-[4px] shadow-hard py-1.5 z-40 text-xs">
                    <div className="px-3 py-2 border-b-2 border-black mb-1 bg-paper/30">
                      <p className="font-heading font-bold text-black truncate">{displayName}</p>
                      <p className="text-[11px] text-black/70 font-bold truncate mt-0.5">{roleLabel}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-black font-bold hover:bg-paper text-left"
                    >
                      <User className="w-4 h-4 text-black" strokeWidth={2} />
                      <span>User Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('/change-password');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-black font-bold hover:bg-paper text-left"
                    >
                      <KeyRound className="w-4 h-4 text-black" strokeWidth={2} />
                      <span>Change Password</span>
                    </button>

                    <div className="border-t-2 border-black my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-status-danger-text hover:bg-status-danger-bg text-left font-bold"
                    >
                      <LogOut className="w-4 h-4" strokeWidth={2} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Page Body with Dot Canvas */}
        <main id="main-content" className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto min-w-0 bg-dots">{children}</main>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border-2 border-black rounded-[4px] max-w-md w-full p-6 shadow-hard-lg space-y-5">
            <div className="flex items-start justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-paper border-2 border-black text-black flex items-center justify-center font-heading font-extrabold text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-black leading-tight">{displayName}</h3>
                  <span className="text-[11px] font-mono font-bold text-black/70">{user?.loginId} • {roleLabel}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-black p-1 rounded-[8px] border-2 border-black hover:bg-saffron"
              >
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-black">
                <span className="text-black/70 font-medium">Account Role:</span>
                <span className="text-black font-bold">{user?.role}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-black">
                <span className="text-black/70 font-medium">User ID:</span>
                <span className="text-black font-bold">{user?.userId}</span>
              </div>
              {user?.student && (
                <>
                  <div className="flex justify-between py-1 border-b border-black">
                    <span className="text-black/70 font-medium">Roll Number:</span>
                    <span className="text-black font-bold">{user.student.roll_no}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-black">
                    <span className="text-black/70 font-medium">Student Name:</span>
                    <span className="text-black font-bold">{user.student.full_name}</span>
                  </div>
                </>
              )}
              {user?.authority && (
                <>
                  <div className="flex justify-between py-1 border-b border-black">
                    <span className="text-black/70 font-medium">Designation:</span>
                    <span className="text-black font-bold">{user.authority.designation}</span>
                  </div>
                  {user.authority.hostel_id && (
                    <div className="flex justify-between py-1 border-b border-black">
                      <span className="text-black/70 font-medium">Assigned Hostel:</span>
                      <span className="text-black font-bold">Hostel {user.authority.hostel_id}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t-2 border-black">
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
