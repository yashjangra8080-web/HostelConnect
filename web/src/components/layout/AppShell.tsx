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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { CommandPalette } from '../ui/CommandPalette.js';
import { Drawer } from '../ui/Drawer.js';
import { StatusTag } from '../ui/StatusTag.js';

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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [currentTimeIST, setCurrentTimeIST] = useState<string>('');

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

  // Fetch recent notifications when drawer opens
  const openNotifDrawer = () => {
    setIsNotifDrawerOpen(true);
    fetch('/api/notifications?page=1&pageSize=15', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { notifications: [] }))
      .then((data) => setNotifications(data.notifications || []))
      .catch(() => setNotifications([]));
  };

  const markNotificationRead = (notifId: number) => {
    fetch(`/api/notifications/${notifId}/read`, { method: 'PATCH', credentials: 'include' })
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.notif_id === notifId ? { ...n, is_read: true } : n))
        );
        fetchNotifCount();
      })
      .catch(() => {});
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
        {/* Institutional Wordmark Header */}
        <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-saffron text-white flex items-center justify-center font-bold text-xs shrink-0 tracking-tight">
              HC
            </div>
            <div className="min-w-0">
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

        {/* Navigation Groups */}
        <div className="py-4 px-3 space-y-6 overflow-y-auto max-h-[calc(100vh-170px)]">
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
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Topbar Actions */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={openNotifDrawer}
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

      {/* Notifications Drawer */}
      <Drawer
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
        title="Notifications & Alerts"
        subtitle={`You have ${unreadCount} unread message(s)`}
      >
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted">
              No notifications at this time.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.notif_id}
                onClick={() => !notif.is_read && markNotificationRead(notif.notif_id)}
                className={`p-3 rounded border transition-colors ${
                  notif.is_read
                    ? 'bg-surface border-border text-ink-secondary'
                    : 'bg-primary-subtle/30 border-primary-border text-ink-primary cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold leading-tight">{notif.title}</span>
                  {!notif.is_read && (
                    <StatusTag status="saffron" label="NEW" size="sm" />
                  )}
                </div>
                {notif.body && (
                  <p className="text-xs text-ink-secondary mt-1 leading-snug">{notif.body}</p>
                )}
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40 text-[10px] text-ink-muted">
                  <span className="font-mono">
                    {new Date(notif.created_at).toLocaleDateString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  {notif.link && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsNotifDrawerOpen(false);
                        onNavigate(notif.link);
                      }}
                      className="text-primary hover:underline font-medium"
                    >
                      View Details →
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>
    </div>
  );
};
