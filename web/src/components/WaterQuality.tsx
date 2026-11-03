import React, { useState, useEffect } from 'react';
import {
  Droplets,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Building,
  X,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { WaterTrendResponse, Role } from '../types';

interface WaterQualityProps {
  userRole: Role;
  csrfToken?: string;
}

const HOSTEL_TABS = [
  { id: 1, name: 'BH1 (Aryabhatta)', code: 'BH1' },
  { id: 2, name: 'BH2 (Varahamihira)', code: 'BH2' },
  { id: 3, name: 'GH1 (Kalpana Chawla)', code: 'GH1' },
  { id: 4, name: 'GH2 (Gargi)', code: 'GH2' },
];

export const WaterQuality: React.FC<WaterQualityProps> = ({ userRole, csrfToken }) => {
  const [selectedHostel, setSelectedHostel] = useState(1);
  const [trendData, setTrendData] = useState<WaterTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<'tds' | 'ph' | 'chlorine'>('tds');

  // Log Report Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [logWeekStart, setLogWeekStart] = useState('');
  const [logTds, setLogTds] = useState(380);
  const [logPh, setLogPh] = useState(7.4);
  const [logChlorine, setLogChlorine] = useState(0.35);
  const [logRemarks, setLogRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canLog = ['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'].includes(userRole);

  const fetchTrend = async (hostelId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/water-reports/trend?hostel=${hostelId}`);
      if (res.ok) {
        const data: WaterTrendResponse = await res.json();
        setTrendData(data);
        if (data.hostel_id) setSelectedHostel(data.hostel_id);
      }
    } catch (err) {
      console.error('Failed to fetch water trend data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrend(selectedHostel);
  }, [selectedHostel]);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/water-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify({
          hostel_id: selectedHostel,
          week_start: logWeekStart,
          tds_ppm: Number(logTds),
          ph: Number(logPh),
          chlorine_mgl: Number(logChlorine),
          remarks: logRemarks.trim() || null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to submit report.');
      }

      setShowLogModal(false);
      setLogRemarks('');
      fetchTrend(selectedHostel);
    } catch (err: any) {
      setSubmitError(err.message || 'Error submitting report.');
    } finally {
      setSubmitting(false);
    }
  };

  const limits = trendData?.limits || {
    tdsMax: 500,
    phMin: 6.5,
    phMax: 8.5,
    chlorineMin: 0.20,
    chlorineMax: 0.50,
  };

  const reports = trendData?.reports || [];

  // Render SVG Trend Chart
  const renderTrendChart = () => {
    if (reports.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-xs text-black/70 font-sans">
          No 10-week trend records found for this hostel.
        </div>
      );
    }

    const svgWidth = 800;
    const svgHeight = 240;
    const paddingX = 60;
    const paddingY = 30;
    const plotWidth = svgWidth - paddingX * 2;
    const plotHeight = svgHeight - paddingY * 2;

    let yMin = 0;
    let yMax = 700;
    let safeMin = 0;
    let safeMax = limits.tdsMax;
    let unit = 'ppm';

    if (activeMetric === 'ph') {
      yMin = 5.0;
      yMax = 10.0;
      safeMin = limits.phMin;
      safeMax = limits.phMax;
      unit = 'pH';
    } else if (activeMetric === 'chlorine') {
      yMin = 0.0;
      yMax = 0.8;
      safeMin = limits.chlorineMin;
      safeMax = limits.chlorineMax;
      unit = 'mg/L';
    }

    const getY = (val: number) => {
      const clamped = Math.max(yMin, Math.min(yMax, val));
      const ratio = (clamped - yMin) / (yMax - yMin);
      return svgHeight - paddingY - ratio * plotHeight;
    };

    const getX = (index: number) => {
      if (reports.length <= 1) return paddingX + plotWidth / 2;
      return paddingX + (index / (reports.length - 1)) * plotWidth;
    };

    const safeBandTop = getY(safeMax);
    const safeBandBottom = getY(safeMin);
    const safeBandHeight = Math.abs(safeBandBottom - safeBandTop);

    const points = reports.map((r, i) => {
      let val = r.tds_ppm;
      if (activeMetric === 'ph') val = Number(r.ph);
      else if (activeMetric === 'chlorine') val = Number(r.chlorine_mgl);
      return {
        x: getX(i),
        y: getY(val),
        val,
        verdict: r.verdict,
        week: r.week_start,
      };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-64 select-none">
          {/* Shaded Safe Band */}
          <rect
            x={paddingX}
            y={safeBandTop}
            width={plotWidth}
            height={safeBandHeight}
            fill="#dcfce7"
            opacity="0.9"
          />
          <line
            x1={paddingX}
            y1={safeBandTop}
            x2={svgWidth - paddingX}
            y2={safeBandTop}
            stroke="#000000"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text
            x={svgWidth - paddingX + 5}
            y={safeBandTop + 4}
            fontSize="10"
            fill="#000000"
            fontWeight="bold"
          >
            Safe Max ({safeMax} {unit})
          </text>

          {activeMetric !== 'tds' && (
            <>
              <line
                x1={paddingX}
                y1={safeBandBottom}
                x2={svgWidth - paddingX}
                y2={safeBandBottom}
                stroke="#000000"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
              <text
                x={svgWidth - paddingX + 5}
                y={safeBandBottom + 4}
                fontSize="10"
                fill="#000000"
                fontWeight="bold"
              >
                Safe Min ({safeMin} {unit})
              </text>
            </>
          )}

          {/* Grid lines & Y Axis */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={paddingX}
            y2={svgHeight - paddingY}
            stroke="#000000"
            strokeWidth="2"
          />
          <line
            x1={paddingX}
            y1={svgHeight - paddingY}
            x2={svgWidth - paddingX}
            y2={svgHeight - paddingY}
            stroke="#000000"
            strokeWidth="2"
          />

          {/* Trend Line */}
          <path d={linePath} fill="none" stroke="#000000" strokeWidth="3" />

          {/* Data Points */}
          {points.map((p, idx) => {
            const isUnsafe = p.verdict === 'UNSAFE';
            return (
              <g key={idx}>
                {isUnsafe ? (
                  <>
                    <circle cx={p.x} cy={p.y} r="9" fill="#fee2e2" stroke="#000000" strokeWidth="2" />
                    <circle cx={p.x} cy={p.y} r="4" fill="#ef4444" />
                    <text
                      x={p.x}
                      y={p.y - 12}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#000000"
                    >
                      UNSAFE ({p.val})
                    </text>
                  </>
                ) : (
                  <>
                    <circle cx={p.x} cy={p.y} r="5" fill="#ffbc2e" stroke="#000000" strokeWidth="2" />
                    <text
                      x={p.x}
                      y={p.y - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#000000"
                      fontWeight="bold"
                    >
                      {p.val}
                    </text>
                  </>
                )}

                {/* X-axis week labels */}
                <text
                  x={p.x}
                  y={svgHeight - paddingY + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#000000"
                  fontWeight="bold"
                  className="tabular-nums"
                >
                  W{idx + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Limits Strip */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-black" strokeWidth={2} />
              <h2 className="text-xl font-heading font-extrabold text-black tracking-tight">Water Quality Surveillance</h2>
              <span className="text-xs px-2 py-0.5 rounded-[4px] bg-status-success-bg text-black font-heading font-bold border-2 border-black uppercase tracking-wider shadow-hard-sm">
                Weekly Verified Logs
              </span>
            </div>
            <p className="text-xs text-black/70 font-sans mt-1">
              Continuous monitoring of residential water tanks across NSUT hostels under BIS IS-10500 potable water specifications.
            </p>
          </div>

          {canLog && (
            <button
              onClick={() => {
                setLogWeekStart(new Date().toISOString().slice(0, 10));
                setShowLogModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-[8px] text-xs font-heading font-bold border-2 border-black hover:bg-black/80 transition-all shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px]"
            >
              <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
              <span>Log Weekly Report</span>
            </button>
          )}
        </div>

        {/* Verified Parameters from app_settings Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-surface-subtle/20 border-2 border-black rounded-[4px] shadow-hard-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-[4px] bg-saffron border-2 border-black flex items-center justify-center shrink-0 shadow-hard-sm">
              <ShieldCheck className="w-4 h-4 text-black" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[11px] font-heading font-bold text-black uppercase tracking-wider">TDS Safe Limit</div>
              <div className="text-sm font-heading font-extrabold text-black tabular-nums">
                &le; {limits.tdsMax} ppm
              </div>
              <p className="text-[10px] text-black/70 font-sans">Configured in app_settings (water_tds_max_safe)</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-[4px] bg-saffron border-2 border-black flex items-center justify-center shrink-0 shadow-hard-sm">
              <Activity className="w-4 h-4 text-black" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[11px] font-heading font-bold text-black uppercase tracking-wider">pH Safe Range</div>
              <div className="text-sm font-heading font-extrabold text-black tabular-nums">
                {limits.phMin} &ndash; {limits.phMax} pH
              </div>
              <p className="text-[10px] text-black/70 font-sans">Neutral-alkaline range for municipal tap</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-[4px] bg-saffron border-2 border-black flex items-center justify-center shrink-0 shadow-hard-sm">
              <Droplets className="w-4 h-4 text-black" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[11px] font-heading font-bold text-black uppercase tracking-wider">Residual Chlorine</div>
              <div className="text-sm font-heading font-extrabold text-black tabular-nums">
                &ge; {limits.chlorineMin} mg/L
              </div>
              <p className="text-[10px] text-black/70 font-sans">Standard microbial disinfection buffer</p>
            </div>
          </div>
        </div>

        {/* Hostel Selector Tabs */}
        {userRole !== 'STUDENT' ? (
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t-2 border-black">
            <span className="text-xs font-heading font-extrabold text-black mr-2">Select Hostel:</span>
            {HOSTEL_TABS.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHostel(h.id)}
                className={`px-3 py-1.5 text-xs font-heading font-bold rounded-[8px] border-2 border-black transition-colors ${
                  selectedHostel === h.id
                    ? 'bg-black text-white shadow-hard-sm'
                    : 'bg-white text-black hover:bg-saffron'
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-xs text-black/80 flex items-center gap-1.5 font-sans">
            <Building className="w-3.5 h-3.5 text-black" strokeWidth={2} />
            <span>Viewing surveillance logs for your allotted hostel: <strong className="font-bold text-black">{trendData?.hostel_name || 'Hostel'}</strong></span>
          </div>
        )}
      </div>

      {/* 10-Week Trend Chart Card */}
      <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-black" strokeWidth={2} />
              <h3 className="font-heading font-extrabold text-base text-black">
                10-Week Parameter Trend &mdash; {trendData?.hostel_name || 'Hostel'}
              </h3>
            </div>
            <p className="text-xs text-black/70 font-sans mt-0.5">
              Shaded safe band illustrates statutory limits. Unsafe deviations trigger immediate notification alerts.
            </p>
          </div>

          {/* Metric Selector */}
          <div className="inline-flex rounded-[8px] border-2 border-black p-0.5 bg-white shadow-hard-sm">
            <button
              onClick={() => setActiveMetric('tds')}
              className={`px-3 py-1 text-xs font-heading font-bold rounded-[6px] transition-colors ${
                activeMetric === 'tds' ? 'bg-black text-white shadow-hard-sm' : 'text-black/70 hover:text-black hover:bg-saffron'
              }`}
            >
              TDS (ppm)
            </button>
            <button
              onClick={() => setActiveMetric('ph')}
              className={`px-3 py-1 text-xs font-heading font-bold rounded-[6px] transition-colors ${
                activeMetric === 'ph' ? 'bg-black text-white shadow-hard-sm' : 'text-black/70 hover:text-black hover:bg-saffron'
              }`}
            >
              pH Level
            </button>
            <button
              onClick={() => setActiveMetric('chlorine')}
              className={`px-3 py-1 text-xs font-heading font-bold rounded-[6px] transition-colors ${
                activeMetric === 'chlorine' ? 'bg-black text-white shadow-hard-sm' : 'text-black/70 hover:text-black hover:bg-saffron'
              }`}
            >
              Chlorine (mg/L)
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs text-black/70 font-sans">
            Loading historical trend telemetry...
          </div>
        ) : (
          renderTrendChart()
        )}
      </div>

      {/* Historical Logs Table */}
      <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-xl overflow-hidden">
        <div className="px-6 py-3 bg-surface-subtle border-b-2 border-black flex items-center justify-between">
          <span className="text-xs font-heading font-extrabold text-black uppercase tracking-wider">
            Surveillance Log Registry (Last 10 Weeks)
          </span>
          <span className="text-xs text-black font-mono font-bold tabular-nums">
            {reports.length} Reports Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-surface-subtle/40 text-black font-heading font-extrabold uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3">Week Start</th>
                <th className="px-4 py-3">Hostel</th>
                <th className="px-4 py-3">TDS (ppm)</th>
                <th className="px-4 py-3">pH</th>
                <th className="px-4 py-3">Chlorine (mg/L)</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3">Tested By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {reports.map((r) => {
                const isSafe = r.verdict === 'SAFE';
                return (
                  <tr key={r.report_id} className="hover:bg-paper transition-colors text-black">
                    <td className="px-4 py-3 font-mono font-bold text-black tabular-nums whitespace-nowrap">
                      {new Date(r.week_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-black font-medium">{r.hostel_name}</td>
                    <td className={`px-4 py-3 font-mono font-bold tabular-nums ${r.tds_ppm > limits.tdsMax ? 'text-status-danger-text' : 'text-black'}`}>
                      {r.tds_ppm}
                    </td>
                    <td className={`px-4 py-3 font-mono font-bold tabular-nums ${r.ph < limits.phMin || r.ph > limits.phMax ? 'text-status-danger-text' : 'text-black'}`}>
                      {r.ph}
                    </td>
                    <td className={`px-4 py-3 font-mono font-bold tabular-nums ${r.chlorine_mgl < limits.chlorineMin ? 'text-status-danger-text' : 'text-black'}`}>
                      {r.chlorine_mgl}
                    </td>
                    <td className="px-4 py-3">
                      {isSafe ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-heading font-bold bg-status-success-bg text-black border-2 border-black">
                          <CheckCircle2 className="w-3 h-3 text-black" strokeWidth={2} />
                          SAFE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-heading font-bold bg-status-danger-bg text-black border-2 border-black">
                          <AlertTriangle className="w-3 h-3 text-black" strokeWidth={2} />
                          UNSAFE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-black/80 font-sans max-w-xs truncate" title={r.remarks || ''}>
                      {r.remarks || 'Routine weekly sample'}
                    </td>
                    <td className="px-4 py-3 text-black/70 font-sans">
                      {r.posted_by_name || 'Warden Desk'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Report Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border-2 border-black rounded-[4px] max-w-md w-full p-6 shadow-hard-xl">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
              <h3 className="font-heading font-extrabold text-base text-black">Log Weekly Water Test</h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-black font-bold"
              >
                <X className="w-5 h-5 text-black" strokeWidth={2} />
              </button>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-status-danger-bg border-2 border-black rounded-[4px] text-xs text-black flex items-center gap-2 shadow-hard-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 text-black" strokeWidth={2} />
                <span className="font-medium">{submitError}</span>
              </div>
            )}

            <form onSubmit={handleLogSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-heading font-bold text-black mb-1">Target Hostel</label>
                <select
                  value={selectedHostel}
                  onChange={(e) => setSelectedHostel(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-heading font-bold focus:outline-none focus:shadow-hard"
                >
                  {HOSTEL_TABS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-heading font-bold text-black mb-1">Week Start Date</label>
                <input
                  type="date"
                  required
                  value={logWeekStart}
                  onChange={(e) => setLogWeekStart(e.target.value)}
                  className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-sans focus:outline-none focus:shadow-hard"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-heading font-bold text-black mb-1">TDS (ppm)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={logTds}
                    onChange={(e) => setLogTds(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-mono focus:outline-none focus:shadow-hard"
                  />
                  <span className="text-[10px] text-black/70">&le; 500 ppm safe</span>
                </div>

                <div>
                  <label className="block font-heading font-bold text-black mb-1">pH</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    min={0}
                    max={14}
                    value={logPh}
                    onChange={(e) => setLogPh(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-mono focus:outline-none focus:shadow-hard"
                  />
                  <span className="text-[10px] text-black/70">6.5 - 8.5 safe</span>
                </div>

                <div>
                  <label className="block font-heading font-bold text-black mb-1">Chlorine (mg/L)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min={0}
                    value={logChlorine}
                    onChange={(e) => setLogChlorine(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-mono focus:outline-none focus:shadow-hard"
                  />
                  <span className="text-[10px] text-black/70">&ge; 0.20 mg/L safe</span>
                </div>
              </div>

              <div>
                <label className="block font-heading font-bold text-black mb-1">Remarks / Lab Notes</label>
                <textarea
                  rows={2}
                  value={logRemarks}
                  onChange={(e) => setLogRemarks(e.target.value)}
                  placeholder="e.g. Tank inspection normal, clear sample"
                  className="w-full px-3 py-1.5 border-2 border-black rounded-[8px] bg-white text-black font-sans focus:outline-none focus:shadow-hard"
                />
              </div>

              <div className="pt-3 border-t-2 border-black flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 border-2 border-black rounded-[8px] font-heading font-bold text-black hover:bg-paper shadow-hard-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-black text-white border-2 border-black rounded-[8px] font-heading font-bold hover:bg-black/80 shadow-hard-sm transition-all disabled:opacity-50 active:translate-x-[2px] active:translate-y-[2px]"
                >
                  {submitting ? 'Recording...' : 'Record Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
