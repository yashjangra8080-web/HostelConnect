import React, { useState, useEffect } from 'react';
import {
  Pin,
  Search,
  Calendar,
  Plus,
  Building,
  User,
  Clock,
  AlertCircle,
  X,
  FileText,
} from 'lucide-react';
import { NoticeItem, NoticeCategory, Role } from '../types';
import { ViewTab } from './Topbar';

interface NoticeHubProps {
  userRole: Role;
  csrfToken?: string;
  onNavigateTab?: (tab: ViewTab) => void;
}

const CATEGORY_COLORS: Record<NoticeCategory, { bg: string; text: string; border: string }> = {
  CIRCULAR: { bg: '#EEF2FF', text: '#2F5BD6', border: '#CBD5E1' },
  WATER_QUALITY: { bg: '#ECFEFF', text: '#0891B2', border: '#A5F3FC' },
  PEST_CONTROL: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  ELECTRICIAN: { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' },
  PLUMBER: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  GENERAL: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
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

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (category) params.set('category', category);
      if (activeNow) params.set('activeNow', 'true');
      params.set('page', String(page));
      params.set('pageSize', '10');

      const res = await fetch(`/api/notices?${params.toString()}`);
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
  };

  useEffect(() => {
    fetchNotices();
  }, [search, category, activeNow, page]);

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2F5BD6]" strokeWidth={1.75} />
              <h2 className="text-xl font-bold font-heading text-[#0F172A]">Campus Notice Hub</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#2F5BD6] font-semibold border border-[#CBD5E1] tabular-nums">
                {totalNotices} Active Notices
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Official circulars, facility maintenance alerts, and administrative notifications for NSUT residents.
            </p>
          </div>

          {canPublish && (
            <button
              onClick={() => setShowPublishModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2F5BD6] text-white rounded text-xs font-semibold hover:bg-[#1B43A6] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              <span>Publish Notice</span>
            </button>
          )}
        </div>

        {userRole === 'STUDENT' && (
          <div className="mt-4 p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-xs text-[#475569] flex items-center gap-2">
            <Building className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
            <span>
              <strong>Residence Scoping:</strong> Showing notices addressed to your allotted hostel and campus-wide announcements.
            </span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="mt-6 pt-4 border-t border-[#E2E8F0] grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Search circulars by keyword..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#CBD5E1] rounded bg-white focus:outline-none focus:border-[#2F5BD6]"
            />
          </div>

          <div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs border border-[#CBD5E1] rounded bg-white text-[#0F172A] focus:outline-none focus:border-[#2F5BD6]"
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
            <label className="flex items-center gap-2 text-xs text-[#475569] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={activeNow}
                onChange={(e) => {
                  setActiveNow(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-[#CBD5E1] text-[#2F5BD6] focus:ring-[#2F5BD6]"
              />
              <span className="font-medium">Active Window Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Dated Ledger List */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
            Notice Ledger (Dated Registry)
          </span>
          <span className="text-xs text-[#64748B] tabular-nums">
            Showing {notices.length} of {totalNotices} records
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#64748B]">Loading notices from database...</div>
        ) : notices.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            No notices match the selected criteria.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {notices.map((n) => {
              const isPinned = Boolean(n.is_pinned);
              const catColor = CATEGORY_COLORS[n.category] || CATEGORY_COLORS.GENERAL;

              return (
                <article
                  key={n.notice_id}
                  className={`p-6 transition-colors hover:bg-[#F8FAFC] ${
                    isPinned ? 'bg-[#F0F4FF]/50 border-l-4 border-l-[#2F5BD6]' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isPinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#2F5BD6] text-white shadow-xs">
                          <Pin className="w-3 h-3 fill-current" strokeWidth={1.75} />
                          PINNED
                        </span>
                      )}

                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-semibold border"
                        style={{
                          backgroundColor: catColor.bg,
                          color: catColor.text,
                          borderColor: catColor.border,
                        }}
                      >
                        {n.category.replace('_', ' ')}
                      </span>

                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                        {n.hostel_name ? n.hostel_name : 'Campus Wide'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                      <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>
                        {n.starts_at ? new Date(n.starts_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Immediate'}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-[#0F172A] mb-1">{n.title}</h3>

                  <p className="text-xs text-[#475569] leading-relaxed mb-3 whitespace-pre-line">
                    {n.body || 'No additional details provided in this notice.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] text-[#64748B] pt-2 border-t border-dashed border-[#E2E8F0]">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#2F5BD6]" strokeWidth={1.75} />
                      <span>Issued by: <strong>{n.posted_by_name || 'Hostel Administration'}</strong></span>
                    </div>

                    {n.ends_at && (
                      <div className="flex items-center gap-1.5 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-[#D97706]" strokeWidth={1.75} />
                        <span>Valid until: {new Date(n.ends_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                </article>
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

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
              <h3 className="font-bold text-base text-[#0F172A]">Publish Official Circular</h3>
              <button
                onClick={() => setShowPublishModal(false)}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handlePublishSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  Notice Title <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="e.g. Schedule of Overhead Water Tank Cleaning"
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Category</label>
                  <select
                    value={pubCategory}
                    onChange={(e) => setPubCategory(e.target.value as NoticeCategory)}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6] bg-white"
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
                  <label className="block font-semibold text-[#0F172A] mb-1">Hostel Scope</label>
                  <select
                    value={pubHostelId}
                    onChange={(e) => setPubHostelId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6] bg-white"
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
                  <label className="block font-semibold text-[#0F172A] mb-1">Starts At (Date)</label>
                  <input
                    type="date"
                    value={pubStartsAt}
                    onChange={(e) => setPubStartsAt(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Ends At (Date)</label>
                  <input
                    type="date"
                    value={pubEndsAt}
                    onChange={(e) => setPubEndsAt(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Notice Body / Directives</label>
                <textarea
                  rows={4}
                  value={pubBody}
                  onChange={(e) => setPubBody(e.target.value)}
                  placeholder="Enter detailed directives or instructions..."
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinNotice"
                  checked={pubIsPinned}
                  onChange={(e) => setPubIsPinned(e.target.checked)}
                  className="rounded border-[#CBD5E1] text-[#2F5BD6] focus:ring-[#2F5BD6]"
                />
                <label htmlFor="pinNotice" className="font-semibold text-[#0F172A] cursor-pointer">
                  Pin to Top of Registry (High Priority)
                </label>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 border border-[#CBD5E1] rounded font-medium text-[#475569] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#2F5BD6] text-white rounded font-semibold hover:bg-[#1B43A6] disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Publish to Registry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
