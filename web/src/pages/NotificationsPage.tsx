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

  const handleToggleRead = async (notifId: number, currentReadStatus: boolean) => {
    try {
      const endpoint = currentReadStatus
        ? `/api/notifications/${notifId}/unread`
        : `/api/notifications/${notifId}/read`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update notification status.');

      // Update state locally
      setNotifications((prev) =>
        prev.map((n) =>
          n.notif_id === notifId ? { ...n, is_read: !currentReadStatus } : n
        )
      );

      // Adjust counts
      setUnreadCount((c) => (currentReadStatus ? c + 1 : Math.max(0, c - 1)));

      if (onNotificationsChanged) {
        onNotificationsChanged();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update notification.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to mark all as read.');

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read.');

      if (onNotificationsChanged) {
        onNotificationsChanged();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark all as read.');
    }
  };

  const resolveTargetLink = (notif: NotificationItem): string => {
    const rawLink = notif.link?.trim() || '';
    if (isAllowedInAppRoute(rawLink)) {
      if (notif.notif_type === 'ALLOTMENT') {
        if (user?.role === 'STUDENT') {
          return '/student/allotment';
        } else if (
          ['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'].includes(
            user?.role || ''
          )
        ) {
          return '/office/ranking';
        }
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
      {/* Page Header Block: White card, 2px border, shadow-hard-lg */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-black tracking-tight">
            Notifications & Alerts
          </h1>
          <p className="text-xs text-black/75 font-medium mt-1">
            Real-time transactional updates, circular dispatches, and institutional alerts in Indian Standard Time (IST).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            leftIcon={<CheckCheck className="w-4 h-4" strokeWidth={2} />}
          >
            Mark all read
          </Button>
        </div>
      </div>

      {/* Filter Toolbar: White panel, 2px border, shadow-hard */}
      <div className="p-3 bg-white border-2 border-black rounded-[4px] shadow-hard flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Toggle: All vs Unread */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setUnreadOnly(false);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-[8px] font-heading font-bold border-2 border-black transition-colors focus:outline-none ${
              !unreadOnly
                ? 'bg-black text-white shadow-hard-sm'
                : 'bg-white text-black hover:bg-saffron'
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
            className={`px-3 py-1.5 rounded-[8px] font-heading font-bold border-2 border-black transition-colors flex items-center gap-1.5 focus:outline-none ${
              unreadOnly
                ? 'bg-black text-white shadow-hard-sm'
                : 'bg-white text-black hover:bg-saffron'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-saffron text-black border border-black tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Category Dropdown & Active counts */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-black">
            <Filter className="w-4 h-4 text-black shrink-0" strokeWidth={2} />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-white border-2 border-black rounded-[8px] text-xs font-bold text-black focus:outline-none focus:shadow-hard"
            >
              {typesList.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-black/70 font-mono font-bold tabular-nums pl-2">
            Showing {notifications.length} of {totalCount} records
          </span>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton variant="row" count={4} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 bg-white border-2 border-black rounded-[4px] shadow-hard">
            <EmptyState
              icon={<Bell className="w-8 h-8 text-black" strokeWidth={2} />}
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
                className={`p-4 bg-white border-2 border-black rounded-[4px] shadow-hard transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                  !notif.is_read
                    ? 'bg-paper/25'
                    : 'bg-white'
                }`}
              >
                {/* Left: Icon & Info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div
                    className={`p-2 rounded-[4px] shrink-0 border-2 border-black mt-0.5 ${
                      !notif.is_read
                        ? 'bg-saffron text-black'
                        : 'bg-white text-black'
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm leading-tight font-heading ${
                          !notif.is_read ? 'font-extrabold text-black' : 'font-bold text-black/80'
                        }`}
                      >
                        {notif.title}
                      </span>
                      <StatusTag status={tagStatus} label={notif.notif_type} size="sm" />
                      {!notif.is_read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-saffron border border-black shrink-0" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-black/80 font-medium leading-relaxed">
                      {notif.body}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-black/70 font-mono font-bold pt-1">
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
                        <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-status-success-text" strokeWidth={2.5} />
                      )
                    }
                  >
                    {notif.is_read ? 'Mark unread' : 'Mark read'}
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleNavigateTarget(notif)}
                    rightIcon={<ExternalLink className="w-3 h-3" strokeWidth={2} />}
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
        <div className="flex items-center justify-between pt-4 border-t-2 border-black text-xs text-black font-bold">
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
