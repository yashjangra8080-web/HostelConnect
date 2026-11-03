import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Search,
  Check,
  AlertCircle,
  Wrench,
  QrCode,
  Printer,
  History,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface WashingMachine {
  machine_id: number;
  hostel_id: number;
  hostel_name: string;
  floor_no: number;
  label: string;
  status: 'FREE' | 'OCCUPIED' | 'OUT_OF_ORDER';
  current_student_id: number | null;
  current_student_roll_no: string | null;
  started_at: string | null;
  expected_end_at: string | null;
  seconds_remaining: number;
  isMyWash: boolean;
  qrPayload?: string;
  signature?: string;
}

interface LaundryLogItem {
  log_id: number;
  machine_id: number;
  machine_label: string;
  hostel_name: string;
  floor_no: number;
  student_roll_no: string;
  student_name: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  end_reason: 'FINISHED' | 'AUTO_RELEASED' | 'ACTIVE';
}

export const LaundryStatus: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role || 'STUDENT';

  // Sub-navigation view: 'grid' | 'history' | 'qr'
  const [activeSubTab, setActiveSubTab] = useState<'grid' | 'history' | 'qr'>('grid');

  // Machines state
  const [machines, setMachines] = useState<WashingMachine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [selectedHostelId, setSelectedHostelId] = useState<number>(1);

  // Start Wash Modal State
  const [startingMachine, setStartingMachine] = useState<WashingMachine | null>(null);
  const [scannedQrCode, setScannedQrCode] = useState<string>('');
  const [startingLoading, setStartingLoading] = useState<boolean>(false);

  // Maintenance Reporting State
  const [reportingMachine, setReportingMachine] = useState<WashingMachine | null>(null);
  const [reportText, setReportText] = useState<string>('');
  const [reportingLoading, setReportingLoading] = useState<boolean>(false);

  // History State
  const [historyItems, setHistoryItems] = useState<LaundryLogItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize] = useState<number>(10);
  const [historyTotal, setHistoryTotal] = useState<number>(0);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');

  // QR Code Image Map
  const [qrImages, setQrImages] = useState<Record<number, string>>({});

  // Fetch Machines Data
  const fetchMachines = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/laundry/machines?hostel_id=${selectedHostelId}`);
      if (!res.ok) throw new Error('Failed to load laundry bay status');
      const data = await res.json();
      setMachines(data.machines || []);
    } catch (err: any) {
      console.error('Error fetching machines:', err);
      setErrorMsg(err.message || 'Unable to connect to laundry sensor API.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch History Ledger
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams({
        page: historyPage.toString(),
        limit: historyPageSize.toString(),
        hostel_id: selectedHostelId.toString(),
      });
      if (historyStatusFilter !== 'ALL') params.append('status', historyStatusFilter);
      if (historySearch.trim()) params.append('search', historySearch.trim());

      const res = await fetch(`/api/laundry/history?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load usage history');
      const data = await res.json();
      setHistoryItems(data.items || []);
      setHistoryTotal(data.total || 0);
    } catch (err: any) {
      console.error('Error fetching laundry history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Periodic polling every 10 seconds
  useEffect(() => {
    fetchMachines();
    const interval = setInterval(() => {
      fetchMachines();
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedHostelId]);

  // Handle local countdown decrement every 1s
  useEffect(() => {
    const timer = setInterval(() => {
      setMachines((prev) =>
        prev.map((m) => {
          if (m.status === 'OCCUPIED' && m.seconds_remaining > 0) {
            return { ...m, seconds_remaining: m.seconds_remaining - 1 };
          }
          return m;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch history when tab opens or page changes
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
              color: { dark: '#000000', light: '#FFFFFF' },
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
  const handleStartWash = async (machine: WashingMachine) => {
    try {
      setStartingLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/laundry/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machine.machine_id,
          qr_code: scannedQrCode.trim() || machine.qrPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to start wash cycle.');
      }
      setSuccessMsg(`Wash successfully started on ${machine.label}! 45-minute cycle allocated.`);
      setStartingMachine(null);
      setScannedQrCode('');
      fetchMachines();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setStartingLoading(false);
    }
  };

  // Action: Finish Wash Early
  const handleFinishWash = async (machineId: number, machineLabel: string) => {
    try {
      setErrorMsg(null);
      const res = await fetch('/api/laundry/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_id: machineId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to release machine');
      setSuccessMsg(`Cycle ended. ${machineLabel} is now FREE for other residents.`);
      fetchMachines();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Action: Report Maintenance
  const handleSubmitReport = async () => {
    if (!reportingMachine || !reportText.trim()) return;
    try {
      setReportingLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/laundry/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: reportingMachine.machine_id,
          description: reportText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit report');
      setSuccessMsg(`Issue logged for ${reportingMachine.label}. Notification routed to caretaker.`);
      setReportingMachine(null);
      setReportText('');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setReportingLoading(false);
    }
  };

  // Action: Staff Status Change (Free vs Out of Order)
  const handleChangeStatus = async (machineId: number, newStatus: 'FREE' | 'OUT_OF_ORDER', label: string) => {
    try {
      setErrorMsg(null);
      const res = await fetch('/api/laundry/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_id: machineId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Status update failed');
      setSuccessMsg(`${label} status updated to ${newStatus}.`);
      fetchMachines();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Format seconds to mm:ss or hh:mm
  const formatCountdown = (totalSecs: number) => {
    if (totalSecs <= 0) return '00:00';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Group machines by floor
  const machinesByFloor = machines.reduce((acc, m) => {
    if (!acc[m.floor_no]) acc[m.floor_no] = [];
    acc[m.floor_no].push(m);
    return acc;
  }, {} as Record<number, WashingMachine[]>);

  const floorKeys = Object.keys(machinesByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  // Check if current user has an active wash
  const myActiveWash = machines.find((m) => m.isMyWash && m.status === 'OCCUPIED');

  // KPI Calculations
  const totalCount = machines.length;
  const freeCount = machines.filter((m) => m.status === 'FREE').length;
  const occupiedCount = machines.filter((m) => m.status === 'OCCUPIED').length;
  const outOfOrderCount = machines.filter((m) => m.status === 'OUT_OF_ORDER').length;

  return (
    <div className="space-y-6">
      {/* ── Page Header & Sub-Navigation Bar ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-extrabold text-black tracking-tight">
              Smart Laundry Monitoring & QR Hub
            </h1>
            <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-heading font-bold bg-saffron text-black border-2 border-black uppercase tracking-wider shadow-hard-sm">
              10s Live Polling
            </span>
          </div>
          <p className="text-xs text-black/70 font-sans mt-1">
            Real-time floor-plan occupancy with pessimistic lock allocation, countdown tracking, and HMAC QR check-in.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('grid')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 border-2 border-black transition-colors ${
              activeSubTab === 'grid'
                ? 'bg-black text-white shadow-hard-sm'
                : 'bg-white text-black hover:bg-saffron'
            }`}
          >
            <Layers className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Floor Grid</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 border-2 border-black transition-colors ${
              activeSubTab === 'history'
                ? 'bg-black text-white shadow-hard-sm'
                : 'bg-white text-black hover:bg-saffron'
            }`}
          >
            <History className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Usage History</span>
          </button>

          {(userRole === 'CARETAKER' || userRole === 'ADMIN' || userRole === 'HOSTEL_OFFICE' || userRole === 'WARDEN') && (
            <button
              onClick={() => setActiveSubTab('qr')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] flex items-center gap-2 border-2 border-black transition-colors ${
                activeSubTab === 'qr'
                  ? 'bg-black text-white shadow-hard-sm'
                  : 'bg-white text-black hover:bg-saffron'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Staff QR Station</span>
            </button>
          )}

          <button
            onClick={() => fetchMachines()}
            disabled={loading}
            className="p-1.5 rounded-[8px] border-2 border-black bg-white text-black hover:bg-saffron transition-colors shadow-hard-sm"
            title="Refresh Status"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-black' : ''}`} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── Status Alerts ─────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="p-3 bg-status-danger-bg border-2 border-black rounded-[4px] text-xs text-black flex items-center justify-between shadow-hard-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-black" strokeWidth={2} />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold ml-2 text-black">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-status-success-bg border-2 border-black rounded-[4px] text-xs text-black flex items-center justify-between shadow-hard-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-black" strokeWidth={2} />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold ml-2 text-black">✕</button>
        </div>
      )}

      {/* ── Persistent 'My Wash' Bar ──────────────────────────────────────── */}
      {myActiveWash && (
        <div className="bg-saffron border-2 border-black rounded-[4px] p-4 text-black shadow-hard-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[4px] bg-white text-black border-2 border-black flex items-center justify-center font-heading font-extrabold text-sm shadow-hard-sm">
              {myActiveWash.label}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-base text-black">Active Wash in Progress</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[4px] bg-black text-white border-2 border-black">
                  Floor {myActiveWash.floor_no} • {myActiveWash.hostel_name}
                </span>
              </div>
              <p className="text-xs text-black/80 font-sans mt-0.5">
                Cycle ends at {myActiveWash.expected_end_at ? new Date(myActiveWash.expected_end_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '45 mins'}. Auto-release grace: 5 mins.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <span className="text-[11px] uppercase font-heading font-bold tracking-wider text-black/70 block">Remaining Time</span>
              <span className="text-xl font-bold font-mono tracking-tight tabular-nums text-black">
                {formatCountdown(myActiveWash.seconds_remaining)}
              </span>
            </div>
            <button
              onClick={() => handleFinishWash(myActiveWash.machine_id, myActiveWash.label)}
              className="px-4 py-2 bg-white text-black border-2 border-black hover:bg-paper text-xs font-heading font-bold rounded-[8px] shadow-hard-sm transition-all flex items-center gap-1.5 whitespace-nowrap active:translate-x-[2px] active:translate-y-[2px]"
            >
              <Check className="w-4 h-4 text-black" strokeWidth={2.5} />
              <span>Finish Wash</span>
            </button>
          </div>
        </div>
      )}

      {/* ── KPI Summary Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border-2 border-black rounded-[4px] shadow-hard">
          <span className="text-xs text-black/70 font-heading font-bold block">Total Machines</span>
          <span className="text-2xl font-heading font-extrabold text-black tabular-nums mt-1 block">{totalCount}</span>
        </div>
        <div className="p-4 bg-white border-2 border-black rounded-[4px] shadow-hard">
          <span className="text-xs text-black font-heading font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-black" strokeWidth={2} />
            Available (Free)
          </span>
          <span className="text-2xl font-heading font-extrabold text-black tabular-nums mt-1 block">{freeCount}</span>
        </div>
        <div className="p-4 bg-white border-2 border-black rounded-[4px] shadow-hard">
          <span className="text-xs text-black font-heading font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-black" strokeWidth={2} />
            Occupied (Running)
          </span>
          <span className="text-2xl font-heading font-extrabold text-black tabular-nums mt-1 block">{occupiedCount}</span>
        </div>
        <div className="p-4 bg-white border-2 border-black rounded-[4px] shadow-hard">
          <span className="text-xs text-black font-heading font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-black" strokeWidth={2} />
            Out of Order
          </span>
          <span className="text-2xl font-heading font-extrabold text-black tabular-nums mt-1 block">{outOfOrderCount}</span>
        </div>
      </div>

      {/* ── SUB-TAB 1: Floor-Plan Grid View ─────────────────────────────────── */}
      {activeSubTab === 'grid' && (
        <div className="space-y-6">
          {/* Hostel Switcher (Authorities Only) */}
          {userRole !== 'STUDENT' && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white border-2 border-black rounded-[4px] shadow-hard">
              <span className="text-xs font-heading font-extrabold text-black mr-2">Filter Hostel:</span>
              {[
                { id: 1, name: 'BH1 (Boys Hostel 1)' },
                { id: 2, name: 'BH2 (Boys Hostel 2)' },
                { id: 3, name: 'GH1 (Girls Hostel 1)' },
                { id: 4, name: 'GH2 (Girls Hostel 2)' },
              ].map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHostelId(h.id)}
                  className={`px-3 py-1 text-xs rounded-[8px] font-heading font-bold border-2 border-black transition-colors ${
                    selectedHostelId === h.id
                      ? 'bg-black text-white shadow-hard-sm'
                      : 'bg-white text-black hover:bg-saffron'
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}

          {/* Floor Rows */}
          {floorKeys.map((floor) => (
            <div key={floor} className="bg-white border-2 border-black rounded-[4px] p-5 shadow-hard space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-saffron border-2 border-black"></div>
                  <h3 className="font-heading font-extrabold text-base text-black tracking-tight">
                    Floor {floor} • Laundry Bay
                  </h3>
                </div>
                <span className="text-xs text-black/70 font-sans font-medium">
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
                      className="relative bg-white border-2 border-black rounded-[4px] overflow-hidden shadow-hard-sm flex flex-col justify-between hover:shadow-hard transition-shadow"
                    >
                      {/* Status Stripe */}
                      <div
                        className={`h-2 w-full border-b-2 border-black ${
                          isFree
                            ? 'bg-status-success-text'
                            : isOccupied
                            ? 'bg-saffron'
                            : 'bg-status-danger-text'
                        }`}
                      />

                      <div className="p-4 space-y-3 flex-1">
                        {/* Header: Label and Badge */}
                        <div className="flex items-center justify-between">
                          <span className="font-heading font-extrabold text-sm text-black font-mono tracking-tight">
                            {m.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-[4px] text-[10px] font-heading font-bold tracking-wide uppercase border-2 border-black ${
                              isFree
                                ? 'bg-status-success-bg text-black'
                                : isOccupied
                                ? 'bg-paper text-black'
                                : 'bg-status-danger-bg text-black'
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
                                <span className="text-black/70 font-sans font-medium flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                                  Remaining:
                                </span>
                                <span className="font-bold text-black font-mono tabular-nums text-sm">
                                  {formatCountdown(m.seconds_remaining)}
                                </span>
                              </div>
                              <div className="text-[11px] text-black/80 font-sans truncate">
                                Resident: <span className="font-mono font-bold text-black">{m.current_student_roll_no || 'Occupied'}</span>
                              </div>
                            </div>
                          )}

                          {isFree && (
                            <div className="text-xs text-black font-sans font-medium flex items-center gap-1.5 py-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                              <span>Ready for 45-min cycle</span>
                            </div>
                          )}

                          {isOut && (
                            <div className="text-xs text-black font-sans font-medium flex items-center gap-1.5 py-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                              <span>Under maintenance / offline</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-3 bg-surface-subtle/20 border-t-2 border-black flex items-center justify-between gap-2">
                        {/* Student Primary Action */}
                        {isFree ? (
                          <button
                            onClick={() => {
                              setStartingMachine(m);
                              setScannedQrCode(m.qrPayload || '');
                            }}
                            className="flex-1 py-1.5 bg-black hover:bg-black/80 text-white text-xs font-heading font-bold rounded-[8px] border-2 border-black flex items-center justify-center gap-1.5 transition-all shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px]"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" strokeWidth={2} />
                            <span>Start Wash</span>
                          </button>
                        ) : m.isMyWash || userRole === 'CARETAKER' || userRole === 'ADMIN' ? (
                          <button
                            onClick={() => handleFinishWash(m.machine_id, m.label)}
                            className="flex-1 py-1.5 bg-white border-2 border-black hover:bg-saffron text-black text-xs font-heading font-bold rounded-[8px] flex items-center justify-center gap-1.5 transition-all shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px]"
                          >
                            <Check className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
                            <span>Finish Wash</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 py-1.5 bg-surface-subtle/40 text-black/60 text-xs font-heading font-bold rounded-[8px] border-2 border-black cursor-not-allowed text-center"
                          >
                            In Use
                          </button>
                        )}

                        {/* Report Button */}
                        <button
                          onClick={() => setReportingMachine(m)}
                          className="px-2 py-1.5 bg-white border-2 border-black hover:bg-status-danger-bg text-black rounded-[8px] text-xs transition-colors shadow-hard-sm"
                          title="Report Machine Issue"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                        </button>

                        {/* Caretaker Controls */}
                        {(userRole === 'CARETAKER' || userRole === 'ADMIN') && (
                          <div className="flex items-center gap-1">
                            {m.status !== 'OUT_OF_ORDER' ? (
                              <button
                                onClick={() => handleChangeStatus(m.machine_id, 'OUT_OF_ORDER', m.label)}
                                className="px-2 py-1.5 bg-white border-2 border-black hover:bg-status-danger-bg text-black rounded-[8px] text-xs font-bold shadow-hard-sm"
                                title="Mark Out of Order"
                              >
                                <Wrench className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleChangeStatus(m.machine_id, 'FREE', m.label)}
                                className="px-2 py-1.5 bg-white border-2 border-black hover:bg-status-success-bg text-black rounded-[8px] text-xs font-bold shadow-hard-sm"
                                title="Mark Free"
                              >
                                <Check className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
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
        <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-xl overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b-2 border-black">
            <div>
              <h3 className="font-heading font-extrabold text-base text-black">Washing Machine Usage Ledger</h3>
              <p className="text-xs text-black/70 font-sans mt-0.5">Audited cycle durations, resident checkouts, and automatic release logs.</p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-black/60 absolute left-2.5 top-2.5" strokeWidth={2} />
                <input
                  type="text"
                  placeholder="Search roll/machine..."
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border-2 border-black rounded-[8px] text-xs text-black font-sans focus:outline-none focus:shadow-hard"
                />
              </div>

              <select
                value={historyStatusFilter}
                onChange={(e) => {
                  setHistoryStatusFilter(e.target.value);
                  setHistoryPage(1);
                }}
                className="px-2.5 py-1.5 bg-white border-2 border-black rounded-[8px] text-xs text-black font-heading font-bold focus:outline-none focus:shadow-hard"
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
                <tr className="bg-surface-subtle border-b-2 border-black text-black uppercase font-heading font-extrabold tracking-wider text-[11px]">
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
              <tbody className="divide-y divide-black">
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-black/70 font-sans">Loading usage ledger...</td>
                  </tr>
                ) : historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-black/70 font-sans">No usage records found.</td>
                  </tr>
                ) : (
                  historyItems.map((item) => (
                    <tr key={item.log_id} className="hover:bg-paper transition-colors text-black">
                      <td className="py-2.5 px-3 font-mono text-black/70">#{item.log_id}</td>
                      <td className="py-2.5 px-3 font-bold font-mono text-black">{item.machine_label}</td>
                      <td className="py-2.5 px-3 text-black font-medium">{item.hostel_name} (F{item.floor_no})</td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-black block">{item.student_roll_no}</span>
                        <span className="text-[11px] text-black/70 block truncate max-w-[120px]">{item.student_name}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-black whitespace-nowrap">
                        {item.started_at ? new Date(item.started_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-black whitespace-nowrap">
                        {item.ended_at ? new Date(item.ended_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : (
                          <span className="text-black font-heading font-extrabold bg-saffron px-1.5 py-0.5 rounded-[4px] border border-black inline-block">In Progress</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-black font-bold">
                        {item.duration_minutes} min
                      </td>
                      <td className="py-2.5 px-3">
                        {item.end_reason === 'FINISHED' ? (
                          <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold bg-status-success-bg text-black border-2 border-black inline-block">
                            FINISHED
                          </span>
                        ) : item.end_reason === 'AUTO_RELEASED' ? (
                          <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold bg-paper text-black border-2 border-black inline-block">
                            AUTO RELEASED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-heading font-bold bg-surface-subtle text-black border-2 border-black inline-block">
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
          <div className="flex items-center justify-between pt-3 border-t-2 border-black text-xs text-black">
            <div>
              Total <span className="font-bold text-black tabular-nums">{historyTotal}</span> records
            </div>
            <div className="flex items-center gap-3">
              <span>
                Page <span className="font-bold text-black tabular-nums">{historyPage}</span> of{' '}
                <span className="font-bold text-black tabular-nums">{Math.ceil(historyTotal / historyPageSize) || 1}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                  className="p-1 rounded-[4px] border-2 border-black bg-white hover:bg-saffron disabled:opacity-40 shadow-hard-sm"
                >
                  <ChevronLeft className="w-4 h-4 text-black" strokeWidth={2} />
                </button>
                <button
                  disabled={historyPage >= Math.ceil(historyTotal / historyPageSize)}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="p-1 rounded-[4px] border-2 border-black bg-white hover:bg-saffron disabled:opacity-40 shadow-hard-sm"
                >
                  <ChevronRight className="w-4 h-4 text-black" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 3: Staff QR Station & Printable Stickers ─────────────────── */}
      {activeSubTab === 'qr' && (
        <div className="space-y-4">
          <div className="bg-white border-2 border-black rounded-[4px] p-5 flex items-center justify-between shadow-hard">
            <div>
              <h3 className="font-heading font-extrabold text-base text-black">Staff Machine QR Code Station</h3>
              <p className="text-xs text-black/70 font-sans mt-0.5">
                Cryptographically signed HMAC-SHA256 QR codes for campus washing machines. Facility staff print and stick these onto the physical consoles.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-black hover:bg-black/80 text-white text-xs font-heading font-bold rounded-[8px] border-2 border-black flex items-center gap-1.5 shadow-hard-sm transition-all active:translate-x-[2px] active:translate-y-[2px]"
            >
              <Printer className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Print Stickers</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {machines.map((m) => (
              <div
                key={m.machine_id}
                className="bg-white border-2 border-black p-4 rounded-[4px] flex flex-col items-center text-center space-y-3 shadow-hard"
              >
                <div className="text-xs font-heading font-extrabold text-black tracking-wider uppercase">
                  NSUT • {m.hostel_name}
                </div>
                <div className="text-sm font-extrabold font-mono text-black px-3 py-0.5 rounded-[4px] bg-saffron border-2 border-black shadow-hard-sm">
                  {m.label} • Floor {m.floor_no}
                </div>

                {qrImages[m.machine_id] ? (
                  <img
                    src={qrImages[m.machine_id]}
                    alt={`QR Code for ${m.label}`}
                    className="w-32 h-32 border-2 border-black p-1 rounded-[4px]"
                  />
                ) : (
                  <div className="w-32 h-32 bg-surface-subtle/20 border-2 border-black rounded-[4px] flex items-center justify-center text-[10px] text-black/60 font-sans">
                    Generating...
                  </div>
                )}

                <div className="w-full">
                  <span className="text-[10px] text-black/70 font-heading font-bold block mb-1">HMAC Signature</span>
                  <span className="text-[9px] font-mono text-black truncate block bg-white p-1 rounded-[4px] border-2 border-black">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border-2 border-black rounded-[4px] max-w-md w-full p-6 shadow-hard-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-black" strokeWidth={2} />
                <h3 className="font-heading font-extrabold text-base text-black">
                  Start Wash Cycle: {startingMachine.label}
                </h3>
              </div>
              <button onClick={() => setStartingMachine(null)} className="text-black font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs text-black font-sans">
              <p>
                You are claiming machine <span className="font-bold text-black font-mono">{startingMachine.label}</span> located on <span className="font-bold text-black">Floor {startingMachine.floor_no}</span> of your residential hostel.
              </p>
              <div className="p-3 bg-surface-subtle/20 border-2 border-black rounded-[4px] space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-black/70">Cycle Duration:</span>
                  <span className="font-bold text-black">45 Minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/70">Auto-Release Grace:</span>
                  <span className="font-bold text-black">5 Minutes</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-black mb-1">
                  Scanned QR Payload (HMAC Verified):
                </label>
                <textarea
                  rows={2}
                  value={scannedQrCode}
                  onChange={(e) => setScannedQrCode(e.target.value)}
                  className="w-full p-2 bg-white border-2 border-black rounded-[8px] text-xs font-mono text-black focus:outline-none focus:shadow-hard"
                />
                <span className="text-[10px] text-black/70 mt-0.5 block">
                  Autofilled from physical QR sticker HMAC signature.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setStartingMachine(null)}
                className="px-3 py-1.5 text-xs text-black hover:bg-paper border-2 border-black rounded-[8px] font-heading font-bold shadow-hard-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={startingLoading}
                onClick={() => handleStartWash(startingMachine)}
                className="px-4 py-1.5 text-xs font-heading font-bold text-white bg-black hover:bg-black/80 rounded-[8px] border-2 border-black shadow-hard-sm transition-all flex items-center gap-1.5 active:translate-x-[2px] active:translate-y-[2px]"
              >
                {startingLoading ? 'Verifying & Claiming...' : 'Confirm & Start Wash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Report Machine Issue ─────────────────────────────────────── */}
      {reportingMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border-2 border-black rounded-[4px] max-w-md w-full p-6 shadow-hard-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-black" strokeWidth={2} />
                <h3 className="font-heading font-extrabold text-base text-black">
                  Report Issue: {reportingMachine.label}
                </h3>
              </div>
              <button onClick={() => setReportingMachine(null)} className="text-black font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs text-black font-sans">
              <p>
                Submit maintenance observation for machine <span className="font-bold text-black font-mono">{reportingMachine.label}</span>. An immediate alert will be routed to the hostel caretaker.
              </p>

              <div>
                <label className="block text-xs font-heading font-bold text-black mb-1">
                  Describe Problem:
                </label>
                <textarea
                  rows={3}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="e.g. Drainage pipe leaking, loud vibration during spin, door seal damaged..."
                  className="w-full p-2.5 bg-white border-2 border-black rounded-[8px] text-xs text-black font-sans focus:outline-none focus:shadow-hard"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setReportingMachine(null)}
                className="px-3 py-1.5 text-xs text-black hover:bg-paper border-2 border-black rounded-[8px] font-heading font-bold shadow-hard-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reportingLoading || !reportText.trim()}
                onClick={handleSubmitReport}
                className="px-4 py-1.5 text-xs font-heading font-bold text-black bg-saffron hover:bg-saffron/80 rounded-[8px] border-2 border-black shadow-hard-sm transition-all disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px]"
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
