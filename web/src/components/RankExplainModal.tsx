import React, { useEffect, useState } from 'react';
import { X, Award, MapPin, Hash, Clock, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { RankExplanation } from '../types';

interface RankExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RankExplainModal: React.FC<RankExplainModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<RankExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    fetch('/api/pool/me/explain')
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load rank explanation.');
        }
        return res.json();
      })
      .then((json: RankExplanation) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const keyIcons: Record<string, React.ReactNode> = {
    is_delhi_candidate: <MapPin className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />,
    distance_band: <MapPin className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />,
    merit_rank: <Hash className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />,
    applied_at: <Clock className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#EEF2FF] flex items-center justify-center text-[#2F5BD6]">
              <Award className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm text-[#0F172A]">Why is my rank this?</h3>
              <p className="text-xs text-[#64748B]">Transparent breakdown of the 4-tier NSUT allotment sort key</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading && (
            <div className="py-12 text-center text-xs text-[#64748B]">
              Computing deterministic sorting breakdown...
            </div>
          )}

          {error && (
            <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#DC2626] flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="font-semibold">Unable to explain ranking</p>
                <p className="mt-0.5">{error}</p>
                <p className="mt-1 text-[#64748B]">
                  Ensure you are logged in as a verified applicant who has submitted an application for the active cycle.
                </p>
              </div>
            </div>
          )}

          {data && (
            <>
              {/* Summary Banner */}
              <div
                className={`p-4 rounded-lg border flex items-center justify-between ${
                  data.student.is_seated
                    ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
                    : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {data.student.is_seated ? (
                    <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0" strokeWidth={1.75} />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0" strokeWidth={1.75} />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm">
                        {data.student.is_seated ? 'Ranked Within Seated Quota' : 'Ranked in Waitlist'}
                      </span>
                      <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-white/80 border border-current">
                        {data.student.masked_roll_no}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 opacity-90">
                      {data.student.is_seated
                        ? `Your rank (#${data.student.rank_no}) is within the cut-off rank of #${data.student.cutoff_rank} for ${data.student.gender === 'M' ? 'Boys' : 'Girls'} capacity.`
                        : `Your rank (#${data.student.rank_no}) is beyond the cut-off rank of #${data.student.cutoff_rank}. You are on the active waitlist.`}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-4 border-l border-current/20">
                  <div className="text-[11px] uppercase font-semibold opacity-75">Your Rank</div>
                  <div className="text-xl font-bold font-heading tabular-nums">
                    #{data.student.rank_no}
                    <span className="text-xs font-normal opacity-75"> / {data.total_in_gender_pool}</span>
                  </div>
                </div>
              </div>

              {/* 4 Sort Keys Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Lexicographical Sort Key Progression
                </h4>

                <div className="space-y-2.5">
                  {data.keys.map((k, idx) => (
                    <div
                      key={k.key}
                      className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded bg-white border border-[#CBD5E1] flex items-center justify-center shrink-0 font-heading text-xs font-bold text-[#0F172A] mt-0.5">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {keyIcons[k.key]}
                            <span className="font-semibold text-xs text-[#0F172A]">{k.label}</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-white border border-[#E2E8F0] rounded text-[#475569]">
                              {k.direction}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748B] mt-1">{k.explanation}</p>
                          <div className="mt-2 text-xs flex items-center gap-2">
                            <span className="text-[#64748B]">Your recorded value:</span>
                            <span className="font-mono font-semibold px-2 py-0.5 bg-white border border-[#CBD5E1] rounded text-[#0F172A]">
                              {String(k.value)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 bg-white px-3 py-2 border border-[#E2E8F0] rounded-md">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B] block">
                          Above On Key
                        </span>
                        <span className="text-sm font-bold text-[#0F172A] tabular-nums">
                          {k.higher_count}
                        </span>
                        <span className="text-[10px] text-[#64748B] block">applicants</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legal / Policy Note */}
              <div className="p-3 bg-[#F1F5F9] rounded border border-[#E2E8F0] text-[11px] text-[#475569] leading-relaxed">
                <strong>NSUT Dwarka Hostel Allotment Policy Rule:</strong> All applicants in a cycle are partitioned strictly by gender and ordered by:
                1) Outside Delhi candidates prioritized before Delhi candidates (`is_delhi_candidate ASC`),
                2) Distance band from Dwarka campus (`distance_band DESC`),
                3) Merit entrance rank (`merit_rank ASC`), and
                4) Application submission timestamp (`applied_at ASC`) as the tiebreaker.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
          >
            Close Explanation
          </button>
        </div>
      </div>
    </div>
  );
};
