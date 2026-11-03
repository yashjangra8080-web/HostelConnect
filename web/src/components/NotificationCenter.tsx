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
import { ViewTab } from './Topbar.js';
import { NotificationItem } from '../types.js';

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
      <div className="bg-surface border-2 border-black rounded-sm p-6 shadow-hard-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-paper border-2 border-black flex items-center justify-center text-ink-primary shadow-hard-sm">
                <Bell className="w-5 h-5 text-ink-primary" strokeWidth={2} />
              </div>
              <h2 className="text-xl font-extrabold font-heading text-ink-primary tracking-tight">Notification Centre</h2>
              {unreadCount > 0 ? (
                <span className="text-xs px-2.5 py-0.5 rounded-sm bg-saffron text-black font-extrabold border-2 border-black shadow-hard-sm tabular-nums">
                  {unreadCount} Unread
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-sm bg-status-success-subtle text-status-success-text font-extrabold border-2 border-black shadow-hard-sm">
                  All Caught Up
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-ink-secondary mt-2">
              Real-time transactional notifications fanned out via database triggers across notices, water quality, and maintenance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border-2 border-black text-ink-primary rounded-sm text-xs font-extrabold shadow-hard hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <CheckCheck className="w-4 h-4 text-status-success-text" strokeWidth={2} />
                <span>Mark All Read</span>
              </button>
            )}

            <button
              onClick={() => {
                setFilterUnread(!filterUnread);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-extrabold border-2 border-black shadow-hard hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-hard-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all ${
                filterUnread
                  ? 'bg-paper text-ink-primary'
                  : 'bg-surface text-ink-primary'
              }`}
            >
              <Filter className="w-3.5 h-3.5" strokeWidth={2} />
              <span>{filterUnread ? 'Showing Unread' : 'Filter: Unread'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-surface border-2 border-black rounded-sm shadow-hard-lg overflow-hidden">
        <div className="px-6 py-3 bg-surface-subtle border-b-2 border-black flex items-center justify-between">
          <span className="text-xs font-extrabold text-ink-primary uppercase tracking-wider">
            Transactional Alert Stream
          </span>
          <span className="text-xs font-bold text-ink-secondary tabular-nums">
            Showing {notifications.length} of {totalCount} alerts
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-ink-muted">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-xs font-bold text-ink-muted">
            No notifications in this view.
          </div>
        ) : (
          <div className="divide-y-2 divide-black">
            {notifications.map((notif) => {
              const IconComponent = TYPE_ICONS[notif.notif_type] || Bell;
              const isUnread = !notif.is_read;

              return (
                <div
                  key={notif.notif_id}
                  className={`p-4 transition-colors flex items-start gap-4 ${
                    isUnread ? 'bg-paper/40' : 'bg-surface hover:bg-surface-subtle/30'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 border-2 border-black ${
                      isUnread
                        ? 'bg-saffron text-black shadow-hard-sm'
                        : 'bg-surface text-ink-secondary'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" strokeWidth={2} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-ink-primary">{notif.title}</span>
                        {isUnread && (
                          <span className="w-2.5 h-2.5 rounded-full bg-saffron border border-black" title="Unread" />
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-sm font-extrabold bg-surface-subtle text-ink-primary border border-black">
                          {notif.notif_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-ink-secondary tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-ink-muted" strokeWidth={2} />
                        <span>{notif.created_at}</span>
                      </div>
                    </div>

                    <p className="text-xs font-medium text-ink-secondary leading-relaxed mb-2">
                      {notif.body}
                    </p>

                    <div className="flex items-center gap-3">
                      {notif.link && (
                        <button
                          onClick={() => handleDeepLink(notif.link, notif.notif_id, notif.is_read)}
                          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-ink-primary underline underline-offset-2 hover:text-black"
                        >
                          <span>Open Resource</span>
                          <ExternalLink className="w-3 h-3" strokeWidth={2} />
                        </button>
                      )}

                      {isUnread && (
                        <button
                          onClick={() => handleMarkAsRead(notif.notif_id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-secondary hover:text-ink-primary"
                        >
                          <Check className="w-3 h-3" strokeWidth={2} />
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
        <div className="px-6 py-3 bg-surface-subtle border-t-2 border-black flex items-center justify-between text-xs">
          <span className="font-medium text-ink-secondary">
            Page <strong className="text-ink-primary tabular-nums font-extrabold">{page}</strong> of{' '}
            <strong className="text-ink-primary tabular-nums font-extrabold">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-surface border-2 border-black rounded-sm font-extrabold text-ink-primary shadow-hard-sm hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-surface border-2 border-black rounded-sm font-extrabold text-ink-primary shadow-hard-sm hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
