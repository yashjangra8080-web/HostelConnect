import React, { useEffect, useState } from 'react';
import { X, Award, MapPin, Hash, Clock, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { RankExplanation } from '../types';
import { Button } from './ui/Button.js';

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
    is_delhi_candidate: <MapPin className="w-4 h-4 text-black" strokeWidth={2} />,
    distance_band: <MapPin className="w-4 h-4 text-black" strokeWidth={2} />,
    merit_rank: <Hash className="w-4 h-4 text-black" strokeWidth={2} />,
    applied_at: <Clock className="w-4 h-4 text-black" strokeWidth={2} />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white border-2 border-black rounded-[4px] shadow-hard-lg max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header: font-heading font-extrabold, 2px bottom border */}
        <div className="px-6 py-4 border-b-2 border-black flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[4px] border-2 border-black bg-paper flex items-center justify-center text-black">
              <Award className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-black">Why is my rank this?</h3>
              <p className="text-xs text-black/70 font-medium">Transparent breakdown of the 4-tier NSUT allotment sort key</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[8px] border-2 border-black text-black hover:bg-saffron transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 bg-white">
          {loading && (
            <div className="py-12 text-center text-xs font-bold text-black">
              Computing deterministic sorting breakdown...
            </div>
          )}

          {error && (
            <div className="p-4 bg-status-danger-bg border-2 border-black rounded-[4px] text-xs text-status-danger-text flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.5} />
              <div>
                <p className="font-bold">Unable to explain ranking</p>
                <p className="mt-0.5">{error}</p>
                <p className="mt-1 text-black/70">
                  Ensure you are logged in as a verified applicant who has submitted an application for the active cycle.
                </p>
              </div>
            </div>
          )}

          {data && (
            <>
              {/* Summary Banner */}
              <div
                className={`p-4 rounded-[4px] border-2 border-black flex items-center justify-between shadow-hard-sm ${
                  data.student.is_seated
                    ? 'bg-status-success-bg text-black'
                    : 'bg-status-warning-bg text-black'
                }`}
              >
                <div className="flex items-center gap-3">
                  {data.student.is_seated ? (
                    <CheckCircle2 className="w-5 h-5 text-status-success-text shrink-0" strokeWidth={2.5} />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-status-warning-text shrink-0" strokeWidth={2.5} />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-extrabold text-sm text-black">
                        {data.student.is_seated ? 'Ranked Within Seated Quota' : 'Ranked in Waitlist'}
                      </span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-[4px] bg-white border-2 border-black">
                        {data.student.masked_roll_no}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 text-black font-medium">
                      {data.student.is_seated
                        ? `Your rank (#${data.student.rank_no}) is within the cut-off rank of #${data.student.cutoff_rank} for ${data.student.gender === 'M' ? 'Boys' : 'Girls'} capacity.`
                        : `Your rank (#${data.student.rank_no}) is beyond the cut-off rank of #${data.student.cutoff_rank}. You are on the active waitlist.`}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-4 border-l-2 border-black">
                  <div className="text-[11px] uppercase font-bold text-black/70">Your Rank</div>
                  <div className="text-xl font-heading font-extrabold text-black tabular-nums">
                    #{data.student.rank_no}
                    <span className="text-xs font-normal text-black/75"> / {data.total_in_gender_pool}</span>
                  </div>
                </div>
              </div>

              {/* 4 Sort Keys Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-heading font-extrabold uppercase tracking-wider text-black">
                  Lexicographical Sort Key Progression
                </h4>

                <div className="space-y-2.5">
                  {data.keys.map((k, idx) => (
                    <div
                      key={k.key}
                      className="p-3.5 bg-white border-2 border-black rounded-[4px] shadow-hard-sm flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-[4px] bg-paper border-2 border-black flex items-center justify-center shrink-0 font-heading text-xs font-extrabold text-black mt-0.5">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {keyIcons[k.key]}
                            <span className="font-heading font-bold text-xs text-black">{k.label}</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-white border-2 border-black rounded-[4px] text-black font-bold">
                              {k.direction}
                            </span>
                          </div>
                          <p className="text-xs text-black/80 mt-1 font-medium">{k.explanation}</p>
                          <div className="mt-2 text-xs flex items-center gap-2">
                            <span className="text-black/70 font-medium">Your recorded value:</span>
                            <span className="font-mono font-bold px-2 py-0.5 bg-white border-2 border-black rounded-[4px] text-black">
                              {String(k.value)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 bg-white px-3 py-2 border-2 border-black rounded-[4px]">
                        <span className="text-[10px] uppercase tracking-wider text-black/70 font-bold block">
                          Above On Key
                        </span>
                        <span className="text-sm font-bold text-black tabular-nums">
                          {k.higher_count}
                        </span>
                        <span className="text-[10px] text-black/70 font-medium block">applicants</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legal / Policy Note */}
              <div className="p-3 bg-paper/40 rounded-[4px] border-2 border-black text-[11px] text-black font-medium leading-relaxed">
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
        <div className="px-6 py-3 border-t-2 border-black bg-white flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Explanation
          </Button>
        </div>
      </div>
    </div>
  );
};
