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
        <div className="h-64 flex items-center justify-center text-xs text-[#64748B]">
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
            fill="#ECFDF5"
            opacity="0.8"
          />
          <line
            x1={paddingX}
            y1={safeBandTop}
            x2={svgWidth - paddingX}
            y2={safeBandTop}
            stroke="#10B981"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text
            x={svgWidth - paddingX + 5}
            y={safeBandTop + 4}
            fontSize="10"
            fill="#059669"
            fontWeight="600"
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
                stroke="#10B981"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={svgWidth - paddingX + 5}
                y={safeBandBottom + 4}
                fontSize="10"
                fill="#059669"
                fontWeight="600"
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
            stroke="#CBD5E1"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={svgHeight - paddingY}
            x2={svgWidth - paddingX}
            y2={svgHeight - paddingY}
            stroke="#CBD5E1"
            strokeWidth="1"
          />

          {/* Trend Line */}
          <path d={linePath} fill="none" stroke="#2F5BD6" strokeWidth="2.5" />

          {/* Data Points */}
          {points.map((p, idx) => {
            const isUnsafe = p.verdict === 'UNSAFE';
            return (
              <g key={idx}>
                {isUnsafe ? (
                  <>
                    <circle cx={p.x} cy={p.y} r="8" fill="#FEE2E2" stroke="#DC2626" strokeWidth="1.5" />
                    <circle cx={p.x} cy={p.y} r="4" fill="#DC2626" />
                    <text
                      x={p.x}
                      y={p.y - 12}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#DC2626"
                    >
                      UNSAFE ({p.val})
                    </text>
                  </>
                ) : (
                  <>
                    <circle cx={p.x} cy={p.y} r="4" fill="#2F5BD6" stroke="#FFFFFF" strokeWidth="1.5" />
                    <text
                      x={p.x}
                      y={p.y - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#475569"
                      fontWeight="500"
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
                  fill="#64748B"
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
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-[#2F5BD6]" strokeWidth={1.75} />
              <h2 className="text-xl font-bold font-heading text-[#0F172A]">Water Quality Surveillance</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] font-semibold border border-[#A7F3D0]">
                Weekly Verified Logs
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Continuous monitoring of residential water tanks across NSUT hostels under BIS IS-10500 potable water specifications.
            </p>
          </div>

          {canLog && (
            <button
              onClick={() => {
                setLogWeekStart(new Date().toISOString().slice(0, 10));
                setShowLogModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2F5BD6] text-white rounded text-xs font-semibold hover:bg-[#1B43A6] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              <span>Log Weekly Report</span>
            </button>
          )}
        </div>

        {/* Verified Parameters from app_settings Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-[#EEF2FF] border border-[#CBD5E1] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#64748B] uppercase">TDS Safe Limit</div>
              <div className="text-sm font-bold text-[#0F172A] tabular-nums">
                &le; {limits.tdsMax} ppm
              </div>
              <p className="text-[10px] text-[#64748B]">Configured in app_settings (water_tds_max_safe)</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-[#EEF2FF] border border-[#CBD5E1] flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#64748B] uppercase">pH Safe Range</div>
              <div className="text-sm font-bold text-[#0F172A] tabular-nums">
                {limits.phMin} &ndash; {limits.phMax} pH
              </div>
              <p className="text-[10px] text-[#64748B]">Neutral-alkaline range for municipal tap</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-[#EEF2FF] border border-[#CBD5E1] flex items-center justify-center shrink-0">
              <Droplets className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#64748B] uppercase">Residual Chlorine</div>
              <div className="text-sm font-bold text-[#0F172A] tabular-nums">
                &ge; {limits.chlorineMin} mg/L
              </div>
              <p className="text-[10px] text-[#64748B]">Standard microbial disinfection buffer</p>
            </div>
          </div>
        </div>

        {/* Hostel Selector Tabs */}
        {userRole !== 'STUDENT' ? (
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#E2E8F0]">
            <span className="text-xs font-semibold text-[#475569] mr-2">Select Hostel:</span>
            {HOSTEL_TABS.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHostel(h.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors ${
                  selectedHostel === h.id
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                    : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-xs text-[#475569] flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-[#2F5BD6]" strokeWidth={1.75} />
            <span>Viewing surveillance logs for your allotted hostel: <strong>{trendData?.hostel_name || 'Hostel'}</strong></span>
          </div>
        )}
      </div>

      {/* 10-Week Trend Chart Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0] mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
              <h3 className="font-bold text-sm text-[#0F172A]">
                10-Week Parameter Trend &mdash; {trendData?.hostel_name || 'Hostel'}
              </h3>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Shaded safe band illustrates statutory limits. Unsafe deviations trigger immediate notification alerts.
            </p>
          </div>

          {/* Metric Selector */}
          <div className="inline-flex rounded border border-[#CBD5E1] p-0.5 bg-[#F8FAFC]">
            <button
              onClick={() => setActiveMetric('tds')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                activeMetric === 'tds' ? 'bg-white text-[#2F5BD6] shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              TDS (ppm)
            </button>
            <button
              onClick={() => setActiveMetric('ph')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                activeMetric === 'ph' ? 'bg-white text-[#2F5BD6] shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              pH Level
            </button>
            <button
              onClick={() => setActiveMetric('chlorine')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                activeMetric === 'chlorine' ? 'bg-white text-[#2F5BD6] shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Chlorine (mg/L)
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs text-[#64748B]">
            Loading historical trend telemetry...
          </div>
        ) : (
          renderTrendChart()
        )}
      </div>

      {/* Historical Logs Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
            Surveillance Log Registry (Last 10 Weeks)
          </span>
          <span className="text-xs text-[#64748B] tabular-nums">
            {reports.length} Reports Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] font-semibold">
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
            <tbody className="divide-y divide-[#E2E8F0]">
              {reports.map((r) => {
                const isSafe = r.verdict === 'SAFE';
                return (
                  <tr key={r.report_id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
                      {new Date(r.week_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{r.hostel_name}</td>
                    <td className={`px-4 py-3 font-medium tabular-nums ${r.tds_ppm > limits.tdsMax ? 'text-[#DC2626] font-bold' : 'text-[#0F172A]'}`}>
                      {r.tds_ppm}
                    </td>
                    <td className={`px-4 py-3 font-medium tabular-nums ${r.ph < limits.phMin || r.ph > limits.phMax ? 'text-[#DC2626] font-bold' : 'text-[#0F172A]'}`}>
                      {r.ph}
                    </td>
                    <td className={`px-4 py-3 font-medium tabular-nums ${r.chlorine_mgl < limits.chlorineMin ? 'text-[#DC2626] font-bold' : 'text-[#0F172A]'}`}>
                      {r.chlorine_mgl}
                    </td>
                    <td className="px-4 py-3">
                      {isSafe ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                          <CheckCircle2 className="w-3 h-3" strokeWidth={1.75} />
                          SAFE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                          <AlertTriangle className="w-3 h-3" strokeWidth={1.75} />
                          UNSAFE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#475569] max-w-xs truncate" title={r.remarks || ''}>
                      {r.remarks || 'Routine weekly sample'}
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
              <h3 className="font-bold text-base text-[#0F172A]">Log Weekly Water Test</h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#DC2626] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleLogSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Target Hostel</label>
                <select
                  value={selectedHostel}
                  onChange={(e) => setSelectedHostel(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6] bg-white"
                >
                  {HOSTEL_TABS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Week Start Date</label>
                <input
                  type="date"
                  required
                  value={logWeekStart}
                  onChange={(e) => setLogWeekStart(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">TDS (ppm)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={logTds}
                    onChange={(e) => setLogTds(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                  />
                  <span className="text-[10px] text-[#64748B]">&le; 500 ppm safe</span>
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">pH</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    min={0}
                    max={14}
                    value={logPh}
                    onChange={(e) => setLogPh(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                  />
                  <span className="text-[10px] text-[#64748B]">6.5 - 8.5 safe</span>
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Chlorine (mg/L)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min={0}
                    value={logChlorine}
                    onChange={(e) => setLogChlorine(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                  />
                  <span className="text-[10px] text-[#64748B]">&ge; 0.20 mg/L safe</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Remarks / Lab Notes</label>
                <textarea
                  rows={2}
                  value={logRemarks}
                  onChange={(e) => setLogRemarks(e.target.value)}
                  placeholder="e.g. Tank inspection normal, clear sample"
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2F5BD6]"
                />
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 border border-[#CBD5E1] rounded font-medium text-[#475569] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#2F5BD6] text-white rounded font-semibold hover:bg-[#1B43A6] disabled:opacity-50"
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
