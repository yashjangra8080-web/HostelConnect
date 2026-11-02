import React, { useState, useEffect } from 'react';
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Moon,
  Sun,
  BedDouble,
  FileCheck,
  ArrowUpDown,
} from 'lucide-react';
import { Student, KeysetResponse } from '../types';

export const StudentDirectory: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [branch, setBranch] = useState('');
  const [schooling, setSchooling] = useState('');
  const [sortBy, setSortBy] = useState<'roll_no' | 'full_name' | 'merit_rank' | 'branch'>('roll_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: 'roll_no' | 'full_name' | 'merit_rank' | 'branch') => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentCursor(null);
    setCursorStack([]);
  };

  // Keyset state
  const [data, setData] = useState<KeysetResponse<Student> | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  // Detail Drawer state
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentDetail, setStudentDetail] = useState<Student | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch directory listing
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('limit', '50');
      q.set('sort_by', sortBy);
      q.set('sort_order', sortOrder);

      if (search) q.set('search', search);
      if (gender) q.set('gender', gender);
      if (branch) q.set('branch', branch);
      if (schooling) q.set('schooling_state', schooling);
      if (currentCursor) q.set('cursor', currentCursor);

      const res = await fetch(`/api/students?${q.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: KeysetResponse<Student> = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, gender, branch, schooling, sortBy, sortOrder, currentCursor]);

  // Fetch individual student details when selected
  useEffect(() => {
    if (!selectedStudentId) {
      setStudentDetail(null);
      return;
    }

    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/students/${selectedStudentId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Student = await res.json();
        setStudentDetail(json);
      } catch (err) {
        console.error('Failed fetching student detail:', err);
      } finally {
        setDetailLoading(false);
      }
    };

    fetchDetail();
  }, [selectedStudentId]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                strokeWidth={1.75}
              />
              <input
                type="text"
                placeholder="Search students by name (FULLTEXT) or roll number prefix..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(searchInput);
                    setCurrentCursor(null);
                    setCursorStack([]);
                  }
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F5BD6]"
              />
            </div>
            <button
              onClick={() => {
                setSearch(searchInput);
                setCurrentCursor(null);
                setCursorStack([]);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-[#2F5BD6] text-white rounded hover:bg-[#1B43A6] transition-colors"
            >
              Search
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Gender filter */}
            <select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                setCurrentCursor(null);
                setCursorStack([]);
              }}
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded px-2.5 py-1.5 font-medium text-[#0F172A] focus:outline-none"
            >
              <option value="">All Genders</option>
              <option value="M">Male (M)</option>
              <option value="F">Female (F)</option>
            </select>

            {/* Branch filter */}
            <select
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value);
                setCurrentCursor(null);
                setCursorStack([]);
              }}
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded px-2.5 py-1.5 font-medium text-[#0F172A] focus:outline-none"
            >
              <option value="">All Branches</option>
              {['CSE', 'CSDS', 'IT', 'ECE', 'EE', 'ME', 'ICE', 'BT', 'MAC', 'EIOT'].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Schooling / Priority filter */}
            <select
              value={schooling}
              onChange={(e) => {
                setSchooling(e.target.value);
                setCurrentCursor(null);
                setCursorStack([]);
              }}
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded px-2.5 py-1.5 font-medium text-[#0F172A] focus:outline-none"
            >
              <option value="">All Domiciles</option>
              <option value="outside_delhi">Non-Delhi (Priority)</option>
              <option value="delhi">Delhi</option>
            </select>

            {/* Reset */}
            {(search || gender || branch || schooling) && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setGender('');
                  setBranch('');
                  setSchooling('');
                  setCurrentCursor(null);
                  setCursorStack([]);
                }}
                className="px-2.5 py-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569] font-semibold text-[11px] uppercase tracking-wider select-none">
                <th className="py-2.5 px-4 cursor-pointer hover:text-[#0F172A]" onClick={() => handleSort('roll_no')}>
                  <div className="flex items-center gap-1">
                    <span>Roll Number</span>
                    <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th className="py-2.5 px-4 cursor-pointer hover:text-[#0F172A]" onClick={() => handleSort('full_name')}>
                  <div className="flex items-center gap-1">
                    <span>Full Name</span>
                    <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center">Gender</th>
                <th className="py-2.5 px-2 text-center cursor-pointer hover:text-[#0F172A]" onClick={() => handleSort('branch')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Branch</span>
                    <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right cursor-pointer hover:text-[#0F172A]" onClick={() => handleSort('merit_rank')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Merit Rank</span>
                    <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Schooling Priority</th>
                <th className="py-2.5 px-3">Home Location</th>
                <th className="py-2.5 px-3">Residence Allotment</th>
                <th className="py-2.5 px-3 text-center">Study Habit</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#64748B]">
                    Loading student directory...
                  </td>
                </tr>
              ) : !data?.items || data.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#64748B]">
                    No students match the criteria.
                  </td>
                </tr>
              ) : (
                data.items.map((s) => (
                  <tr
                    key={s.student_id}
                    onClick={() => setSelectedStudentId(s.student_id)}
                    className="hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-medium text-[#0F172A]">
                      {s.roll_no}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#0F172A]">
                      {s.full_name}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.2 text-[10px] font-bold rounded ${
                          s.gender === 'M'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {s.gender}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-semibold text-[#475569]">
                      {s.branch}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#0F172A]">
                      #{s.merit_rank}
                    </td>
                    <td className="py-2.5 px-3">
                      {s.is_delhi_candidate ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                          Delhi
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EEF2FF] text-[#2F5BD6] border border-[#CBD5E1]">
                          Non-Delhi ({s.schooling_state})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#475569]">
                      {s.home_city}, {s.home_state}
                    </td>
                    <td className="py-2.5 px-3">
                      {s.hostel_name ? (
                        <span className="inline-flex items-center gap-1 font-medium text-[#0F172A]">
                          <BedDouble className="w-3.5 h-3.5 text-[#059669]" />
                          <span>
                            {s.hostel_name} — Rm {s.room_no}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[#94A3B8] italic">Unallotted</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.study_habit === 'DAY'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                        }`}
                      >
                        {s.study_habit === 'DAY' ? (
                          <Sun className="w-2.5 h-2.5 text-amber-600" />
                        ) : (
                          <Moon className="w-2.5 h-2.5 text-indigo-600" />
                        )}
                        <span>{s.study_habit}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudentId(s.student_id);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#2F5BD6] hover:bg-[#EEF2FF] rounded border border-[#CBD5E1] transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Keyset Pagination Toolbar */}
        <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-4 py-3 flex items-center justify-between text-xs text-[#475569]">
          <div>
            Showing{' '}
            <strong className="font-semibold text-[#0F172A] tabular-nums">
              {data?.items ? data.items.length : 0}
            </strong>{' '}
            of{' '}
            <strong className="font-semibold text-[#0F172A] tabular-nums">
              {data?.total ?? 0}
            </strong>{' '}
            students
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (cursorStack.length > 0) {
                  const newStack = [...cursorStack];
                  newStack.pop();
                  const prevCursor = newStack[newStack.length - 1] || null;
                  setCursorStack(newStack);
                  setCurrentCursor(prevCursor);
                }
              }}
              disabled={cursorStack.length === 0 || loading}
              className="px-2.5 py-1.5 border border-[#CBD5E1] rounded bg-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC] flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => {
                if (data?.nextCursor) {
                  setCursorStack((prev) => [...prev, data.nextCursor!]);
                  setCurrentCursor(data.nextCursor);
                }
              }}
              disabled={!data?.hasMore || loading}
              className="px-2.5 py-1.5 border border-[#CBD5E1] rounded bg-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC] flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Detail Drawer */}
      {selectedStudentId !== null && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 transition-opacity"
            onClick={() => setSelectedStudentId(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl border-l border-[#CBD5E1] flex flex-col z-50 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div>
                <span className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">
                  Student Record
                </span>
                <h3 className="text-lg font-bold font-heading text-[#0F172A]">
                  {detailLoading ? 'Loading profile...' : studentDetail?.full_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedStudentId(null)}
                className="w-8 h-8 rounded hover:bg-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[#0F172A]">
              {detailLoading || !studentDetail ? (
                <div className="py-20 text-center text-[#64748B]">Loading student details...</div>
              ) : (
                <>
                  {/* Academic Profile Card */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-4 space-y-3">
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#E2E8F0] pb-1.5 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#2F5BD6]" />
                      Academic & Identity
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[#64748B] block">Roll Number</span>
                        <span className="font-mono font-bold text-[#0F172A] text-sm">
                          {studentDetail.roll_no}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block">Merit Rank</span>
                        <span className="font-mono font-bold text-[#2F5BD6] text-sm">
                          #{studentDetail.merit_rank}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block">Branch & Batch</span>
                        <span className="font-semibold text-[#0F172A]">
                          {studentDetail.branch} ({studentDetail.batch_year})
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block">Gender</span>
                        <span className="font-semibold text-[#0F172A]">
                          {studentDetail.gender === 'M' ? 'Male (M)' : 'Female (F)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Schooling & Domicile */}
                  <div className="bg-white border border-[#E2E8F0] rounded p-4 space-y-3">
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#E2E8F0] pb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#2F5BD6]" />
                      Domicile & Geolocation
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Schooling State:</span>
                        <span className="font-semibold text-[#0F172A]">
                          {studentDetail.schooling_state}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Priority Allocation:</span>
                        {studentDetail.is_delhi_candidate ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563]">
                            Delhi Candidate
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EEF2FF] text-[#2F5BD6]">
                            Non-Delhi (Prioritized)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Home City & State:</span>
                        <span className="font-semibold text-[#0F172A]">
                          {studentDetail.home_city}, {studentDetail.home_state}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-[#64748B]">Coordinates:</span>
                        <span>
                          {studentDetail.home_latitude.toFixed(4)}° N, {studentDetail.home_longitude.toFixed(4)}° E
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Study Habit:</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            studentDetail.study_habit === 'DAY'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-indigo-50 text-indigo-800'
                          }`}
                        >
                          {studentDetail.study_habit === 'DAY' ? 'Day Studier' : 'Night Owl'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Residence & Room */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-4 space-y-3">
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#E2E8F0] pb-1.5 flex items-center gap-1.5">
                      <BedDouble className="w-3.5 h-3.5 text-[#059669]" />
                      Current Residence
                    </h4>
                    {studentDetail.hostel_name ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B]">Hostel:</span>
                          <span className="font-bold text-[#0F172A]">{studentDetail.hostel_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B]">Room Number:</span>
                          <span className="font-mono font-bold text-[#0F172A]">
                            Room {studentDetail.room_no} (Floor {studentDetail.floor_no})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B]">Allotment Status:</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#ECFDF5] text-[#059669]">
                            {studentDetail.allotment_status}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#64748B] italic">
                        No active room allotment assigned.
                      </p>
                    )}
                  </div>

                  {/* Application History */}
                  <div className="bg-white border border-[#E2E8F0] rounded p-4 space-y-3">
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#E2E8F0] pb-1.5 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-[#2F5BD6]" />
                      Allotment Applications
                    </h4>
                    {!studentDetail.applications || studentDetail.applications.length === 0 ? (
                      <p className="text-xs text-[#64748B] italic">No applications filed yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {studentDetail.applications.map((app) => (
                          <div
                            key={app.application_id}
                            className="p-3 border border-[#E2E8F0] rounded bg-[#F8FAFC] space-y-1.5 text-[11px]"
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span>Cycle: {app.academic_year}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  app.verification_status === 'VERIFIED'
                                    ? 'bg-[#ECFDF5] text-[#059669]'
                                    : app.verification_status === 'REJECTED'
                                    ? 'bg-[#FEF2F2] text-[#DC2626]'
                                    : 'bg-[#FFFBEB] text-[#D97706]'
                                }`}
                              >
                                {app.verification_status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#64748B]">Distance to NSUT:</span>
                              <span className="font-mono font-bold">
                                {app.distance_km} km (Band {app.distance_band})
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#64748B]">Status:</span>
                              <span className="font-semibold">{app.application_status}</span>
                            </div>
                            {app.verified_by_name && (
                              <div className="flex items-center justify-between text-[#64748B]">
                                <span>Verified by:</span>
                                <span>{app.verified_by_name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
              <button
                onClick={() => setSelectedStudentId(null)}
                className="px-4 py-2 text-xs font-semibold bg-white border border-[#CBD5E1] text-[#0F172A] rounded hover:bg-[#E2E8F0] transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
