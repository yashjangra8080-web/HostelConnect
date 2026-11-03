import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Table,
  BedDouble,
  FileText,
  User,
  ClipboardCheck,
  LayoutGrid,
  Droplets,
  Wrench,
  Sparkles,
  MessageSquare,
  Inbox,
  ShieldAlert,
  Activity,
  Bell,
  CheckCheck,
  ExternalLink,
} from 'lucide-react';
import { Role } from '../types.js';

export interface Persona {
  id: string;
  name: string;
  role: Role;
  loginId?: string;
  roll_no?: string;
  label: string;
}

export type ViewTab =
  | 'pool'
  | 'status'
  | 'queue'
  | 'directory'
  | 'apply'
  | 'console'
  | 'water'
  | 'maintenance'
  | 'laundry'
  | 'complaints'
  | 'inbox'
  | 'privilege-proof'
  | 'health'
  | 'notices'
  | 'notifications';

export const PRESET_PERSONAS: Persona[] = [
  {
    id: 'student-dev',
    name: 'Dev Sethi',
    roll_no: '2026UCSDS0001',
    role: 'STUDENT',
    label: 'Dev Sethi (Student - Prioritized Non-Delhi)',
  },
  {
    id: 'student-ananya',
    name: 'Ananya Sharma',
    roll_no: '2026UEC0002',
    role: 'STUDENT',
    label: 'Ananya Sharma (Student - Delhi Female Candidate)',
  },
  {
    id: 'hostel-office-ramesh',
    name: 'Ramesh Kumar',
    role: 'HOSTEL_OFFICE',
    label: 'Ramesh Kumar (Hostel Office Admin)',
  },
  {
    id: 'warden-bh1',
    name: 'Dr. S. K. Verma',
    role: 'WARDEN',
    label: 'Dr. S. K. Verma (Warden - BH1 Aryabhatta)',
  },
  {
    id: 'caretaker-bh1',
    name: 'Manoj Singh',
    role: 'CARETAKER',
    label: 'Manoj Singh (Caretaker - BH1)',
  },
  {
    id: 'admin-nsut',
    name: 'Prof. Registrar NSUT',
    role: 'ADMIN',
    label: 'System Admin (Chief Warden / Registrar)',
  },
];

interface NotificationItem {
  notif_id: number;
  user_id: number;
  title: string;
  body: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

interface TopbarProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  activePersona: Persona;
  onPersonaChange: (persona: Persona) => void;
  pendingCount?: number;
  recentNotifs?: NotificationItem[];
  unreadNotifsCount?: number;
  onMarkNotifRead?: (id: number) => void;
  onMarkAllNotifsRead?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentTab,
  onTabChange,
  activePersona,
  onPersonaChange,
  pendingCount = 0,
  recentNotifs = [],
  unreadNotifsCount = 0,
  onMarkNotifRead,
  onMarkAllNotifsRead,
}) => {
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBellDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle in-app routing via notification links
  const handleDeepLink = (link?: string, notifId?: number, isRead?: boolean) => {
    if (notifId && !isRead && onMarkNotifRead) {
      onMarkNotifRead(notifId);
    }
    setShowBellDropdown(false);

    if (!link) return;
    if (link.includes('notices')) onTabChange('notices');
    else if (link.includes('water')) onTabChange('water');
    else if (link.includes('laundry')) onTabChange('laundry');
    else if (link.includes('maintenance')) onTabChange('maintenance');
    else if (link.includes('pool')) onTabChange('pool');
    else if (link.includes('status')) onTabChange('status');
    else if (link.includes('apply')) onTabChange('apply');
    else if (link.includes('complaint')) {
      if (activePersona.role === 'STUDENT') onTabChange('complaints');
      else onTabChange('inbox');
    }
  };

  return (
    <header className="h-16 bg-white border-b-2 border-black px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Context */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[4px] bg-saffron text-black border-2 border-black flex items-center justify-center font-heading font-extrabold text-sm tracking-wider shadow-hard-sm">
            NSUT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-heading font-extrabold text-black tracking-tight">HostelConnect</h1>
              <span className="text-[10px] font-heading font-bold px-1.5 py-0.5 rounded-[4px] bg-status-success-bg text-black border-2 border-black">
                Phase 6 Production
              </span>
            </div>
            <p className="text-xs text-black/70 font-sans">Sector 3, Dwarka, New Delhi</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 border-l-2 border-black pl-6 overflow-x-auto">
          {/* Public Pool Tab (All users) */}
          <button
            onClick={() => onTabChange('pool')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
              currentTab === 'pool'
                ? 'bg-black text-white border-black shadow-hard-sm'
                : 'text-black border-transparent hover:border-black hover:bg-saffron'
            }`}
          >
            <Table className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Public Pool</span>
          </button>

          {/* Notice Hub Tab */}
          <button
            onClick={() => onTabChange('notices')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
              currentTab === 'notices'
                ? 'bg-black text-white border-black shadow-hard-sm'
                : 'text-black border-transparent hover:border-black hover:bg-saffron'
            }`}
          >
            <FileText className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Notice Hub</span>
          </button>

          {/* Water Quality Tab */}
          <button
            onClick={() => onTabChange('water')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
              currentTab === 'water'
                ? 'bg-black text-white border-black shadow-hard-sm'
                : 'text-black border-transparent hover:border-black hover:bg-saffron'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Water Quality</span>
          </button>

          {/* Maintenance 7-Day Grid Tab */}
          <button
            onClick={() => onTabChange('maintenance')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
              currentTab === 'maintenance'
                ? 'bg-black text-white border-black shadow-hard-sm'
                : 'text-black border-transparent hover:border-black hover:bg-saffron'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Maintenance</span>
          </button>

          {/* Smart Laundry Tab */}
          <button
            onClick={() => onTabChange('laundry')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
              currentTab === 'laundry'
                ? 'bg-black text-white border-black shadow-hard-sm'
                : 'text-black border-transparent hover:border-black hover:bg-saffron'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Laundry</span>
          </button>

          {/* Student Status Tab (Students) */}
          {activePersona.role === 'STUDENT' && (
            <button
              onClick={() => onTabChange('status')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
                currentTab === 'status'
                  ? 'bg-black text-white border-black shadow-hard-sm'
                  : 'text-black border-transparent hover:border-black hover:bg-saffron'
              }`}
            >
              <BedDouble className="w-3.5 h-3.5" strokeWidth={2} />
              <span>My Allotment</span>
            </button>
          )}

          {/* Student Profile & Apply (Students) */}
          {activePersona.role === 'STUDENT' && (
            <button
              onClick={() => onTabChange('apply')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
                currentTab === 'apply'
                  ? 'bg-black text-white border-black shadow-hard-sm'
                  : 'text-black border-transparent hover:border-black hover:bg-saffron'
              }`}
            >
              <FileText className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Profile & Apply</span>
            </button>
          )}

          {/* Verification Queue (Hostel Office & Admin) */}
          {(activePersona.role === 'HOSTEL_OFFICE' || activePersona.role === 'ADMIN') && (
            <button
              onClick={() => onTabChange('queue')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
                currentTab === 'queue'
                  ? 'bg-black text-white border-black shadow-hard-sm'
                  : 'text-black border-transparent hover:border-black hover:bg-saffron'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Verification</span>
              {pendingCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-[4px] font-mono font-bold bg-saffron text-black border border-black tabular-nums shadow-hard-sm">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          {/* Student Directory (Authorities) */}
          {activePersona.role !== 'STUDENT' && activePersona.role !== 'CARETAKER' && (
            <button
              onClick={() => onTabChange('directory')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
                currentTab === 'directory'
                  ? 'bg-black text-white border-black shadow-hard-sm'
                  : 'text-black border-transparent hover:border-black hover:bg-saffron'
              }`}
            >
              <Users className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Directory</span>
            </button>
          )}

          {/* Allotment Console & Room Board (Hostel Office, Admin, Warden) */}
          {['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'].includes(activePersona.role) && (
            <button
              onClick={() => onTabChange('console')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
                currentTab === 'console'
                  ? 'bg-black text-white border-black shadow-hard-sm'
                  : 'text-black border-transparent hover:border-black hover:bg-saffron'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Allotment & Rooms</span>
            </button>
          )}

          {/* Complaints Portal (Students) */}
          {activePersona.role === 'STUDENT' && (
            <button
              onClick={() => onTabChange('complaints')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
                currentTab === 'complaints'
                  ? 'bg-black text-white border-black shadow-hard-sm'
                  : 'text-black border-transparent hover:border-black hover:bg-saffron'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Complaints</span>
            </button>
          )}

          {/* Complaints Inbox (Authorities) */}
          {activePersona.role !== 'STUDENT' && (
            <button
              onClick={() => onTabChange('inbox')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
                currentTab === 'inbox'
                  ? 'bg-black text-white border-black shadow-hard-sm'
                  : 'text-black border-transparent hover:border-black hover:bg-saffron'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Complaints Inbox</span>
            </button>
          )}

          {/* Privilege Proof (Admin only) */}
          {activePersona.role === 'ADMIN' && (
            <button
              onClick={() => onTabChange('privilege-proof')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
                currentTab === 'privilege-proof'
                  ? 'bg-black text-white border-black shadow-hard-sm'
                  : 'text-black border-transparent hover:border-black hover:bg-saffron'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Privilege Proof</span>
            </button>
          )}

          {/* Health Tab */}
          <button
            onClick={() => onTabChange('health')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 transition-colors whitespace-nowrap border-2 ${
              currentTab === 'health'
                ? 'bg-black text-white border-black shadow-hard-sm'
                : 'text-black border-transparent hover:border-black hover:bg-saffron'
            }`}
          >
            <Activity className="w-3.5 h-3.5" strokeWidth={2} />
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
            className="relative p-2 rounded-[8px] border-2 border-black bg-white hover:bg-saffron text-black transition-colors shadow-hard-sm"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-black" strokeWidth={2} />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-[4px] text-[10px] font-heading font-bold bg-status-danger-bg text-black border border-black tabular-nums shadow-hard-sm">
                {unreadNotifsCount}
              </span>
            )}
          </button>

          {/* Bell Dropdown Popover */}
          {showBellDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white border-2 border-black rounded-[4px] shadow-hard-xl z-50 overflow-hidden text-xs">
              <div className="px-4 py-3 bg-surface-subtle border-b-2 border-black flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-extrabold text-black">Notifications</span>
                  {unreadNotifsCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-[4px] font-heading font-bold bg-status-danger-bg text-black border border-black tabular-nums">
                      {unreadNotifsCount} unread
                    </span>
                  )}
                </div>

                {unreadNotifsCount > 0 && onMarkAllNotifsRead && (
                  <button
                    onClick={() => {
                      onMarkAllNotifsRead();
                    }}
                    className="text-[11px] font-heading font-bold text-black hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3 text-black" strokeWidth={2} />
                    <span>Mark all</span>
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-black">
                {recentNotifs.length === 0 ? (
                  <div className="p-6 text-center text-black/70 font-sans">No notifications</div>
                ) : (
                  recentNotifs.slice(0, 5).map((n) => {
                    const isUnread = !n.is_read;
                    return (
                      <div
                        key={n.notif_id}
                        onClick={() => handleDeepLink(n.link, n.notif_id, n.is_read)}
                        className={`p-3 transition-colors cursor-pointer ${
                          isUnread ? 'bg-paper hover:bg-paper/80' : 'hover:bg-paper/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className={`font-heading font-bold text-black line-clamp-1`}>
                            {n.title}
                          </span>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-black shrink-0 mt-1 border border-black" />
                          )}
                        </div>

                        <p className="text-[11px] text-black/80 font-sans line-clamp-2 leading-relaxed mb-1.5">
                          {n.body}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-black/70 font-mono tabular-nums">
                          <span>{n.created_at}</span>
                          <span className="text-black font-heading font-bold flex items-center gap-0.5">
                            Open <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-2.5 bg-surface-subtle/20 border-t-2 border-black text-center">
                <button
                  onClick={() => {
                    setShowBellDropdown(false);
                    onTabChange('notifications');
                  }}
                  className="text-xs font-heading font-bold text-black hover:underline"
                >
                  View Full Notification Centre &rarr;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Timezone Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono font-bold text-black bg-white px-2.5 py-1 rounded-[8px] border-2 border-black tabular-nums shadow-hard-sm">
          <span className="w-2 h-2 rounded-full bg-status-success-text border border-black"></span>
          <span>Asia/Kolkata (IST +05:30)</span>
        </div>

        {/* Persona / Role Selector */}
        <div className="flex items-center gap-2 bg-white border-2 border-black rounded-[8px] px-2.5 py-1 text-xs shadow-hard-sm font-heading font-bold">
          <User className="w-3.5 h-3.5 text-black" strokeWidth={2} />
          <span className="text-black/70 font-sans hidden sm:inline">Role:</span>
          <select
            value={activePersona.id}
            onChange={(e) => {
              const selected = PRESET_PERSONAS.find((p) => p.id === e.target.value);
              if (selected) onPersonaChange(selected);
            }}
            className="bg-transparent font-heading font-bold text-black focus:outline-none cursor-pointer"
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
