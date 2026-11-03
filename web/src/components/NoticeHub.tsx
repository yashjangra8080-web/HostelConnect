import React, { useState, useEffect, useCallback } from 'react';
import {
  Pin,
  Plus,
  Building,
  User,
  AlertCircle,
  X,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { NoticeItem, NoticeCategory, Role } from '../types.js';
import { ViewTab } from './Topbar.js';
import { Button } from './ui/Button.js';
import { Input } from './ui/Input.js';
import { StatusTag, StatusType } from './ui/StatusTag.js';
import { Drawer } from './ui/Drawer.js';
import { EmptyState } from './ui/EmptyState.js';
import { formatDateIST } from '../utils/format.js';

interface NoticeHubProps {
  userRole: Role;
  csrfToken?: string;
  onNavigateTab?: (tab: ViewTab) => void;
}

const CATEGORY_STATUS_MAP: Record<NoticeCategory, StatusType> = {
  CIRCULAR: 'primary',
  WATER_QUALITY: 'primary',
  PEST_CONTROL: 'warning',
  ELECTRICIAN: 'neutral',
  PLUMBER: 'success',
  GENERAL: 'neutral',
};

export const NoticeHub: React.FC<NoticeHubProps> = ({ userRole, csrfToken }) => {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  const [activeNow, setActiveNow] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotices, setTotalNotices] = useState(0);

  // Detail Drawer State
  const [drawerNotice, setDrawerNotice] = useState<NoticeItem | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubCategory, setPubCategory] = useState<NoticeCategory>('CIRCULAR');
  const [pubHostelId, setPubHostelId] = useState<string>('');
  const [pubBody, setPubBody] = useState('');
  const [pubIsPinned, setPubIsPinned] = useState(false);
  const [pubStartsAt, setPubStartsAt] = useState('');
  const [pubEndsAt, setPubEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canPublish = ['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'].includes(userRole);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (category) params.set('category', category);
      if (activeNow) params.set('activeNow', 'true');
      params.set('page', String(page));
      params.set('pageSize', '12');

      const res = await fetch(`/api/notices?${params.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages);
          setTotalNotices(data.pagination.total);
        }
      }
    } catch (err) {
      console.error('Failed to fetch notices:', err);
    } finally {
      setLoading(false);
    }
  }, [search, category, activeNow, page]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  // Handle deep linking via ?open=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('open');
    if (!openId) return;

    const noticeIdNum = parseInt(openId, 10);
    if (isNaN(noticeIdNum)) return;

    // First check if notice is already in loaded page
    const found = notices.find((n) => n.notice_id === noticeIdNum);
    if (found) {
      setDrawerNotice(found);
      return;
    }

    // Otherwise fetch specifically from GET /api/notices/:id
    setDrawerLoading(true);
    fetch(`/api/notices/${noticeIdNum}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.notice) {
          setDrawerNotice(data.notice);
        }
      })
      .catch((err) => console.error('Failed to load deep-linked notice:', err))
      .finally(() => setDrawerLoading(false));
  }, [notices]);

  const handleOpenNotice = (n: NoticeItem) => {
    setDrawerNotice(n);
    const url = new URL(window.location.href);
    url.searchParams.set('open', String(n.notice_id));
    window.history.replaceState({}, '', url.toString());
  };

  const handleCloseDrawer = () => {
    setDrawerNotice(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('open');
    window.history.replaceState({}, '', url.toString());
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubTitle.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          category: pubCategory,
          hostel_id: pubHostelId ? parseInt(pubHostelId, 10) : null,
          title: pubTitle.trim(),
          body: pubBody.trim() || null,
          is_pinned: pubIsPinned,
          starts_at: pubStartsAt ? `${pubStartsAt} 00:00:00` : null,
          ends_at: pubEndsAt ? `${pubEndsAt} 23:59:59` : null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to publish notice.');
      }

      setShowPublishModal(false);
      setPubTitle('');
      setPubBody('');
      setPubIsPinned(false);
      setPubStartsAt('');
      setPubEndsAt('');
      setPage(1);
      fetchNotices();
    } catch (err: any) {
      setSubmitError(err.message || 'Error publishing notice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Controls */}
      <div className="bg-surface border-2 border-black rounded-sm p-6 shadow-hard-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-paper border-2 border-black flex items-center justify-center text-ink-primary shadow-hard-sm">
                <FileText className="w-5 h-5 text-ink-primary" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-extrabold font-heading text-ink-primary tracking-tight">Campus Notice Hub</h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-sm bg-paper border-2 border-black text-ink-primary font-mono font-bold shadow-hard-sm tabular-nums">
                    {totalNotices} notices
                  </span>
                </div>
                <p className="text-xs font-medium text-ink-secondary mt-1">
                  Official institutional circulars, maintenance schedules, and administrative notifications for campus residents.
                </p>
              </div>
            </div>
          </div>

          {canPublish && (
            <Button variant="primary" size="sm" onClick={() => setShowPublishModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
              Publish Notice
            </Button>
          )}
        </div>
      </div>

      {userRole === 'STUDENT' && (
        <div className="p-3.5 bg-paper border-2 border-black rounded-sm shadow-hard-sm text-xs text-ink-primary flex items-center gap-2.5">
          <Building className="w-4 h-4 text-ink-primary shrink-0" strokeWidth={2} />
          <span>
            <strong className="text-ink-primary font-extrabold">Residence Scoping:</strong> Showing notices addressed to your allotted hostel and campus-wide announcements.
          </span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 bg-surface border-2 border-black rounded-sm shadow-hard grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Input
            placeholder="Search circulars by keyword..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs"
          />
        </div>

        <div>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs border-2 border-black rounded-sm bg-surface text-ink-primary font-bold shadow-hard-sm focus:outline-none cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="CIRCULAR">Circulars</option>
            <option value="WATER_QUALITY">Water Quality</option>
            <option value="PEST_CONTROL">Pest Control</option>
            <option value="ELECTRICIAN">Electrician</option>
            <option value="PLUMBER">Plumber</option>
            <option value="GENERAL">General</option>
          </select>
        </div>

        <div className="flex items-center">
          <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeNow}
              onChange={(e) => {
                setActiveNow(e.target.checked);
                setPage(1);
              }}
              className="w-4 h-4 rounded-sm border-2 border-black text-black focus:ring-0 cursor-pointer"
            />
            <span className="font-extrabold text-ink-primary">Active Window Only</span>
          </label>
        </div>
      </div>

      {/* Compact Dated Ledger Table */}
      <div className="bg-surface border-2 border-black rounded-sm shadow-hard-xl overflow-hidden">
        <div className="px-5 py-3 bg-surface-subtle border-b-2 border-black flex items-center justify-between text-xs">
          <span className="font-extrabold text-ink-primary uppercase tracking-wider text-[11px]">
            Notice Ledger (Dated Registry)
          </span>
          <span className="text-ink-secondary font-mono font-bold tabular-nums">
            Showing {notices.length} of {totalNotices} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-paper border-b-2 border-black text-ink-primary uppercase font-extrabold text-[11px] select-none">
                <th className="py-3 px-4 w-28 whitespace-nowrap">Date</th>
                <th className="py-3 px-4 w-44">Category / Hostel</th>
                <th className="py-3 px-4">Title & Excerpt</th>
                <th className="py-3 px-4 w-44 whitespace-nowrap">Issued By</th>
                <th className="py-3 px-4 w-20 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4">
                      <div className="h-4 bg-surface-muted rounded-sm w-20 border border-black" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-surface-muted rounded-sm w-28 border border-black" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-surface-muted rounded-sm w-3/4 mb-1 border border-black" />
                      <div className="h-3 bg-surface-muted rounded-sm w-1/2" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-surface-muted rounded-sm w-24 border border-black" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-6 bg-surface-muted rounded-sm w-12 ml-auto border border-black" />
                    </td>
                  </tr>
                ))
              ) : notices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-4">
                    <EmptyState
                      icon={<FileText className="w-6 h-6 text-ink-muted" strokeWidth={2} />}
                      title="No notices found"
                      description="No official circulars or maintenance announcements match your current filter criteria."
                      actionLabel={search || category || activeNow ? 'Clear Filters' : undefined}
                      onAction={() => {
                        setSearch('');
                        setCategory('');
                        setActiveNow(false);
                        setPage(1);
                      }}
                    />
                  </td>
                </tr>
              ) : (
                notices.map((n) => {
                  const isPinned = Boolean(n.is_pinned);
                  const statusType = CATEGORY_STATUS_MAP[n.category] || 'neutral';
                  const dateFormatted = n.starts_at ? formatDateIST(n.starts_at) : 'Immediate';

                  return (
                    <tr
                      key={n.notice_id}
                      onClick={() => handleOpenNotice(n)}
                      className={`hover:bg-paper/30 cursor-pointer transition-colors ${
                        isPinned ? 'bg-saffron/20 border-l-4 border-l-black font-medium' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-4 font-mono font-bold tabular-nums text-ink-primary whitespace-nowrap">
                        {dateFormatted}
                      </td>

                      {/* Category & Hostel Tags */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isPinned && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-extrabold bg-black text-white border border-black shadow-hard-sm">
                              <Pin className="w-2.5 h-2.5 fill-current" strokeWidth={2} />
                              PIN
                            </span>
                          )}
                          <StatusTag status={statusType} label={n.category.replace('_', ' ')} size="sm" />
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-sm bg-surface-subtle border-2 border-black text-ink-primary">
                            {n.hostel_name || 'All'}
                          </span>
                        </div>
                      </td>

                      {/* Title & Preview Excerpt */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <h4 className="font-extrabold text-ink-primary text-xs leading-snug">
                            {n.title}
                          </h4>
                          <p className="text-[11px] font-medium text-ink-secondary truncate max-w-xl">
                            {n.body || 'No additional directives.'}
                          </p>
                        </div>
                      </td>

                      {/* Issued By */}
                      <td className="py-3 px-4 text-ink-primary whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-ink-muted shrink-0" strokeWidth={2} />
                          <span className="truncate max-w-[140px] font-bold" title={n.posted_by_name || 'Administration'}>
                            {n.posted_by_name || 'Administration'}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenNotice(n);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          View
                          <ChevronRight className="w-3 h-3 ml-0.5" strokeWidth={2} />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {totalPages > 1 && (
          <div className="px-5 py-3 bg-surface-subtle border-t-2 border-black flex items-center justify-between text-xs">
            <span className="font-medium text-ink-secondary">
              Page <strong className="text-ink-primary font-mono font-extrabold tabular-nums">{page}</strong> of{' '}
              <strong className="text-ink-primary font-mono font-extrabold tabular-nums">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Notice Detail Drawer */}
      <Drawer
        isOpen={Boolean(drawerNotice)}
        onClose={handleCloseDrawer}
        title={
          drawerNotice ? (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-ink-primary shrink-0" strokeWidth={2} />
              <span className="truncate text-sm font-extrabold">{drawerNotice.title}</span>
            </div>
          ) : (
            'Notice Detail'
          )
        }
        subtitle={
          drawerNotice ? (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <StatusTag
                status={CATEGORY_STATUS_MAP[drawerNotice.category] || 'neutral'}
                label={drawerNotice.category.replace('_', ' ')}
                size="sm"
              />
              <span className="text-xs font-mono font-bold text-ink-primary">
                {drawerNotice.hostel_name || 'All Hostels (Campus Wide)'}
              </span>
              {drawerNotice.is_pinned ? (
                <span className="text-[10px] font-extrabold text-black bg-saffron border border-black px-1.5 py-0.5 rounded-sm">
                  PINNED
                </span>
              ) : null}
            </div>
          ) : null
        }
        footer={
          <div className="flex justify-end w-full">
            <Button variant="outline" size="sm" onClick={handleCloseDrawer}>
              Close
            </Button>
          </div>
        }
      >
        {drawerLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-ink-muted">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs font-bold">Loading notice details...</span>
          </div>
        ) : drawerNotice ? (
          <div className="space-y-6 text-xs text-ink-secondary">
            {/* Metadata Card */}
            <div className="p-4 bg-surface border-2 border-black rounded-sm shadow-hard space-y-2.5 font-mono text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-ink-secondary font-bold">Notice ID:</span>
                <span className="font-extrabold text-ink-primary">#{drawerNotice.notice_id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-secondary font-bold">Issued By:</span>
                <span className="font-extrabold text-ink-primary">
                  {drawerNotice.posted_by_name || 'Hostel Administration'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-secondary font-bold">Effective Date:</span>
                <span className="text-ink-primary font-bold tabular-nums">
                  {drawerNotice.starts_at ? formatDateIST(drawerNotice.starts_at) : 'Immediate'}
                </span>
              </div>
              {drawerNotice.ends_at && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary font-bold">Valid Until:</span>
                  <span className="text-ink-primary font-bold tabular-nums">
                    {formatDateIST(drawerNotice.ends_at)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-ink-secondary font-bold">Hostel Scope:</span>
                <span className="text-ink-primary font-bold">
                  {drawerNotice.hostel_name || 'Campus Wide (All Hostels)'}
                </span>
              </div>
            </div>

            {/* Notice Directives / Body */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-ink-primary text-xs uppercase tracking-wider">
                Directives & Details
              </h4>
              <div className="p-4 bg-surface border-2 border-black rounded-sm shadow-hard leading-relaxed text-ink-primary whitespace-pre-line text-xs font-sans">
                {drawerNotice.body || 'No additional directives provided in this official notice.'}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border-2 border-black rounded-sm max-w-lg w-full p-6 shadow-hard-xl">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
              <h3 className="font-extrabold text-base text-ink-primary font-heading">Publish Official Circular</h3>
              <button
                onClick={() => setShowPublishModal(false)}
                className="text-ink-primary hover:bg-paper p-1.5 border-2 border-black rounded-sm shadow-hard-sm"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-status-danger-subtle border-2 border-black rounded-sm text-xs text-status-danger-text font-bold flex items-center gap-2 shadow-hard-sm">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handlePublishSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-ink-primary mb-1">
                  Notice Title <span className="text-status-danger-text">*</span>
                </label>
                <Input
                  required
                  maxLength={160}
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="e.g. Schedule of Overhead Water Tank Cleaning"
                  className="w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-ink-primary mb-1">Category</label>
                  <select
                    value={pubCategory}
                    onChange={(e) => setPubCategory(e.target.value as NoticeCategory)}
                    className="w-full px-3 py-2 border-2 border-black rounded-sm bg-surface text-ink-primary font-bold shadow-hard-sm focus:outline-none text-xs"
                  >
                    <option value="CIRCULAR">CIRCULAR</option>
                    <option value="WATER_QUALITY">WATER_QUALITY</option>
                    <option value="PEST_CONTROL">PEST_CONTROL</option>
                    <option value="ELECTRICIAN">ELECTRICIAN</option>
                    <option value="PLUMBER">PLUMBER</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-ink-primary mb-1">Hostel Scope</label>
                  <select
                    value={pubHostelId}
                    onChange={(e) => setPubHostelId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-black rounded-sm bg-surface text-ink-primary font-bold shadow-hard-sm focus:outline-none text-xs"
                  >
                    <option value="">Campus Wide (All Hostels)</option>
                    <option value="1">Hostel 1 (BH1 - Boys)</option>
                    <option value="2">Hostel 2 (BH2 - Boys)</option>
                    <option value="3">Hostel 3 (GH1 - Girls)</option>
                    <option value="4">Hostel 4 (GH2 - Girls)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-ink-primary mb-1">Starts At (Date)</label>
                  <Input
                    type="date"
                    value={pubStartsAt}
                    onChange={(e) => setPubStartsAt(e.target.value)}
                    className="w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-ink-primary mb-1">Ends At (Date)</label>
                  <Input
                    type="date"
                    value={pubEndsAt}
                    onChange={(e) => setPubEndsAt(e.target.value)}
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-ink-primary mb-1">Notice Body / Directives</label>
                <textarea
                  rows={4}
                  value={pubBody}
                  onChange={(e) => setPubBody(e.target.value)}
                  placeholder="Enter detailed directives or instructions..."
                  className="w-full px-3 py-2 border-2 border-black rounded-sm bg-surface text-ink-primary shadow-hard-sm focus:outline-none text-xs font-medium leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinNotice"
                  checked={pubIsPinned}
                  onChange={(e) => setPubIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded-sm border-2 border-black text-black focus:ring-0 cursor-pointer"
                />
                <label htmlFor="pinNotice" className="font-extrabold text-ink-primary cursor-pointer select-none">
                  Pin to Top of Registry (High Priority)
                </label>
              </div>

              <div className="pt-3 border-t-2 border-black flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPublishModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                >
                  {submitting ? 'Publishing...' : 'Publish to Registry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
