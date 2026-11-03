import React, { useState, useEffect } from 'react';
import {
  Bell,
  Home,
  ShieldAlert,
  Receipt,
  Wrench,
  Droplets,
  Shirt,
  CheckCheck,
  Check,
  RotateCcw,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusTag } from '../components/ui/StatusTag.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { useToast } from '../components/ui/Toast.js';
import { useAuth } from '../context/AuthContext.js';
import {
  formatDateTimeIST,
  formatRelativeTime,
  isAllowedInAppRoute,
} from '../utils/format.js';
import { NotificationItem } from '../components/NotificationPopover.js';

interface NotificationsPageProps {
  onNavigate: (path: string) => void;
  onNotificationsChanged?: () => void;
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

const TYPE_TAG_STATUS: Record<string, 'primary' | 'warning' | 'danger' | 'success' | 'neutral' | 'saffron'> = {
  ALLOTMENT: 'primary',
  NOTICE: 'saffron',
  COMPLAINT: 'danger',
  REFUND: 'success',
  MESS_REFUND: 'success',
  MAINTENANCE: 'warning',
  WATER: 'neutral',
  LAUNDRY: 'neutral',
};

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  onNavigate,
  onNotificationsChanged,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const pageSize = 12;

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (unreadOnly) {
        params.set('unreadOnly', 'true');
      }
      if (typeFilter) {
        params.set('type', typeFilter);
      }

      const res = await fetch(`/api/notifications?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load notifications.');

      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: any) {
      toast.error(err.message || 'Error fetching notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page, unreadOnly, typeFilter]);

  const handleToggleRead = async (notifId: number, currentReadState: boolean) => {
    const endpoint = currentReadState
      ? `/api/notifications/${notifId}/unread`
      : `/api/notifications/${notifId}/read`;

    // Optimistic local update
    setNotifications((prev) =>
      prev.map((n) => (n.notif_id === notifId ? { ...n, is_read: !currentReadState } : n))
    );
    setUnreadCount((prev) => (currentReadState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(endpoint, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to update notification state.');
      if (onNotificationsChanged) onNotificationsChanged();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
      // Revert on error
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to mark all as read.');

      toast.success('All notifications marked as read.');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      if (onNotificationsChanged) onNotificationsChanged();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
  };

  const resolveTargetLink = (notif: NotificationItem): string => {
    const rawLink = notif.link?.trim() || '';
    if (isAllowedInAppRoute(rawLink)) {
      if (notif.notif_type === 'ALLOTMENT') {
        return user?.role === 'STUDENT' ? '/student/allotment' : '/office/ranking';
      }
      return rawLink;
    }

    switch (notif.notif_type) {
      case 'ALLOTMENT':
        return user?.role === 'STUDENT' ? '/student/allotment' : '/office/ranking';
      case 'NOTICE':
        return '/notices';
      case 'COMPLAINT':
        return user?.role === 'STUDENT' ? '/student/complaints' : '/complaints';
      case 'REFUND':
        return user?.role === 'STUDENT' ? '/student/refunds' : '/mess/refunds';
      case 'MAINTENANCE':
        return '/maintenance';
      case 'WATER':
        return '/water-quality';
      case 'LAUNDRY':
        return user?.role === 'STUDENT' ? '/student/laundry' : '/laundry';
      default:
        return '/';
    }
  };

  const handleNavigateTarget = (notif: NotificationItem) => {
    if (!notif.is_read) {
      handleToggleRead(notif.notif_id, false);
    }
    const target = resolveTargetLink(notif);
    if (isAllowedInAppRoute(target)) {
      onNavigate(target);
    }
  };

  const typesList = [
    { value: '', label: 'All Categories' },
    { value: 'ALLOTMENT', label: 'Allotment' },
    { value: 'NOTICE', label: 'Notices & Circulars' },
    { value: 'COMPLAINT', label: 'Complaints' },
    { value: 'REFUND', label: 'Mess Refunds' },
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'WATER', label: 'Water Quality' },
    { value: 'LAUNDRY', label: 'Smart Laundry' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-ink-primary tracking-tight">
            Notifications & Alerts
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Real-time transactional updates, circular dispatches, and institutional alerts in Indian Standard Time (IST).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            leftIcon={<CheckCheck className="w-4 h-4" strokeWidth={1.75} />}
          >
            Mark all read
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 bg-surface border border-border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Toggle: All vs Unread */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-subtle border border-border rounded">
          <button
            type="button"
            onClick={() => {
              setUnreadOnly(false);
              setPage(1);
            }}
            className={`px-3 py-1 rounded font-medium transition-colors focus:outline-none ${
              !unreadOnly
                ? 'bg-surface text-ink-primary shadow-xs font-semibold'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            All Notifications
          </button>
          <button
            type="button"
            onClick={() => {
              setUnreadOnly(true);
              setPage(1);
            }}
            className={`px-3 py-1 rounded font-medium transition-colors flex items-center gap-1.5 focus:outline-none ${
              unreadOnly
                ? 'bg-surface text-ink-primary shadow-xs font-semibold'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-saffron text-white tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Category Dropdown & Active counts */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-ink-secondary">
            <Filter className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {typesList.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-ink-muted font-mono tabular-nums pl-2">
            Showing {notifications.length} of {totalCount} records
          </span>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            <Skeleton variant="row" count={4} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 bg-surface border border-border rounded-lg">
            <EmptyState
              icon={<Bell className="w-8 h-8 text-ink-muted" strokeWidth={1.5} />}
              title="No Notifications Found"
              description={
                unreadOnly
                  ? 'You are all caught up! There are no unread notifications.'
                  : 'No notification records match your selected category filter.'
              }
              actionLabel={unreadOnly || typeFilter ? 'Clear Filters' : undefined}
              onAction={
                unreadOnly || typeFilter
                  ? () => {
                      setUnreadOnly(false);
                      setTypeFilter('');
                      setPage(1);
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          notifications.map((notif) => {
            const Icon = TYPE_ICONS[notif.notif_type] || Bell;
            const tagStatus = TYPE_TAG_STATUS[notif.notif_type] || 'neutral';

            return (
              <div
                key={notif.notif_id}
                className={`p-4 bg-surface border rounded-lg transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                  !notif.is_read
                    ? 'border-primary/40 bg-primary-subtle/10'
                    : 'border-border text-ink-secondary'
                }`}
              >
                {/* Left: Icon & Info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div
                    className={`p-2 rounded shrink-0 border mt-0.5 ${
                      !notif.is_read
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface-subtle text-ink-secondary border-border'
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm leading-tight ${
                          !notif.is_read ? 'font-bold text-ink-primary' : 'font-medium text-ink-secondary'
                        }`}
                      >
                        {notif.title}
                      </span>
                      <StatusTag status={tagStatus} label={notif.notif_type} size="sm" />
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-saffron shrink-0" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {notif.body}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-ink-muted font-mono pt-1">
                      <span className="tabular-nums">{formatDateTimeIST(notif.created_at)}</span>
                      <span>•</span>
                      <span className="tabular-nums">{formatRelativeTime(notif.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleRead(notif.notif_id, notif.is_read)}
                    title={notif.is_read ? 'Mark unread' : 'Mark read'}
                    leftIcon={
                      notif.is_read ? (
                        <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-status-success-text" strokeWidth={2} />
                      )
                    }
                  >
                    {notif.is_read ? 'Mark unread' : 'Mark read'}
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleNavigateTarget(notif)}
                    rightIcon={<ExternalLink className="w-3 h-3" strokeWidth={1.75} />}
                  >
                    Open
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-ink-secondary">
          <span className="tabular-nums">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
