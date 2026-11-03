import React, { useEffect, useRef } from 'react';
import {
  Bell,
  Home,
  ShieldAlert,
  Receipt,
  Wrench,
  Droplets,
  Shirt,
  CheckCheck,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { formatRelativeTime, isAllowedInAppRoute } from '../utils/format.js';

export interface NotificationItem {
  notif_id: number;
  notif_type: 'ALLOTMENT' | 'NOTICE' | 'COMPLAINT' | 'REFUND' | 'MAINTENANCE' | 'WATER' | 'LAUNDRY' | string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (notifId: number) => void;
  onMarkAllRead: () => void;
  onNavigate: (path: string) => void;
  userRole?: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number | string }>> = {
  ALLOTMENT: Home,
  NOTICE: Bell,
  COMPLAINT: ShieldAlert,
  REFUND: Receipt,
  MESS_REFUND: Receipt,
  MAINTENANCE: Wrench,
  WATER: Droplets,
  LAUNDRY: Shirt,
};

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  userRole,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Resolve target route based on type and role mapping if needed
  const resolveTargetLink = (notif: NotificationItem): string => {
    const rawLink = notif.link?.trim() || '';

    // If explicit relative link exists and is allowed, use it
    if (isAllowedInAppRoute(rawLink)) {
      // Role-specific refinement for ALLOTMENT
      if (notif.notif_type === 'ALLOTMENT') {
        if (userRole === 'STUDENT') {
          return '/student/allotment';
        } else if (['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'].includes(userRole || '')) {
          return '/office/ranking';
        }
      }
      return rawLink;
    }

    // Fallbacks if not recognized or blank
    switch (notif.notif_type) {
      case 'ALLOTMENT':
        return userRole === 'STUDENT' ? '/student/allotment' : '/office/ranking';
      case 'NOTICE':
        return '/notices';
      case 'COMPLAINT':
        return userRole === 'STUDENT' ? '/student/complaints' : '/complaints';
      case 'REFUND':
        return userRole === 'STUDENT' ? '/student/refunds' : '/mess/refunds';
      case 'MAINTENANCE':
        return '/maintenance';
      case 'WATER':
        return '/water-quality';
      case 'LAUNDRY':
        return userRole === 'STUDENT' ? '/student/laundry' : '/laundry';
      default:
        return '/';
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.is_read) {
      onMarkRead(notif.notif_id);
    }
    const target = resolveTargetLink(notif);
    if (isAllowedInAppRoute(target)) {
      onNavigate(target);
    }
    onClose();
  };

  // Up to 8 items, unread first (server already sorts unread first)
  const displayItems = notifications.slice(0, 8);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-border rounded-lg shadow-lg z-50 flex flex-col overflow-hidden text-xs"
      tabIndex={-1}
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border bg-surface-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink-primary">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-saffron text-white tabular-nums">
              {unreadCount} unread
            </span>
          )}
        </div>
        <span className="text-[11px] text-ink-muted font-mono">IST</span>
      </div>

      {/* Notifications List (Max 8 items) */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
        {displayItems.length === 0 ? (
          <div className="py-8 text-center text-ink-muted">No notifications</div>
        ) : (
          displayItems.map((notif) => {
            const Icon = TYPE_ICONS[notif.notif_type] || Bell;
            return (
              <button
                key={notif.notif_id}
                type="button"
                onClick={() => handleNotificationClick(notif)}
                className={`w-full text-left p-3 flex items-start gap-3 transition-colors hover:bg-surface-subtle focus:outline-none focus:bg-surface-subtle ${
                  !notif.is_read ? 'bg-primary-subtle/20' : 'bg-surface'
                }`}
              >
                {/* Type Icon Container */}
                <div
                  className={`p-1.5 rounded shrink-0 border mt-0.5 ${
                    !notif.is_read
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-subtle text-ink-secondary border-border'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p
                      className={`truncate leading-tight text-xs ${
                        !notif.is_read ? 'font-semibold text-ink-primary' : 'font-medium text-ink-secondary'
                      }`}
                    >
                      {notif.title}
                    </p>
                    {/* Unread indicator dot */}
                    {!notif.is_read && (
                      <span
                        className="w-2 h-2 rounded-full bg-saffron shrink-0"
                        title="Unread notification"
                        aria-label="Unread"
                      />
                    )}
                  </div>

                  <p className="text-[11px] text-ink-muted truncate leading-snug">
                    {notif.body}
                  </p>

                  <div className="mt-1 flex items-center justify-between text-[10px] text-ink-muted font-mono">
                    <span className="tabular-nums">{formatRelativeTime(notif.created_at)}</span>
                    <span className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                      Open <ChevronRight className="w-2.5 h-2.5 inline" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border bg-surface-subtle flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onMarkAllRead();
          }}
          disabled={unreadCount === 0}
          className="text-[11px] font-medium text-primary hover:text-primary-hover disabled:text-ink-muted disabled:cursor-not-allowed flex items-center gap-1 focus:outline-none"
        >
          <CheckCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Mark all as read</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onNavigate('/notifications');
          }}
          className="text-[11px] font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1 focus:outline-none"
        >
          <span>View all</span>
          <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};
