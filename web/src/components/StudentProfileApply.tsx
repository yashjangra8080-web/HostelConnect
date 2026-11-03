import React, { useState, useEffect } from 'react';
import {
  MapPin,
  CheckCircle2,
  FileText,
  Save,
  Lock,
  Sun,
  Moon,
  BedDouble,
} from 'lucide-react';
import { Student, StateLookup, CityLookup, Application } from '../types.js';

interface StudentProfileApplyProps {
  currentStudentRollNo?: string;
}

export const StudentProfileApply: React.FC<StudentProfileApplyProps> = ({ currentStudentRollNo = '2026UCSDS0001' }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [states, setStates] = useState<StateLookup[]>([]);
  const [cities, setCities] = useState<CityLookup[]>([]);
  const [selectedSchoolingState, setSelectedSchoolingState] = useState<number>(1);
  const [selectedHomeState, setSelectedHomeState] = useState<number>(1);
  const [selectedHomeCity, setSelectedHomeCity] = useState<number>(1);
  const [studyHabit, setStudyHabit] = useState<'DAY' | 'NIGHT'>('DAY');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Submission State
  const [savingProfile, setSavingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load Reference Data (States)
  useEffect(() => {
    fetch('/api/lookups/states')
      .then((res) => res.json())
      .then((data) => setStates(data.states || []))
      .catch((err) => console.error('Failed to load states:', err));
  }, []);

  // Load Cities when Home State changes
  useEffect(() => {
    if (selectedHomeState) {
      fetch(`/api/lookups/cities?state_id=${selectedHomeState}`)
        .then((res) => res.json())
        .then((data) => {
          setCities(data.cities || []);
          if (data.cities && data.cities.length > 0) {
            // Pick first city if current selection isn't in list
            if (!data.cities.some((c: CityLookup) => c.city_id === selectedHomeCity)) {
              setSelectedHomeCity(data.cities[0].city_id);
            }
          }
        })
        .catch((err) => console.error('Failed to load cities:', err));
    }
  }, [selectedHomeState]);

  // Load Student Profile & Applications
  const loadStudentProfile = async () => {
    setLoading(true);
    try {
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

  const hasExistingApplication = Boolean(
    student?.applications && student.applications.length > 0
  );
  const existingApp: Application | undefined = student?.applications?.[0];

  // Handle Profile Update
  const handleSaveProfile = async () => {
    if (!student) return;
    setSavingProfile(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/students/${student.student_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schooling_state_id: selectedSchoolingState,
          home_state_id: selectedHomeState,
          home_city_id: selectedHomeCity,
          study_habit: studyHabit,
          phone,
          email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update preferences.');
      }

      setStatusMessage({ text: 'Preferences saved successfully!', type: 'success' });
      loadStudentProfile();
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Application Submit
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
          cycle_id: 1,
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
      <div className="bg-white border-2 border-black rounded-[4px] p-12 text-center text-black/70 font-sans text-xs shadow-hard">
        Loading student profile and application status...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="bg-status-danger-bg border-2 border-black rounded-[4px] p-6 text-center text-black text-xs font-heading font-bold shadow-hard">
        Student profile not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Alert banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-[4px] text-xs font-medium border-2 border-black flex items-center justify-between shadow-hard-sm ${
            statusMessage.type === 'success'
              ? 'bg-status-success-bg text-black'
              : 'bg-status-danger-bg text-black'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Header Profile Summary */}
      <div className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[4px] bg-saffron text-black border-2 border-black flex items-center justify-center font-heading font-extrabold text-base shadow-hard-sm">
              {student.full_name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-heading font-extrabold text-black tracking-tight">
                  {student.full_name}
                </h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-[4px] bg-white border-2 border-black text-black shadow-hard-sm">
                  {student.roll_no}
                </span>
              </div>
              <p className="text-xs text-black/70 font-sans mt-0.5">
                B.Tech {student.branch} • Batch of {student.batch_year} • Merit Rank #{student.merit_rank}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {student.is_delhi_candidate ? (
              <span className="px-3 py-1 rounded-[4px] text-xs font-heading font-bold bg-white text-black border-2 border-black shadow-hard-sm">
                Delhi Candidate
              </span>
            ) : (
              <span className="px-3 py-1 rounded-[4px] text-xs font-heading font-bold bg-saffron text-black border-2 border-black shadow-hard-sm">
                Non-Delhi Priority Candidate
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Editable Preferences & City/State Pickers */}
        <div className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <h3 className="text-sm font-heading font-extrabold text-black flex items-center gap-2">
              <MapPin className="w-4 h-4 text-black" strokeWidth={2} />
              <span>Location & Preference Settings</span>
            </h3>
          </div>

          {/* Schooling State Picker */}
          <div>
            <label className="block text-xs font-heading font-bold text-black mb-1">
              Senior Secondary Schooling State (Priority Determinant)
            </label>
            <select
              value={selectedSchoolingState}
              disabled={hasExistingApplication}
              onChange={(e) => setSelectedSchoolingState(Number(e.target.value))}
              className="w-full bg-white border-2 border-black rounded-[8px] px-3 py-1.5 text-xs text-black font-sans focus:outline-none focus:shadow-hard disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {states.map((st) => (
                <option key={st.state_id} value={st.state_id}>
                  {st.state_name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-black/70 font-sans mt-0.5">
              Determines candidate Delhi vs Non-Delhi housing quota under NSUT institutional rules.
            </p>
          </div>

          {/* Home State Picker */}
          <div>
            <label className="block text-xs font-heading font-bold text-black mb-1">
              Home Domicile State
            </label>
            <select
              value={selectedHomeState}
              disabled={hasExistingApplication}
              onChange={(e) => setSelectedHomeState(Number(e.target.value))}
              className="w-full bg-white border-2 border-black rounded-[8px] px-3 py-1.5 text-xs text-black font-sans focus:outline-none focus:shadow-hard disabled:opacity-60 disabled:cursor-not-allowed"
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
            <label className="block text-xs font-heading font-bold text-black mb-1">
              Home City (Used for Haversine Distance)
            </label>
            <select
              value={selectedHomeCity}
              disabled={hasExistingApplication}
              onChange={(e) => setSelectedHomeCity(Number(e.target.value))}
              className="w-full bg-white border-2 border-black rounded-[8px] px-3 py-1.5 text-xs text-black font-sans focus:outline-none focus:shadow-hard disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cities.map((c) => (
                <option key={c.city_id} value={c.city_id}>
                  {c.city_name} ({c.latitude}° N, {c.longitude}° E)
                </option>
              ))}
            </select>
          </div>

          {/* Study Habit Selector */}
          <div className="pt-2 border-t-2 border-black">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-heading font-bold text-black">
                Roommate Study Habit Preference
              </label>
              {hasExistingApplication && (
                <span className="inline-flex items-center gap-1 text-[11px] text-black bg-paper px-2 py-0.5 rounded-[4px] border-2 border-black font-heading font-bold">
                  <Lock className="w-3 h-3 text-black" strokeWidth={2} />
                  Locked
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={hasExistingApplication}
                onClick={() => setStudyHabit('DAY')}
                className={`p-3 rounded-[8px] border-2 border-black text-left flex items-center gap-2.5 transition-all shadow-hard-sm ${
                  studyHabit === 'DAY'
                    ? 'bg-paper text-black'
                    : 'bg-white text-black hover:bg-paper/40'
                } ${hasExistingApplication ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:translate-x-[2px] active:translate-y-[2px]'}`}
              >
                <Sun className="w-5 h-5 text-black" strokeWidth={2} />
                <div>
                  <div className="font-heading font-bold text-xs">Day Studier</div>
                  <div className="text-[10px] text-black/70 font-sans">Active 07:00 – 23:00</div>
                </div>
              </button>

              <button
                type="button"
                disabled={hasExistingApplication}
                onClick={() => setStudyHabit('NIGHT')}
                className={`p-3 rounded-[8px] border-2 border-black text-left flex items-center gap-2.5 transition-all shadow-hard-sm ${
                  studyHabit === 'NIGHT'
                    ? 'bg-surface-subtle text-black'
                    : 'bg-white text-black hover:bg-surface-subtle/40'
                } ${hasExistingApplication ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:translate-x-[2px] active:translate-y-[2px]'}`}
              >
                <Moon className="w-5 h-5 text-black" strokeWidth={2} />
                <div>
                  <div className="font-heading font-bold text-xs">Night Owl</div>
                  <div className="text-[10px] text-black/70 font-sans">Active 22:00 – 04:00</div>
                </div>
              </button>
            </div>

            {hasExistingApplication ? (
              <p className="text-[11px] text-black bg-paper p-2.5 rounded-[4px] border-2 border-black mt-2 font-sans">
                Study habit cannot be modified after an application is filed. Enforced by database trigger <code className="font-mono font-bold">trg_students_before_update</code>.
              </p>
            ) : (
              <p className="text-[11px] text-black/70 font-sans mt-1.5">
                Day studiers share rooms strictly with Day studiers; Night owls share strictly with Night owls.
              </p>
            )}
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t-2 border-black">
            <div>
              <label className="block text-xs font-heading font-bold text-black mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-[8px] px-3 py-1.5 text-xs text-black font-sans focus:outline-none focus:shadow-hard"
                placeholder="+91..."
              />
            </div>
            <div>
              <label className="block text-xs font-heading font-bold text-black mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-[8px] px-3 py-1.5 text-xs text-black font-sans focus:outline-none focus:shadow-hard"
                placeholder="student@nsut.ac.in"
              />
            </div>
          </div>

          {!hasExistingApplication && (
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full py-2 bg-black hover:bg-black/80 text-white rounded-[8px] border-2 border-black font-heading font-bold text-xs shadow-hard-sm transition-all flex items-center justify-center gap-1.5 active:translate-x-[2px] active:translate-y-[2px]"
            >
              <Save className="w-3.5 h-3.5" strokeWidth={2} />
              <span>{savingProfile ? 'Saving...' : 'Save Profile Preferences'}</span>
            </button>
          )}
        </div>

        {/* Right Column: Application Status & Apply Card */}
        <div className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <h3 className="text-sm font-heading font-extrabold text-black flex items-center gap-2">
              <FileText className="w-4 h-4 text-black" strokeWidth={2} />
              <span>Allotment Application</span>
            </h3>
            <span className="text-xs font-mono font-bold text-black">Cycle 2026-27</span>
          </div>

          {hasExistingApplication && existingApp ? (
            /* Application Filed Card */
            <div className="space-y-4">
              <div className="p-4 bg-status-success-bg border-2 border-black rounded-[4px] flex items-center gap-3 shadow-hard-sm">
                <CheckCircle2 className="w-6 h-6 text-black" strokeWidth={2.5} />
                <div>
                  <h4 className="font-heading font-extrabold text-xs text-black">Application Active</h4>
                  <p className="text-[11px] text-black/80 font-sans">
                    Submitted on {new Date(existingApp.applied_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-black font-sans">
                <div className="flex items-center justify-between py-1.5 border-b border-black/20">
                  <span className="text-black/70">Verification Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold border-2 border-black ${
                      existingApp.verification_status === 'VERIFIED'
                        ? 'bg-status-success-bg text-black'
                        : existingApp.verification_status === 'REJECTED'
                        ? 'bg-status-danger-bg text-black'
                        : 'bg-paper text-black'
                    }`}
                  >
                    {existingApp.verification_status}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-black/20">
                  <span className="text-black/70">Calculated Distance to NSUT:</span>
                  <span className="font-mono font-bold text-sm tabular-nums text-black">
                    {existingApp.distance_km} km
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-black/20">
                  <span className="text-black/70">Assigned Distance Band:</span>
                  <span className="font-heading font-bold text-black">
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

                <div className="flex items-center justify-between py-1.5 border-b border-black/20">
                  <span className="text-black/70">Allotment Result:</span>
                  <span className="font-bold text-black">{existingApp.application_status}</span>
                </div>

                {student.hostel_name && (
                  <div className="p-3 bg-saffron border-2 border-black rounded-[4px] space-y-1 shadow-hard-sm text-black">
                    <div className="flex items-center gap-1.5 font-heading font-extrabold text-xs text-black">
                      <BedDouble className="w-4 h-4 text-black" strokeWidth={2} />
                      <span>Allocated Residence</span>
                    </div>
                    <div className="text-xs text-black font-sans">
                      {student.hostel_name} • Room {student.room_no} (Floor {student.floor_no})
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Unapplied Submission Form */
            <div className="space-y-4">
              <div className="p-3 bg-paper border-2 border-black rounded-[4px] text-xs text-black font-sans shadow-hard-sm">
                You have not yet submitted an application for the current active allotment cycle.
              </div>

              <div className="space-y-2 text-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-black/70">Candidate Priority:</span>
                  <span className="font-bold text-black">
                    {student.is_delhi_candidate ? 'Delhi Candidate' : 'Non-Delhi (Priority)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black/70">Study Habit Selected:</span>
                  <span className="font-bold text-black">
                    {studyHabit === 'DAY' ? 'Day Studier' : 'Night Owl'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black/70">Campus Destination:</span>
                  <span className="font-semibold text-black">NSUT Dwarka (28.6086° N, 77.0302° E)</span>
                </div>
              </div>

              <button
                onClick={handleSubmitApplication}
                disabled={submitting}
                className="w-full py-2.5 bg-black hover:bg-black/80 text-white rounded-[8px] border-2 border-black font-heading font-bold text-xs shadow-hard-sm flex items-center justify-center gap-1.5 transition-all active:translate-x-[2px] active:translate-y-[2px]"
              >
                <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                <span>{submitting ? 'Submitting...' : 'Submit Hostel Application'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
