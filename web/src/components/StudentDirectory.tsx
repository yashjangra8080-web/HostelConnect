import React, { useState, useEffect } from 'react';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  MapPin,
  BedDouble,
  FileCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { Student, KeysetResponse } from '../types.js';

export const StudentDirectory: React.FC = () => {
  // Query parameters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [branch, setBranch] = useState('');
  const [schooling, setSchooling] = useState('');
  const [sortBy, setSortBy] = useState('merit_rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Keyset cursor pagination state
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  // Directory records & loading
  const [data, setData] = useState<KeysetResponse<Student> | null>(null);
  const [loading, setLoading] = useState(false);

  // Detail Drawer state
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentDetail, setStudentDetail] = useState<Student | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch directory page
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '20',
        sort: sortBy,
        order: sortOrder,
      });

      if (search.trim()) params.append('search', search.trim());
      if (gender) params.append('gender', gender);
      if (branch) params.append('branch', branch);
      if (schooling) params.append('schooling', schooling);
      if (currentCursor) params.append('cursor', currentCursor);

      const res = await fetch(`/api/students?${params.toString()}`);
      if (res.ok) {
        const json: KeysetResponse<Student> = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, gender, branch, schooling, sortBy, sortOrder, currentCursor]);

  // Handle Sort Toggle
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentCursor(null);
    setCursorStack([]);
  };

  // Fetch full student detail for the drawer
  useEffect(() => {
    if (selectedStudentId === null) {
      setStudentDetail(null);
      return;
    }

    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/students/${selectedStudentId}`);
        if (res.ok) {
          const json: Student = await res.json();
          setStudentDetail(json);
        }
      } catch (err) {
        console.error('Failed to load student detail:', err);
      } finally {
        setDetailLoading(false);
      }
    };

    fetchDetail();
  }, [selectedStudentId]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/60"
                strokeWidth={2}
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
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border-2 border-black rounded-[8px] text-black placeholder-black/50 font-sans focus:outline-none focus:shadow-hard"
              />
            </div>
            <button
              onClick={() => {
                setSearch(searchInput);
                setCurrentCursor(null);
                setCursorStack([]);
              }}
              className="px-3 py-1.5 text-xs font-heading font-bold bg-black text-white rounded-[8px] border-2 border-black hover:bg-black/80 transition-all shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px]"
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
              className="bg-white border-2 border-black rounded-[8px] px-2.5 py-1.5 font-heading font-bold text-black focus:outline-none focus:shadow-hard"
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
              className="bg-white border-2 border-black rounded-[8px] px-2.5 py-1.5 font-heading font-bold text-black focus:outline-none focus:shadow-hard"
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
              className="bg-white border-2 border-black rounded-[8px] px-2.5 py-1.5 font-heading font-bold text-black focus:outline-none focus:shadow-hard"
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
                className="px-2.5 py-1.5 text-black hover:bg-status-danger-bg rounded-[8px] border-2 border-black font-heading font-bold transition-colors shadow-hard-sm"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-subtle border-b-2 border-black text-black font-heading font-extrabold text-[11px] uppercase tracking-wider select-none">
                <th className="py-2.5 px-4 cursor-pointer hover:text-black" onClick={() => handleSort('roll_no')}>
                  <div className="flex items-center gap-1">
                    <span>Roll Number</span>
                    <ArrowUpDown className="w-3 h-3 text-black" strokeWidth={2} />
                  </div>
                </th>
                <th className="py-2.5 px-4 cursor-pointer hover:text-black" onClick={() => handleSort('full_name')}>
                  <div className="flex items-center gap-1">
                    <span>Full Name</span>
                    <ArrowUpDown className="w-3 h-3 text-black" strokeWidth={2} />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center">Gender</th>
                <th className="py-2.5 px-2 text-center cursor-pointer hover:text-black" onClick={() => handleSort('branch')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Branch</span>
                    <ArrowUpDown className="w-3 h-3 text-black" strokeWidth={2} />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right cursor-pointer hover:text-black" onClick={() => handleSort('merit_rank')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Merit Rank</span>
                    <ArrowUpDown className="w-3 h-3 text-black" strokeWidth={2} />
                  </div>
                </th>
                <th className="py-2.5 px-3">Schooling Priority</th>
                <th className="py-2.5 px-3">Home Location</th>
                <th className="py-2.5 px-3">Residence Allotment</th>
                <th className="py-2.5 px-3 text-center">Study Habit</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-black/70 font-sans">
                    Loading student directory...
                  </td>
                </tr>
              ) : !data?.items || data.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-black/70 font-sans">
                    No students match the criteria.
                  </td>
                </tr>
              ) : (
                data.items.map((s) => (
                  <tr
                    key={s.student_id}
                    onClick={() => setSelectedStudentId(s.student_id)}
                    className="hover:bg-paper cursor-pointer transition-colors text-black"
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-black">
                      {s.roll_no}
                    </td>
                    <td className="py-2.5 px-4 font-heading font-bold text-black">
                      {s.full_name}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.2 text-[10px] font-heading font-bold rounded-[4px] border-2 border-black ${
                          s.gender === 'M'
                            ? 'bg-surface-subtle text-black'
                            : 'bg-saffron text-black'
                        }`}
                      >
                        {s.gender}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-black">
                      {s.branch}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-black">
                      #{s.merit_rank}
                    </td>
                    <td className="py-2.5 px-3">
                      {s.is_delhi_candidate ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold bg-white text-black border-2 border-black">
                          Delhi
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold bg-saffron text-black border-2 border-black">
                          Non-Delhi ({s.schooling_state})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-black font-medium">
                      {s.home_city}, {s.home_state}
                    </td>
                    <td className="py-2.5 px-3">
                      {s.hostel_name ? (
                        <span className="inline-flex items-center gap-1 font-bold text-black">
                          <BedDouble className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                          <span>
                            {s.hostel_name} — Rm {s.room_no}
                          </span>
                        </span>
                      ) : (
                        <span className="text-black/50 italic font-sans">Unallotted</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-heading font-bold border-2 border-black ${
                          s.study_habit === 'DAY'
                            ? 'bg-paper text-black'
                            : 'bg-surface-subtle text-black'
                        }`}
                      >
                        {s.study_habit === 'DAY' ? (
                          <Sun className="w-2.5 h-2.5 text-black" strokeWidth={2} />
                        ) : (
                          <Moon className="w-2.5 h-2.5 text-black" strokeWidth={2} />
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
                        className="px-2.5 py-1 text-[11px] font-heading font-bold text-black bg-white hover:bg-saffron rounded-[8px] border-2 border-black transition-colors shadow-hard-sm"
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
        <div className="bg-surface-subtle/20 border-t-2 border-black px-4 py-3 flex items-center justify-between text-xs text-black">
          <div>
            Showing{' '}
            <strong className="font-bold text-black tabular-nums">
              {data?.items ? data.items.length : 0}
            </strong>{' '}
            of{' '}
            <strong className="font-bold text-black tabular-nums">
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
              className="px-2.5 py-1.5 border-2 border-black rounded-[8px] bg-white font-heading font-bold text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-saffron flex items-center gap-1 shadow-hard-sm"
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
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
              className="px-2.5 py-1.5 border-2 border-black rounded-[8px] bg-white font-heading font-bold text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-saffron flex items-center gap-1 shadow-hard-sm"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Detail Drawer */}
      {selectedStudentId !== null && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 transition-opacity"
            onClick={() => setSelectedStudentId(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-white shadow-hard-xl border-l-2 border-black flex flex-col z-50 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b-2 border-black flex items-center justify-between bg-surface-subtle">
              <div>
                <span className="text-[11px] font-mono font-bold text-black uppercase tracking-wider">
                  Student Record
                </span>
                <h3 className="text-lg font-heading font-extrabold text-black">
                  {detailLoading ? 'Loading profile...' : studentDetail?.full_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedStudentId(null)}
                className="w-8 h-8 rounded-[8px] border-2 border-black bg-white hover:bg-status-danger-bg text-black flex items-center justify-center transition-colors shadow-hard-sm"
              >
                <X className="w-4 h-4 text-black" strokeWidth={2} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-black">
              {detailLoading || !studentDetail ? (
                <div className="py-20 text-center text-black/70 font-sans">Loading student details...</div>
              ) : (
                <>
                  {/* Academic Profile Card */}
                  <div className="bg-white border-2 border-black rounded-[4px] p-4 space-y-3 shadow-hard-sm">
                    <h4 className="text-xs font-heading font-extrabold text-black uppercase tracking-wider border-b-2 border-black pb-1.5 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                      Academic & Identity
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-black/70 font-sans block">Roll Number</span>
                        <span className="font-mono font-bold text-black text-sm">
                          {studentDetail.roll_no}
                        </span>
                      </div>
                      <div>
                        <span className="text-black/70 font-sans block">Merit Rank</span>
                        <span className="font-mono font-bold text-black text-sm">
                          #{studentDetail.merit_rank}
                        </span>
                      </div>
                      <div>
                        <span className="text-black/70 font-sans block">Branch & Batch</span>
                        <span className="font-heading font-bold text-black">
                          {studentDetail.branch} ({studentDetail.batch_year})
                        </span>
                      </div>
                      <div>
                        <span className="text-black/70 font-sans block">Gender</span>
                        <span className="font-heading font-bold text-black">
                          {studentDetail.gender === 'M' ? 'Male (M)' : 'Female (F)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Schooling & Domicile */}
                  <div className="bg-white border-2 border-black rounded-[4px] p-4 space-y-3 shadow-hard-sm">
                    <h4 className="text-xs font-heading font-extrabold text-black uppercase tracking-wider border-b-2 border-black pb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                      Domicile & Geolocation
                    </h4>
                    <div className="space-y-2 font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-black/70">Schooling State:</span>
                        <span className="font-bold text-black">
                          {studentDetail.schooling_state}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-black/70">Priority Allocation:</span>
                        {studentDetail.is_delhi_candidate ? (
                          <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold bg-white border-2 border-black text-black">
                            Delhi Candidate
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold bg-saffron border-2 border-black text-black">
                            Non-Delhi (Prioritized)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-black/70">Home City & State:</span>
                        <span className="font-bold text-black">
                          {studentDetail.home_city}, {studentDetail.home_state}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-black/70">Coordinates:</span>
                        <span className="font-bold text-black">
                          {studentDetail.home_latitude.toFixed(4)}° N, {studentDetail.home_longitude.toFixed(4)}° E
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-black/70">Study Habit:</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-heading font-bold text-[10px] border-2 border-black ${
                            studentDetail.study_habit === 'DAY'
                              ? 'bg-paper text-black'
                              : 'bg-surface-subtle text-black'
                          }`}
                        >
                          {studentDetail.study_habit === 'DAY' ? 'Day Studier' : 'Night Owl'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Residence & Room */}
                  <div className="bg-white border-2 border-black rounded-[4px] p-4 space-y-3 shadow-hard-sm">
                    <h4 className="text-xs font-heading font-extrabold text-black uppercase tracking-wider border-b-2 border-black pb-1.5 flex items-center gap-1.5">
                      <BedDouble className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                      Current Residence
                    </h4>
                    {studentDetail.hostel_name ? (
                      <div className="space-y-2 font-sans">
                        <div className="flex items-center justify-between">
                          <span className="text-black/70">Hostel:</span>
                          <span className="font-bold text-black">{studentDetail.hostel_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-black/70">Room Number:</span>
                          <span className="font-mono font-bold text-black">
                            Room {studentDetail.room_no} (Floor {studentDetail.floor_no})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-black/70">Allotment Status:</span>
                          <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold bg-status-success-bg text-black border-2 border-black">
                            {studentDetail.allotment_status}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-black/70 font-sans italic">
                        No active room allotment assigned.
                      </p>
                    )}
                  </div>

                  {/* Application History */}
                  <div className="bg-white border-2 border-black rounded-[4px] p-4 space-y-3 shadow-hard-sm">
                    <h4 className="text-xs font-heading font-extrabold text-black uppercase tracking-wider border-b-2 border-black pb-1.5 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                      Allotment Applications
                    </h4>
                    {!studentDetail.applications || studentDetail.applications.length === 0 ? (
                      <p className="text-xs text-black/70 font-sans italic">No applications filed yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {studentDetail.applications.map((app) => (
                          <div
                            key={app.application_id}
                            className="p-3 border-2 border-black rounded-[4px] bg-surface-subtle/20 space-y-1.5 text-[11px]"
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span>Cycle: {app.academic_year}</span>
                              <span
                                className={`px-2 py-0.5 rounded-[4px] text-[10px] font-heading font-bold border-2 border-black ${
                                  app.verification_status === 'VERIFIED'
                                    ? 'bg-status-success-bg text-black'
                                    : app.verification_status === 'REJECTED'
                                    ? 'bg-status-danger-bg text-black'
                                    : 'bg-paper text-black'
                                }`}
                              >
                                {app.verification_status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-black/70">Distance to NSUT:</span>
                              <span className="font-mono font-bold text-black">
                                {app.distance_km} km (Band {app.distance_band})
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-black/70">Status:</span>
                              <span className="font-bold text-black">{app.application_status}</span>
                            </div>
                            {app.verified_by_name && (
                              <div className="flex items-center justify-between text-black/70">
                                <span>Verified by:</span>
                                <span className="font-medium text-black">{app.verified_by_name}</span>
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
            <div className="p-4 border-t-2 border-black bg-white flex justify-end">
              <button
                onClick={() => setSelectedStudentId(null)}
                className="px-4 py-2 text-xs font-heading font-bold bg-white border-2 border-black text-black rounded-[8px] hover:bg-paper transition-colors shadow-hard-sm"
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
