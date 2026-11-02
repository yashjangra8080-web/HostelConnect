import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Users,
  ClipboardCheck,
  FileText,
  Activity,
  Table,
  BedDouble,
  LayoutGrid,
  Droplets,
  Wrench,
  Bell,
  CheckCheck,
  ExternalLink,
  MessageSquare,
  Inbox,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Role, NotificationItem } from '../types';

export type ViewTab =
  | 'queue'
  | 'directory'
  | 'apply'
  | 'pool'
  | 'status'
  | 'console'
  | 'health'
  | 'notices'
  | 'water'
  | 'maintenance'
  | 'laundry'
  | 'notifications'
  | 'complaints'
  | 'inbox'
  | 'privilege-proof';

export interface Persona {
  id: string;
  name: string;
  role: Role;
  loginId: string;
  label: string;
}

export const PRESET_PERSONAS: Persona[] = [
  {
    id: 'office',
    name: 'Dr. Ramesh Sharma',
    role: 'HOSTEL_OFFICE',
    loginId: 'office',
    label: 'Hostel Office (Verifier)',
  },
  {
    id: 'admin',
    name: 'Chief System Admin',
    role: 'ADMIN',
    loginId: 'admin',
    label: 'System Admin',
  },
  {
    id: 'chiefwarden',
    name: 'Prof. Sanjeev Kumar',
    role: 'CHIEF_WARDEN',
    loginId: 'chiefwarden',
    label: 'Chief Warden',
  },
  {
    id: 'warden_bh1',
    name: 'Dr. Ankit Gupta',
    role: 'WARDEN',
    loginId: 'warden_bh1',
    label: 'Warden BH1 (Boys)',
  },
  {
    id: 'caretaker_bh1',
    name: 'Mr. Jagdish Prasad',
    role: 'CARETAKER',
    loginId: 'caretaker_bh1',
    label: 'Caretaker BH1 (Maintenance)',
  },
  {
    id: 'student_applied',
    name: 'Aarav Sharma (Applied)',
    role: 'STUDENT',
    loginId: '2026UCSDS0001',
    label: 'Student (Applied)',
  },
  {
    id: 'student_unapplied',
    name: 'Student (Unapplied)',
    role: 'STUDENT',
    loginId: '2026UCS1200',
    label: 'Student (New / Unapplied)',
  },
];

interface TopbarProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  activePersona: Persona;
  onPersonaChange: (p: Persona) => void;
  pendingCount?: number;
  unreadNotifsCount?: number;
  recentNotifs?: NotificationItem[];
  onMarkNotifRead?: (id: number) => void;
  onMarkAllNotifsRead?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentTab,
  onTabChange,
  activePersona,
  onPersonaChange,
  pendingCount = 0,
  unreadNotifsCount = 0,
  recentNotifs = [],
  onMarkNotifRead,
  onMarkAllNotifsRead,
}) => {
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowBellDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeepLink = (link: string | null, notifId: number, isRead: boolean | number) => {
    if (!isRead && onMarkNotifRead) {
      onMarkNotifRead(notifId);
    }
    setShowBellDropdown(false);
    if (!link) return;
    if (link.includes('notices')) onTabChange('notices');
    else if (link.includes('water')) onTabChange('water');
    else if (link.includes('maintenance')) onTabChange('maintenance');
    else if (link.includes('laundry')) onTabChange('laundry');
    else if (link.includes('allotment')) onTabChange('status');
    else if (link.includes('pool')) onTabChange('pool');
    else if (link.includes('complaints')) {
      if (activePersona.role === 'STUDENT') onTabChange('complaints');
      else onTabChange('inbox');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Brand & Context */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#0C2054] text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-sm">
            NSUT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold font-heading text-[#0F172A] tracking-tight">HostelConnect</h1>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#2F5BD6] border border-[#CBD5E1]">
                Phase 6 Production
              </span>
            </div>
            <p className="text-xs text-[#64748B]">Sector 3, Dwarka, New Delhi</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 border-l border-[#E2E8F0] pl-6 overflow-x-auto">
          {/* Public Pool Tab (All users) */}
          <button
            onClick={() => onTabChange('pool')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentTab === 'pool'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            <Table className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Public Pool</span>
          </button>

          {/* Notice Hub Tab */}
          <button
            onClick={() => onTabChange('notices')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentTab === 'notices'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Notice Hub</span>
          </button>

          {/* Water Quality Tab */}
          <button
            onClick={() => onTabChange('water')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentTab === 'water'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Water Quality</span>
          </button>

          {/* Maintenance 7-Day Grid Tab */}
          <button
            onClick={() => onTabChange('maintenance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentTab === 'maintenance'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Maintenance</span>
          </button>

          {/* Smart Laundry Tab */}
          <button
            onClick={() => onTabChange('laundry')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentTab === 'laundry'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Laundry</span>
          </button>

          {/* Student Status Tab (Students) */}
          {activePersona.role === 'STUDENT' && (
            <button
              onClick={() => onTabChange('status')}
              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
                currentTab === 'status'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#475569] hover:bg-[#F8FAFC]'
              }`}
            >
              <BedDouble className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>My Allotment</span>
            </button>
          )}

          {/* Student Profile & Apply (Students) */}
          {activePersona.role === 'STUDENT' && (
            <button
              onClick={() => onTabChange('apply')}
              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
                currentTab === 'apply'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#475569] hover:bg-[#F8FAFC]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Profile & Apply</span>
            </button>
          )}

          {/* Verification Queue (Hostel Office & Admin) */}
          {(activePersona.role === 'HOSTEL_OFFICE' || activePersona.role === 'ADMIN') && (
            <button
              onClick={() => onTabChange('queue')}
              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
                currentTab === 'queue'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#475569] hover:bg-[#F8FAFC]'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Verification</span>
              {pendingCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    currentTab === 'queue'
                      ? 'bg-amber-400 text-slate-900'
                      : 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          {/* Student Directory (Authorities) */}
          {activePersona.role !== 'STUDENT' && activePersona.role !== 'CARETAKER' && (
            <button
              onClick={() => onTabChange('directory')}
              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
                currentTab === 'directory'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#475569] hover:bg-[#F8FAFC]'
              }`}
            >
              <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Directory</span>
            </button>
          )}

          {/* Allotment Console & Room Board (Hostel Office, Admin, Warden) */}
          {['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'].includes(activePersona.role) && (
            <button
              onClick={() => onTabChange('console')}
              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
                currentTab === 'console'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#475569] hover:bg-[#F8FAFC]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Allotment & Rooms</span>
            </button>
          )}

          {/* Complaints Portal (Students) */}
          {activePersona.role === 'STUDENT' && (
            <button
              onClick={() => onTabChange('complaints')}
              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
                currentTab === 'complaints'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#475569] hover:bg-[#F8FAFC]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Complaints</span>
            </button>
          )}

          {/* Complaints Inbox (Authorities) */}
          {activePersona.role !== 'STUDENT' && (
            <button
              onClick={() => onTabChange('inbox')}
              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
                currentTab === 'inbox'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#475569] hover:bg-[#F8FAFC]'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Complaints Inbox</span>
            </button>
          )}

          {/* Privilege Proof (Admin only) */}
          {activePersona.role === 'ADMIN' && (
            <button
              onClick={() => onTabChange('privilege-proof')}
              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
                currentTab === 'privilege-proof'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#475569] hover:bg-[#F8FAFC]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Privilege Proof</span>
            </button>
          )}

          {/* Health Tab */}
          <button
            onClick={() => onTabChange('health')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors whitespace-nowrap ${
              currentTab === 'health'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Health</span>
          </button>
        </nav>
      </div>

      {/* Right side: Notifications Bell, Timezone, Persona Switcher */}
      <div className="flex items-center gap-4">
        {/* Notification Bell Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowBellDropdown(!showBellDropdown)}
            className="relative p-2 rounded-full border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569] transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-[#0F172A]" strokeWidth={1.75} />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#DC2626] text-white tabular-nums shadow-xs animate-pulse">
                {unreadNotifsCount}
              </span>
            )}
          </button>

          {/* Bell Dropdown Popover */}
          {showBellDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#CBD5E1] rounded-lg shadow-xl z-50 overflow-hidden text-xs">
              <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#0F172A]">Notifications</span>
                  {unreadNotifsCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] tabular-nums">
                      {unreadNotifsCount} unread
                    </span>
                  )}
                </div>

                {unreadNotifsCount > 0 && onMarkAllNotifsRead && (
                  <button
                    onClick={() => {
                      onMarkAllNotifsRead();
                    }}
                    className="text-[11px] font-semibold text-[#2F5BD6] hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3 text-[#059669]" />
                    <span>Mark all</span>
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-[#E2E8F0]">
                {recentNotifs.length === 0 ? (
                  <div className="p-6 text-center text-[#64748B]">No notifications</div>
                ) : (
                  recentNotifs.slice(0, 5).map((n) => {
                    const isUnread = !n.is_read;
                    return (
                      <div
                        key={n.notif_id}
                        onClick={() => handleDeepLink(n.link, n.notif_id, n.is_read)}
                        className={`p-3 transition-colors cursor-pointer ${
                          isUnread ? 'bg-[#EEF2FF]/40 hover:bg-[#EEF2FF]/60' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className={`font-semibold text-[#0F172A] line-clamp-1 ${isUnread ? 'text-[#2F5BD6]' : ''}`}>
                            {n.title}
                          </span>
                          {isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2F5BD6] shrink-0 mt-1" />
                          )}
                        </div>

                        <p className="text-[11px] text-[#475569] line-clamp-2 leading-relaxed mb-1.5">
                          {n.body}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-[#94A3B8] tabular-nums">
                          <span>{n.created_at}</span>
                          <span className="text-[#2F5BD6] font-semibold flex items-center gap-0.5">
                            Open <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] text-center">
                <button
                  onClick={() => {
                    setShowBellDropdown(false);
                    onTabChange('notifications');
                  }}
                  className="text-xs font-semibold text-[#2F5BD6] hover:underline"
                >
                  View Full Notification Centre &rarr;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Timezone Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-[#475569] bg-[#F8FAFC] px-2.5 py-1 rounded border border-[#E2E8F0] tabular-nums">
          <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
          <span>Asia/Kolkata (IST +05:30)</span>
        </div>

        {/* Persona / Role Selector */}
        <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded px-2.5 py-1 text-xs">
          <User className="w-3.5 h-3.5 text-[#2F5BD6]" strokeWidth={1.75} />
          <span className="text-[#64748B] font-medium hidden sm:inline">Role:</span>
          <select
            value={activePersona.id}
            onChange={(e) => {
              const selected = PRESET_PERSONAS.find((p) => p.id === e.target.value);
              if (selected) onPersonaChange(selected);
            }}
            className="bg-transparent font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
          >
            {PRESET_PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
