import React, { useState, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Filter,
  Clock,
  FileText,
  Droplets,
  Wrench,
  BedDouble,
  MessageSquare,
} from 'lucide-react';
import { ViewTab } from './Topbar';
import { NotificationItem } from '../types';

interface NotificationCenterProps {
  csrfToken?: string;
  onNavigateTab: (tab: ViewTab) => void;
  onNotificationRead?: () => void;
}

const TYPE_ICONS: Record<string, any> = {
  NOTICE: FileText,
  WATER_QUALITY: Droplets,
  MAINTENANCE: Wrench,
  ALLOTMENT: BedDouble,
  COMPLAINT: MessageSquare,
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  csrfToken,
  onNavigateTab,
  onNotificationRead,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterUnread, setFilterUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '15');
      if (filterUnread) params.set('unreadOnly', 'true');

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages);
          setTotalCount(data.pagination.total);
        }
      }
    } catch (err) {
      console.error('Failed fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page, filterUnread]);

  const handleMarkAsRead = async (notifId: number) => {
    try {
      const res = await fetch(`/api/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.notif_id === notifId ? { ...n, is_read: 1 } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        if (onNotificationRead) onNotificationRead();
      }
    } catch (err) {
      console.error('Failed marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
        if (onNotificationRead) onNotificationRead();
      }
    } catch (err) {
      console.error('Failed marking all read:', err);
    }
  };

  const handleDeepLink = (link: string | null, notifId: number, isRead: boolean | number) => {
    if (!isRead) {
      handleMarkAsRead(notifId);
    }
    if (!link) return;
    if (link.includes('notices')) onNavigateTab('notices');
    else if (link.includes('water')) onNavigateTab('water');
    else if (link.includes('maintenance')) onNavigateTab('maintenance');
    else if (link.includes('allotment')) onNavigateTab('status');
    else if (link.includes('pool')) onNavigateTab('pool');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#2F5BD6]" strokeWidth={1.75} />
              <h2 className="text-xl font-bold font-heading text-[#0F172A]">Notification Centre</h2>
              {unreadCount > 0 ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] font-semibold border border-[#FECACA] tabular-nums">
                  {unreadCount} Unread
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] font-semibold border border-[#A7F3D0]">
                  All Caught Up
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Real-time transactional notifications fanned out via database triggers across notices, water quality, and maintenance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#CBD5E1] text-[#0F172A] rounded text-xs font-semibold hover:bg-[#F8FAFC] transition-colors"
              >
                <CheckCheck className="w-4 h-4 text-[#059669]" strokeWidth={1.75} />
                <span>Mark All Read</span>
              </button>
            )}

            <button
              onClick={() => {
                setFilterUnread(!filterUnread);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                filterUnread
                  ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>{filterUnread ? 'Showing Unread' : 'Filter: Unread'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
            Transactional Alert Stream
          </span>
          <span className="text-xs text-[#64748B] tabular-nums">
            Showing {notifications.length} of {totalCount} alerts
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#64748B]">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            No notifications in this view.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {notifications.map((notif) => {
              const IconComponent = TYPE_ICONS[notif.notif_type] || Bell;
              const isUnread = !notif.is_read;

              return (
                <div
                  key={notif.notif_id}
                  className={`p-4 transition-colors flex items-start gap-4 ${
                    isUnread ? 'bg-[#EEF2FF]/30' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded flex items-center justify-center shrink-0 border ${
                      isUnread
                        ? 'bg-[#EEF2FF] border-[#2F5BD6] text-[#2F5BD6]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" strokeWidth={1.75} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#0F172A]">{notif.title}</span>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#2F5BD6]" title="Unread" />
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
                          {notif.notif_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-[#64748B] tabular-nums">
                        <Clock className="w-3 h-3 text-[#94A3B8]" strokeWidth={1.75} />
                        <span>{notif.created_at}</span>
                      </div>
                    </div>

                    <p className="text-xs text-[#475569] leading-relaxed mb-2">
                      {notif.body}
                    </p>

                    <div className="flex items-center gap-3">
                      {notif.link && (
                        <button
                          onClick={() => handleDeepLink(notif.link, notif.notif_id, notif.is_read)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2F5BD6] hover:underline"
                        >
                          <span>Open Resource</span>
                          <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                        </button>
                      )}

                      {isUnread && (
                        <button
                          onClick={() => handleMarkAsRead(notif.notif_id)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] hover:text-[#0F172A]"
                        >
                          <Check className="w-3 h-3" strokeWidth={1.75} />
                          <span>Mark as read</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Toolbar */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs">
          <span className="text-[#64748B]">
            Page <strong className="text-[#0F172A] tabular-nums">{page}</strong> of{' '}
            <strong className="text-[#0F172A] tabular-nums">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white border border-[#CBD5E1] rounded font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-white border border-[#CBD5E1] rounded font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
