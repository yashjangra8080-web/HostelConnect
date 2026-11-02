import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  WashingMachineItem,
  LaundryHistoryItem,
  Role,
} from '../types';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  AlertCircle,
  QrCode,
  History,
  RotateCw,
  Search,
  Printer,
  ChevronLeft,
  ChevronRight,
  Layers,
  Wrench,
} from 'lucide-react';

interface LaundryStatusProps {
  userRole: Role;
  csrfToken: string;
}

export const LaundryStatus: React.FC<LaundryStatusProps> = ({
  userRole,
  csrfToken,
}) => {
  // Machine status states
  const [machines, setMachines] = useState<WashingMachineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [myActiveWash, setMyActiveWash] = useState<WashingMachineItem | null>(null);
  const [selectedHostelId, setSelectedHostelId] = useState<number | null>(null);

  // Tab mode: 'grid' (Floor-plan grid) vs 'history' (Usage log table) vs 'qr' (Staff QR Print sheet)
  const [activeSubTab, setActiveSubTab] = useState<'grid' | 'history' | 'qr'>('grid');

  // Modal dialog states
  const [reportingMachine, setReportingMachine] = useState<WashingMachineItem | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportingLoading, setReportingLoading] = useState(false);

  const [startingMachine, setStartingMachine] = useState<WashingMachineItem | null>(null);
  const [scannedQrCode, setScannedQrCode] = useState('');
  const [startingLoading, setStartingLoading] = useState(false);

  // QR Code Cache for Staff Sheet: machine_id -> dataURL
  const [qrImages, setQrImages] = useState<Record<number, string>>({});

  // History table states
  const [historyItems, setHistoryItems] = useState<LaundryHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // 1. Fetch machines from API
  const fetchMachines = async () => {
    try {
      let url = '/api/laundry/machines';
      if (selectedHostelId && userRole !== 'STUDENT') {
        url += `?hostel_id=${selectedHostelId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMachines(data.machines || []);
        setMyActiveWash(data.myActiveWash || null);
        if (data.hostelId && !selectedHostelId) {
          setSelectedHostelId(data.hostelId);
        }
        setErrorMsg(null);
      } else {
        const err = await res.json();
        setErrorMsg(err.message || 'Failed to load laundry machines.');
      }
    } catch {
      setErrorMsg('Network error while polling laundry status.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch usage history
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(historyPage),
        pageSize: String(historyPageSize),
      });
      if (selectedHostelId && userRole !== 'STUDENT') {
        params.set('hostel_id', String(selectedHostelId));
      }
      if (historyStatusFilter !== 'ALL') {
        params.set('status', historyStatusFilter);
      }
      if (historySearch.trim()) {
        params.set('search', historySearch.trim());
      }

      const res = await fetch(`/api/laundry/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.items || []);
        setHistoryTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed fetching laundry history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 3. 10-Second Polling with 1-Second Local Ticking
  useEffect(() => {
    fetchMachines();

    // 10s API polling
    const pollTimer = setInterval(() => {
      fetchMachines();
    }, 10000);

    // 1s Local countdown ticking
    const tickTimer = setInterval(() => {
      setMachines((prev) =>
        prev.map((m) => {
          if (m.status === 'OCCUPIED' && m.seconds_remaining !== null) {
            const nextSec = Math.max(0, m.seconds_remaining - 1);
            return {
              ...m,
              seconds_remaining: nextSec,
              minutes_remaining: Math.ceil(nextSec / 60),
            };
          }
          return m;
        })
      );
      setMyActiveWash((prev) => {
        if (prev && prev.seconds_remaining !== null) {
          const nextSec = Math.max(0, prev.seconds_remaining - 1);
          return {
            ...prev,
            seconds_remaining: nextSec,
            minutes_remaining: Math.ceil(nextSec / 60),
          };
        }
        return prev;
      });
    }, 1000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(tickTimer);
    };
  }, [selectedHostelId]);

  // Load history when history tab or filters change
  useEffect(() => {
    if (activeSubTab === 'history') {
      fetchHistory();
    }
  }, [activeSubTab, historyPage, historyPageSize, historyStatusFilter, historySearch, selectedHostelId]);

  // Generate QR Images when machines load or QR tab opens
  useEffect(() => {
    if (machines.length > 0) {
      machines.forEach(async (m) => {
        if (!qrImages[m.machine_id] && m.qrPayload) {
          try {
            const url = await QRCode.toDataURL(m.qrPayload, {
              margin: 1,
              width: 140,
              color: { dark: '#0C2054', light: '#FFFFFF' },
            });
            setQrImages((prev) => ({ ...prev, [m.machine_id]: url }));
          } catch (e) {
            console.error('QR generation error:', e);
          }
        }
      });
    }
  }, [machines]);

  // Action: Start Wash
  const handleStartWash = async (machine: WashingMachineItem, customQr?: string) => {
    setStartingLoading(true);
    setErrorMsg(null);
    try {
      const payload: any = {};
      const qrToUse = customQr || scannedQrCode || machine.qrPayload;
      if (qrToUse) {
        payload.qr_payload = qrToUse;
      }

      const res = await fetch(`/api/laundry/${machine.machine_id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Wash started successfully on machine ${machine.label}!`);
        setStartingMachine(null);
        setScannedQrCode('');
        fetchMachines();
      } else {
        setErrorMsg(data.message || 'Failed to start wash cycle.');
      }
    } catch {
      setErrorMsg('Network error starting wash cycle.');
    } finally {
      setStartingLoading(false);
    }
  };

  // Action: Finish Wash
  const handleFinishWash = async (machineId: number, label: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/laundry/${machineId}/finish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Machine ${label} released successfully.`);
        fetchMachines();
        if (activeSubTab === 'history') fetchHistory();
      } else {
        setErrorMsg(data.message || 'Failed to release machine.');
      }
    } catch {
      setErrorMsg('Network error finishing wash.');
    }
  };

  // Action: Caretaker Change Status (FREE / OUT_OF_ORDER)
  const handleChangeStatus = async (machineId: number, newStatus: 'FREE' | 'OUT_OF_ORDER', label: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/laundry/${machineId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Machine ${label} marked as ${newStatus}.`);
        fetchMachines();
      } else {
        setErrorMsg(data.message || 'Failed to update machine status.');
      }
    } catch {
      setErrorMsg('Network error updating status.');
    }
  };

  // Action: Submit Incident Report
  const handleSubmitReport = async () => {
    if (!reportingMachine) return;
    setReportingLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/laundry/${reportingMachine.machine_id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ issue: reportText }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Issue on ${reportingMachine.label} reported to hostel caretaker.`);
        setReportingMachine(null);
        setReportText('');
      } else {
        setErrorMsg(data.message || 'Failed to submit report.');
      }
    } catch {
      setErrorMsg('Network error reporting issue.');
    } finally {
      setReportingLoading(false);
    }
  };

  // Format seconds to mm:ss
  const formatCountdown = (totalSeconds: number | null) => {
    if (totalSeconds === null || totalSeconds === undefined) return '--:--';
    if (totalSeconds <= 0) return '00:00 (Overdue)';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Group machines by Floor
  const machinesByFloor = machines.reduce<Record<number, WashingMachineItem[]>>((acc, m) => {
    const floor = m.floor_no || 1;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(m);
    return acc;
  }, {});

  const floorKeys = Object.keys(machinesByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  // Compute KPI summary
  const totalCount = machines.length;
  const freeCount = machines.filter((m) => m.status === 'FREE').length;
  const occupiedCount = machines.filter((m) => m.status === 'OCCUPIED').length;
  const outOfOrderCount = machines.filter((m) => m.status === 'OUT_OF_ORDER').length;

  return (
    <div className="space-y-6">
      {/* ── Page Header & Sub-Navigation Bar ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Smart Laundry Monitoring & QR Hub
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] uppercase tracking-wider">
              10s Live Polling
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time floor-plan occupancy with pessimistic lock allocation, countdown tracking, and HMAC QR check-in.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('grid')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors ${
              activeSubTab === 'grid'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'bg-white border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Floor Grid</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors ${
              activeSubTab === 'history'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'bg-white border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]'
            }`}
          >
            <History className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Usage History</span>
          </button>

          {(userRole === 'CARETAKER' || userRole === 'ADMIN' || userRole === 'HOSTEL_OFFICE' || userRole === 'WARDEN') && (
            <button
              onClick={() => setActiveSubTab('qr')}
              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-2 transition-colors ${
                activeSubTab === 'qr'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'bg-white border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Staff QR Station</span>
            </button>
          )}

          <button
            onClick={() => fetchMachines()}
            disabled={loading}
            className="p-1.5 rounded border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors"
            title="Refresh Status"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#2F5BD6]' : ''}`} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── Status Alerts ─────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#DC2626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded text-xs text-[#059669] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* ── Persistent 'My Wash' Bar ──────────────────────────────────────── */}
      {myActiveWash && (
        <div className="bg-[#1E3A8A] border border-[#2F5BD6] rounded-lg p-4 text-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-white text-[#1E3A8A] flex items-center justify-center font-bold text-sm shadow-xs">
              {myActiveWash.label}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Active Wash in Progress</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-400 text-slate-900">
                  Floor {myActiveWash.floor_no} • {myActiveWash.hostel_name}
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                Cycle ends at {myActiveWash.expected_end_at ? new Date(myActiveWash.expected_end_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '45 mins'}. Auto-release grace: 5 mins.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-blue-200 block">Remaining Time</span>
              <span className="text-xl font-bold font-mono tracking-tight tabular-nums text-white">
                {formatCountdown(myActiveWash.seconds_remaining)}
              </span>
            </div>
            <button
              onClick={() => handleFinishWash(myActiveWash.machine_id, myActiveWash.label)}
              className="px-4 py-2 bg-white text-[#1E3A8A] hover:bg-blue-50 text-xs font-bold rounded shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Check className="w-4 h-4 text-[#059669]" strokeWidth={2.5} />
              <span>Finish Wash</span>
            </button>
          </div>
        </div>
      )}

      {/* ── KPI Summary Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-[#E2E8F0] rounded-lg">
          <span className="text-xs text-[#64748B] font-medium block">Total Machines</span>
          <span className="text-xl font-bold text-[#0F172A] tabular-nums mt-1 block">{totalCount}</span>
        </div>
        <div className="p-4 bg-white border border-[#E2E8F0] rounded-lg">
          <span className="text-xs text-[#059669] font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            Available (Free)
          </span>
          <span className="text-xl font-bold text-[#059669] tabular-nums mt-1 block">{freeCount}</span>
        </div>
        <div className="p-4 bg-white border border-[#E2E8F0] rounded-lg">
          <span className="text-xs text-[#D97706] font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
            Occupied (Running)
          </span>
          <span className="text-xl font-bold text-[#D97706] tabular-nums mt-1 block">{occupiedCount}</span>
        </div>
        <div className="p-4 bg-white border border-[#E2E8F0] rounded-lg">
          <span className="text-xs text-[#DC2626] font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
            Out of Order
          </span>
          <span className="text-xl font-bold text-[#DC2626] tabular-nums mt-1 block">{outOfOrderCount}</span>
        </div>
      </div>

      {/* ── SUB-TAB 1: Floor-Plan Grid View ─────────────────────────────────── */}
      {activeSubTab === 'grid' && (
        <div className="space-y-6">
          {/* Hostel Switcher (Authorities Only) */}
          {userRole !== 'STUDENT' && (
            <div className="flex items-center gap-2 p-3 bg-white border border-[#E2E8F0] rounded-lg">
              <span className="text-xs font-semibold text-[#475569] mr-2">Filter Hostel:</span>
              {[
                { id: 1, name: 'BH1 (Boys Hostel 1)' },
                { id: 2, name: 'BH2 (Boys Hostel 2)' },
                { id: 3, name: 'GH1 (Girls Hostel 1)' },
                { id: 4, name: 'GH2 (Girls Hostel 2)' },
              ].map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHostelId(h.id)}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    selectedHostelId === h.id
                      ? 'bg-[#1E3A8A] text-white'
                      : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#EEF2FF]'
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}

          {/* Floor Rows */}
          {floorKeys.map((floor) => (
            <div key={floor} className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#2F5BD6]"></div>
                  <h3 className="font-semibold text-sm text-[#0F172A] tracking-tight">
                    Floor {floor} • Laundry Bay
                  </h3>
                </div>
                <span className="text-xs text-[#64748B]">
                  {machinesByFloor[floor]?.length || 0} Machines Installed
                </span>
              </div>

              {/* Machine Grid Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {machinesByFloor[floor].map((m) => {
                  const isFree = m.status === 'FREE';
                  const isOccupied = m.status === 'OCCUPIED';
                  const isOut = m.status === 'OUT_OF_ORDER';

                  return (
                    <div
                      key={m.machine_id}
                      className={`relative bg-white border rounded-lg overflow-hidden transition-shadow hover:shadow-sm flex flex-col justify-between ${
                        isFree
                          ? 'border-[#A7F3D0]'
                          : isOccupied
                          ? 'border-[#FDE68A]'
                          : 'border-[#FECACA]'
                      }`}
                    >
                      {/* Status Stripe */}
                      <div
                        className={`h-1.5 w-full ${
                          isFree
                            ? 'bg-[#059669]'
                            : isOccupied
                            ? 'bg-[#D97706]'
                            : 'bg-[#DC2626]'
                        }`}
                      />

                      <div className="p-4 space-y-3 flex-1">
                        {/* Header: Label and Badge */}
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#0F172A] font-mono tracking-tight">
                            {m.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                              isFree
                                ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                                : isOccupied
                                ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                                : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                            }`}
                          >
                            {m.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Middle: Timer & Student Meta */}
                        <div className="py-2">
                          {isOccupied && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[#64748B] flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-[#D97706]" strokeWidth={1.75} />
                                  Remaining:
                                </span>
                                <span className="font-bold text-[#D97706] font-mono tabular-nums text-sm">
                                  {formatCountdown(m.seconds_remaining)}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#475569] truncate">
                                Resident: <span className="font-mono font-medium">{m.current_student_roll_no || 'Occupied'}</span>
                              </div>
                            </div>
                          )}

                          {isFree && (
                            <div className="text-xs text-[#059669] flex items-center gap-1.5 py-1">
                              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>Ready for 45-min cycle</span>
                            </div>
                          )}

                          {isOut && (
                            <div className="text-xs text-[#DC2626] flex items-center gap-1.5 py-1">
                              <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>Under maintenance / offline</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between gap-2">
                        {/* Student Primary Action */}
                        {isFree ? (
                          <button
                            onClick={() => {
                              setStartingMachine(m);
                              setScannedQrCode(m.qrPayload || '');
                            }}
                            className="flex-1 py-1.5 bg-[#2F5BD6] hover:bg-[#1B43A6] text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" strokeWidth={1.75} />
                            <span>Start Wash</span>
                          </button>
                        ) : m.isMyWash || userRole === 'CARETAKER' || userRole === 'ADMIN' ? (
                          <button
                            onClick={() => handleFinishWash(m.machine_id, m.label)}
                            className="flex-1 py-1.5 bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5 text-[#059669]" strokeWidth={2} />
                            <span>Finish Wash</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 py-1.5 bg-[#F1F5F9] text-[#94A3B8] text-xs font-medium rounded cursor-not-allowed text-center"
                          >
                            In Use
                          </button>
                        )}

                        {/* Report Button */}
                        <button
                          onClick={() => setReportingMachine(m)}
                          className="px-2 py-1.5 bg-white border border-[#E2E8F0] hover:bg-[#FEF2F2] hover:border-[#FECACA] text-[#64748B] hover:text-[#DC2626] rounded text-xs transition-colors"
                          title="Report Machine Issue"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>

                        {/* Caretaker Controls */}
                        {(userRole === 'CARETAKER' || userRole === 'ADMIN') && (
                          <div className="flex items-center gap-1">
                            {m.status !== 'OUT_OF_ORDER' ? (
                              <button
                                onClick={() => handleChangeStatus(m.machine_id, 'OUT_OF_ORDER', m.label)}
                                className="px-2 py-1.5 bg-white border border-[#E2E8F0] hover:bg-[#FEF2F2] text-[#DC2626] rounded text-xs font-medium"
                                title="Mark Out of Order"
                              >
                                <Wrench className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleChangeStatus(m.machine_id, 'FREE', m.label)}
                                className="px-2 py-1.5 bg-white border border-[#E2E8F0] hover:bg-[#ECFDF5] text-[#059669] rounded text-xs font-medium"
                                title="Mark Free"
                              >
                                <Check className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SUB-TAB 2: Usage History Table ─────────────────────────────────── */}
      {activeSubTab === 'history' && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-2xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-semibold text-sm text-[#0F172A]">Washing Machine Usage Ledger</h3>
              <p className="text-xs text-[#64748B]">Audited cycle durations, resident checkouts, and automatic release logs.</p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5" strokeWidth={1.75} />
                <input
                  type="text"
                  placeholder="Search roll/machine..."
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-xs text-[#0F172A] focus:outline-none focus:border-[#2F5BD6]"
                />
              </div>

              <select
                value={historyStatusFilter}
                onChange={(e) => {
                  setHistoryStatusFilter(e.target.value);
                  setHistoryPage(1);
                }}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-xs text-[#475569] font-medium"
              >
                <option value="ALL">All Outcomes</option>
                <option value="FINISHED">Finished (Normal)</option>
                <option value="AUTO_RELEASED">Auto-Released (Overdue)</option>
                <option value="ACTIVE">Currently Active</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569] uppercase font-semibold tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Log ID</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Hostel & Floor</th>
                  <th className="py-2.5 px-3">Resident</th>
                  <th className="py-2.5 px-3">Started (IST)</th>
                  <th className="py-2.5 px-3">Ended (IST)</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">End Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#64748B]">Loading usage ledger...</td>
                  </tr>
                ) : historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#64748B]">No usage records found.</td>
                  </tr>
                ) : (
                  historyItems.map((item) => (
                    <tr key={item.log_id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[#64748B]">#{item.log_id}</td>
                      <td className="py-2.5 px-3 font-bold font-mono text-[#0F172A]">{item.machine_label}</td>
                      <td className="py-2.5 px-3 text-[#475569]">{item.hostel_name} (F{item.floor_no})</td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-medium text-[#0F172A] block">{item.student_roll_no}</span>
                        <span className="text-[11px] text-[#64748B] block truncate max-w-[120px]">{item.student_name}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#475569] whitespace-nowrap">
                        {item.started_at ? new Date(item.started_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#475569] whitespace-nowrap">
                        {item.ended_at ? new Date(item.ended_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : (
                          <span className="text-[#2F5BD6] font-semibold italic">In Progress</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[#0F172A]">
                        {item.duration_minutes} min
                      </td>
                      <td className="py-2.5 px-3">
                        {item.end_reason === 'FINISHED' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                            FINISHED
                          </span>
                        ) : item.end_reason === 'AUTO_RELEASED' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                            AUTO RELEASED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EEF2FF] text-[#2F5BD6] border border-[#CBD5E1]">
                            ACTIVE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] text-xs text-[#64748B]">
            <div>
              Total <span className="font-bold text-[#0F172A] tabular-nums">{historyTotal}</span> records
            </div>
            <div className="flex items-center gap-3">
              <span>
                Page <span className="font-bold text-[#0F172A] tabular-nums">{historyPage}</span> of{' '}
                <span className="font-bold text-[#0F172A] tabular-nums">{Math.ceil(historyTotal / historyPageSize) || 1}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                  className="p-1 rounded border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  disabled={historyPage >= Math.ceil(historyTotal / historyPageSize)}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="p-1 rounded border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 3: Staff QR Station & Printable Stickers ─────────────────── */}
      {activeSubTab === 'qr' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex items-center justify-between shadow-2xs">
            <div>
              <h3 className="font-semibold text-sm text-[#0F172A]">Staff Machine QR Code Station</h3>
              <p className="text-xs text-[#64748B]">
                Cryptographically signed HMAC-SHA256 QR codes for campus washing machines. Facility staff print and stick these onto the physical consoles.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-[#2F5BD6] hover:bg-[#1B43A6] text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Print Stickers</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {machines.map((m) => (
              <div
                key={m.machine_id}
                className="bg-white border-2 border-dashed border-[#CBD5E1] p-4 rounded-lg flex flex-col items-center text-center space-y-3"
              >
                <div className="text-xs font-bold text-[#0F172A] tracking-wider uppercase">
                  NSUT • {m.hostel_name}
                </div>
                <div className="text-sm font-extrabold font-mono text-[#1E3A8A] px-3 py-0.5 rounded bg-blue-50 border border-blue-200">
                  {m.label} • Floor {m.floor_no}
                </div>

                {qrImages[m.machine_id] ? (
                  <img
                    src={qrImages[m.machine_id]}
                    alt={`QR Code for ${m.label}`}
                    className="w-32 h-32 border border-[#E2E8F0] p-1 rounded"
                  />
                ) : (
                  <div className="w-32 h-32 bg-[#F8FAFC] border border-[#E2E8F0] rounded flex items-center justify-center text-[10px] text-[#94A3B8]">
                    Generating...
                  </div>
                )}

                <div className="w-full">
                  <span className="text-[10px] text-[#64748B] block">HMAC Signature</span>
                  <span className="text-[9px] font-mono text-[#0F172A] truncate block bg-[#F8FAFC] p-1 rounded border border-[#E2E8F0]">
                    {m.signature || 'Verified'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: Start Wash & Simulate QR Scan ────────────────────────────── */}
      {startingMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-fade p-4">
          <div className="bg-white border border-[#CBD5E1] rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
                <h3 className="font-semibold text-sm text-[#0F172A]">
                  Start Wash Cycle: {startingMachine.label}
                </h3>
              </div>
              <button onClick={() => setStartingMachine(null)} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
            </div>

            <div className="space-y-3 text-xs text-[#475569]">
              <p>
                You are claiming machine <span className="font-bold text-[#0F172A]">{startingMachine.label}</span> located on <span className="font-bold text-[#0F172A]">Floor {startingMachine.floor_no}</span> of your residential hostel.
              </p>
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Cycle Duration:</span>
                  <span className="font-bold text-[#0F172A]">45 Minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Auto-Release Grace:</span>
                  <span className="font-bold text-[#0F172A]">5 Minutes</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Scanned QR Payload (HMAC Verified):
                </label>
                <textarea
                  rows={2}
                  value={scannedQrCode}
                  onChange={(e) => setScannedQrCode(e.target.value)}
                  className="w-full p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#2F5BD6]"
                />
                <span className="text-[10px] text-[#64748B] mt-0.5 block">
                  Autofilled from physical QR sticker HMAC signature.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setStartingMachine(null)}
                className="px-3 py-1.5 text-xs text-[#475569] hover:bg-[#F8FAFC] border border-[#E2E8F0] rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={startingLoading}
                onClick={() => handleStartWash(startingMachine)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#2F5BD6] hover:bg-[#1B43A6] rounded shadow-2xs transition-colors flex items-center gap-1.5"
              >
                {startingLoading ? 'Verifying & Claiming...' : 'Confirm & Start Wash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Report Machine Issue ─────────────────────────────────────── */}
      {reportingMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-fade p-4">
          <div className="bg-white border border-[#CBD5E1] rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#DC2626]" strokeWidth={1.75} />
                <h3 className="font-semibold text-sm text-[#0F172A]">
                  Report Issue: {reportingMachine.label}
                </h3>
              </div>
              <button onClick={() => setReportingMachine(null)} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
            </div>

            <div className="space-y-3 text-xs text-[#475569]">
              <p>
                Submit maintenance observation for machine <span className="font-bold text-[#0F172A]">{reportingMachine.label}</span>. An immediate alert will be routed to the hostel caretaker.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Describe Problem:
                </label>
                <textarea
                  rows={3}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="e.g. Drainage pipe leaking, loud vibration during spin, door seal damaged..."
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-xs text-[#0F172A] focus:outline-none focus:border-[#2F5BD6]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setReportingMachine(null)}
                className="px-3 py-1.5 text-xs text-[#475569] hover:bg-[#F8FAFC] border border-[#E2E8F0] rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reportingLoading || !reportText.trim()}
                onClick={handleSubmitReport}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#DC2626] hover:bg-red-700 rounded shadow-2xs transition-colors disabled:opacity-40"
              >
                {reportingLoading ? 'Notifying Caretaker...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
