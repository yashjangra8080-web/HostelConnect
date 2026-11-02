import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Sun,
  Moon,
  Lock,
  CheckCircle2,
  FileText,
  BedDouble,
  Save,
} from 'lucide-react';
import { Student, StateLookup, CityLookup, Application } from '../types';

interface StudentProfileApplyProps {
  currentStudentRollNo?: string;
}

export const StudentProfileApply: React.FC<StudentProfileApplyProps> = ({
  currentStudentRollNo = '2026UCSDS0001',
}) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [states, setStates] = useState<StateLookup[]>([]);
  const [cities, setCities] = useState<CityLookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Form states
  const [selectedSchoolingState, setSelectedSchoolingState] = useState<number>(1);
  const [selectedHomeState, setSelectedHomeState] = useState<number>(1);
  const [selectedHomeCity, setSelectedHomeCity] = useState<number>(1);
  const [studyHabit, setStudyHabit] = useState<'DAY' | 'NIGHT'>('DAY');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // 1. Fetch lookups
  useEffect(() => {
    fetch('/api/lookups/states')
      .then((res) => res.json())
      .then((data) => setStates(data.states || []))
      .catch((err) => console.error('Error fetching states:', err));
  }, []);

  // 2. Fetch cities when home state changes
  useEffect(() => {
    if (!selectedHomeState) return;
    fetch(`/api/lookups/cities?state_id=${selectedHomeState}`)
      .then((res) => res.json())
      .then((data) => setCities(data.cities || []))
      .catch((err) => console.error('Error fetching cities:', err));
  }, [selectedHomeState]);

  // 3. Fetch student profile
  const loadStudentProfile = async () => {
    setLoading(true);
    try {
      // Find student by roll_no
      const listRes = await fetch(`/api/students?search=${currentStudentRollNo}&limit=1`);
      const listData = await listRes.json();
      if (!listData.items || listData.items.length === 0) {
        throw new Error(`Student ${currentStudentRollNo} not found.`);
      }

      const sSummary = listData.items[0];
      const detailRes = await fetch(`/api/students/${sSummary.student_id}`);
      const sDetail: Student = await detailRes.json();

      setStudent(sDetail);
      setSelectedSchoolingState(sDetail.schooling_state_id);
      setSelectedHomeState(sDetail.home_state_id);
      setSelectedHomeCity(sDetail.home_city_id);
      setStudyHabit(sDetail.study_habit);
      setPhone(sDetail.phone || '');
      setEmail(sDetail.email || '');
    } catch (err: any) {
      console.error('Failed loading student:', err);
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentProfile();
  }, [currentStudentRollNo]);

  // Has the student already submitted an application?
  const hasExistingApplication = Boolean(
    student?.applications && student.applications.length > 0
  );

  const existingApp: Application | undefined = student?.applications?.[0];

  // Save profile changes (contact info & study habit)
  const handleSaveProfile = async () => {
    if (!student) return;
    setSavingProfile(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/students/${student.student_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          email,
          study_habit: studyHabit,
          home_city_id: selectedHomeCity,
          schooling_state_id: selectedSchoolingState,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update student profile.');
      }

      setStatusMessage({
        text: 'Profile and preferences updated successfully.',
        type: 'success',
      });
      loadStudentProfile();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Submit application for active cycle
  const handleSubmitApplication = async () => {
    if (!student) return;
    setSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student.student_id,
          cycle_id: 1, // Cycle 1 (2026-27) or active cycle
          study_habit: studyHabit,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Application submission failed.');
      }

      setStatusMessage({
        text: 'Application submitted successfully! Your home-to-campus distance has been computed.',
        type: 'success',
      });
      loadStudentProfile();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded p-12 text-center text-[#64748B] text-xs">
        Loading student profile and application status...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded p-6 text-center text-[#DC2626] text-xs">
        Student profile not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Alert banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded text-xs font-medium border flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
              : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>×</button>
        </div>
      )}

      {/* Header Profile Summary */}
      <div className="bg-white border border-[#E2E8F0] rounded p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-[#0C2054] text-white flex items-center justify-center font-bold text-base">
              {student.full_name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-heading text-[#0F172A]">
                  {student.full_name}
                </h2>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]">
                  {student.roll_no}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                B.Tech {student.branch} • Batch of {student.batch_year} • Merit Rank #{student.merit_rank}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {student.is_delhi_candidate ? (
              <span className="px-3 py-1 rounded text-xs font-semibold bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                Delhi Candidate
              </span>
            ) : (
              <span className="px-3 py-1 rounded text-xs font-semibold bg-[#EEF2FF] text-[#2F5BD6] border border-[#CBD5E1]">
                Non-Delhi Priority Candidate
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Editable Preferences & City/State Pickers */}
        <div className="bg-white border border-[#E2E8F0] rounded p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
            <h3 className="text-sm font-bold font-heading text-[#0F172A] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
              <span>Location & Preference Settings</span>
            </h3>
          </div>

          {/* Schooling State Picker */}
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1">
              Senior Secondary Schooling State (Priority Determinant)
            </label>
            <select
              value={selectedSchoolingState}
              disabled={hasExistingApplication}
              onChange={(e) => setSelectedSchoolingState(Number(e.target.value))}
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2F5BD6] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {states.map((st) => (
                <option key={st.state_id} value={st.state_id}>
                  {st.state_name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Determines candidate Delhi vs Non-Delhi housing quota under NSUT institutional rules.
            </p>
          </div>

          {/* Home State Picker */}
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1">
              Home Domicile State
            </label>
            <select
              value={selectedHomeState}
              disabled={hasExistingApplication}
              onChange={(e) => setSelectedHomeState(Number(e.target.value))}
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2F5BD6] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {states.map((st) => (
                <option key={st.state_id} value={st.state_id}>
                  {st.state_name}
                </option>
              ))}
            </select>
          </div>

          {/* Home City Picker */}
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1">
              Home City (Used for Haversine Distance)
            </label>
            <select
              value={selectedHomeCity}
              disabled={hasExistingApplication}
              onChange={(e) => setSelectedHomeCity(Number(e.target.value))}
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2F5BD6] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cities.map((c) => (
                <option key={c.city_id} value={c.city_id}>
                  {c.city_name} ({c.latitude}° N, {c.longitude}° E)
                </option>
              ))}
            </select>
          </div>

          {/* Study Habit Selector */}
          <div className="pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#0F172A]">
                Roommate Study Habit Preference
              </label>
              {hasExistingApplication && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Lock className="w-3 h-3" />
                  Locked (Application Exists)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={hasExistingApplication}
                onClick={() => setStudyHabit('DAY')}
                className={`p-3 rounded border text-left transition-colors flex items-center gap-2.5 ${
                  studyHabit === 'DAY'
                    ? 'border-[#2F5BD6] bg-[#EEF2FF] text-[#2F5BD6]'
                    : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                } ${hasExistingApplication ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Sun className="w-5 h-5 text-amber-500" strokeWidth={1.75} />
                <div>
                  <div className="font-bold text-xs">Day Studier</div>
                  <div className="text-[10px] text-[#64748B]">Active 07:00 – 23:00</div>
                </div>
              </button>

              <button
                type="button"
                disabled={hasExistingApplication}
                onClick={() => setStudyHabit('NIGHT')}
                className={`p-3 rounded border text-left transition-colors flex items-center gap-2.5 ${
                  studyHabit === 'NIGHT'
                    ? 'border-[#2F5BD6] bg-[#EEF2FF] text-[#2F5BD6]'
                    : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                } ${hasExistingApplication ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Moon className="w-5 h-5 text-indigo-500" strokeWidth={1.75} />
                <div>
                  <div className="font-bold text-xs">Night Owl</div>
                  <div className="text-[10px] text-[#64748B]">Active 22:00 – 04:00</div>
                </div>
              </button>
            </div>

            {hasExistingApplication ? (
              <p className="text-[11px] text-amber-800 bg-[#FFFBEB] p-2.5 rounded border border-[#FDE68A] mt-2">
                Study habit cannot be modified after an application is filed. Enforced by database trigger <code className="font-mono">trg_students_before_update</code>.
              </p>
            ) : (
              <p className="text-[11px] text-[#64748B] mt-1.5">
                Day studiers share rooms strictly with Day studiers; Night owls share strictly with Night owls.
              </p>
            )}
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E2E8F0]">
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded px-3 py-1.5 text-xs text-[#0F172A]"
                placeholder="+91..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded px-3 py-1.5 text-xs text-[#0F172A]"
                placeholder="student@nsut.ac.in"
              />
            </div>
          </div>

          {!hasExistingApplication && (
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full py-2 bg-[#2F5BD6] hover:bg-[#1B43A6] text-white rounded font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingProfile ? 'Saving...' : 'Save Profile Preferences'}</span>
            </button>
          )}
        </div>

        {/* Right Column: Application Status & Apply Card */}
        <div className="bg-white border border-[#E2E8F0] rounded p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
            <h3 className="text-sm font-bold font-heading text-[#0F172A] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
              <span>Allotment Application</span>
            </h3>
            <span className="text-xs text-[#64748B]">Cycle 2026-27</span>
          </div>

          {hasExistingApplication && existingApp ? (
            /* Application Filed Card */
            <div className="space-y-4">
              <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#059669]" />
                <div>
                  <h4 className="font-bold text-xs text-[#065F46]">Application Active</h4>
                  <p className="text-[11px] text-[#047857]">
                    Submitted on {new Date(existingApp.applied_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-[#0F172A]">
                <div className="flex items-center justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Verification Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      existingApp.verification_status === 'VERIFIED'
                        ? 'bg-[#ECFDF5] text-[#059669]'
                        : existingApp.verification_status === 'REJECTED'
                        ? 'bg-[#FEF2F2] text-[#DC2626]'
                        : 'bg-[#FFFBEB] text-[#D97706]'
                    }`}
                  >
                    {existingApp.verification_status}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Calculated Distance to NSUT:</span>
                  <span className="font-mono font-bold text-sm tabular-nums text-[#0F172A]">
                    {existingApp.distance_km} km
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Assigned Distance Band:</span>
                  <span className="font-bold text-[#2F5BD6]">
                    Band {existingApp.distance_band} (
                    {existingApp.distance_band === 4
                      ? '≥1,000 km'
                      : existingApp.distance_band === 3
                      ? '500–999.99 km'
                      : existingApp.distance_band === 2
                      ? '200–499.99 km'
                      : '<200 km'}
                    )
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Allotment Result:</span>
                  <span className="font-semibold">{existingApp.application_status}</span>
                </div>

                {student.hostel_name && (
                  <div className="p-3 bg-[#EEF2FF] border border-[#CBD5E1] rounded space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#1E3A8A] text-xs">
                      <BedDouble className="w-4 h-4" />
                      <span>Allocated Residence</span>
                    </div>
                    <div className="text-xs text-[#0F172A]">
                      {student.hostel_name} • Room {student.room_no} (Floor {student.floor_no})
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Unapplied Submission Form */
            <div className="space-y-4">
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded text-xs text-[#B45309]">
                You have not yet submitted an application for the current active allotment cycle.
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Candidate Priority:</span>
                  <span className="font-bold">
                    {student.is_delhi_candidate ? 'Delhi Candidate' : 'Non-Delhi (Priority)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Study Habit Selected:</span>
                  <span className="font-bold text-[#2F5BD6]">
                    {studyHabit === 'DAY' ? 'Day Studier' : 'Night Owl'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Campus Destination:</span>
                  <span className="font-semibold">NSUT Dwarka (28.6086° N, 77.0302° E)</span>
                </div>
              </div>

              <button
                onClick={handleSubmitApplication}
                disabled={submitting}
                className="w-full py-2.5 bg-[#059669] hover:bg-[#047857] text-white rounded font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Submit Hostel Application'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
