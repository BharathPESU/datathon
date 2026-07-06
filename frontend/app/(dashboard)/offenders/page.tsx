"use client";
import { useState, useEffect } from "react";
import { ShieldAlert, Search, Calendar, ChevronRight, Activity, ExternalLink } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

export default function OffendersPage() {
  const [offenders, setOffenders] = useState<any[]>([]);
  const [minCases, setMinCases] = useState(2);
  const [loading, setLoading] = useState(true);
  const [selectedOffender, setSelectedOffender] = useState<any>(null);

  useEffect(() => {
    async function loadOffenders() {
      setLoading(true);
      try {
        const res = await api.risk.repeatOffenders({ min_cases: minCases });
        setOffenders(res.offenders);
        if (res.offenders.length > 0) {
          setSelectedOffender(res.offenders[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadOffenders();
  }, [minCases]);

  const getRiskColor = (score: number) => {
    if (score > 75) return "var(--danger)";
    if (score > 50) return "var(--warning)";
    return "var(--success)";
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold gradient-text">Repeat Offender Recidivism Profiling</h2>
          <p className="text-xs text-[var(--foreground-dim)]">Identifies persistent offenders, ranks recidivism risks, and analyzes offence timelines</p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--foreground-dim)]">Min Offences:</span>
          <select 
            className="input py-1 text-xs w-28 bg-[var(--surface-dim)] border-[var(--border)] text-white outline-none cursor-pointer"
            value={minCases}
            onChange={(e) => setMinCases(parseInt(e.target.value))}
          >
            <option value={2}>2+ Cases</option>
            <option value={3}>3+ Cases</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Repeat Offenders List */}
        <div className="chart-container lg:col-span-2 flex flex-col justify-between max-h-[600px]">
          <div className="mb-4">
            <h3 className="text-sm font-bold">Identified High-Recidivism Individuals</h3>
            <p className="text-xs text-[var(--foreground-dim)]">Click an offender to inspect timeline profile</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
              </div>
            ) : offenders.length === 0 ? (
              <p className="text-xs text-[var(--foreground-dim)] text-center py-12">No offenders found meeting criteria.</p>
            ) : (
              offenders.map((o) => (
                <button
                  key={o.accused_master_id}
                  onClick={() => setSelectedOffender(o)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                    selectedOffender?.accused_master_id === o.accused_master_id
                      ? "bg-[var(--surface-elevated)] border-[var(--primary)]"
                      : "bg-[var(--surface-dim)]/50 border-[var(--border)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-white text-sm">{o.accused_name}</p>
                    <p className="text-[10px] text-[var(--foreground-dim)] font-medium">Accused ID Reference: #{o.accused_master_id}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[var(--foreground-muted)]">{o.case_count} cases</span>
                    <span 
                      className="badge font-bold text-[10px] px-2.5" 
                      style={{ background: `${getRiskColor(o.risk_score)}15`, color: getRiskColor(o.risk_score) }}
                    >
                      Risk: {o.risk_score}%
                    </span>
                    <ChevronRight className="w-4 h-4 text-[var(--foreground-dim)]" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Offender Profile & Timeline */}
        <div className="chart-container flex flex-col justify-between max-h-[600px] overflow-hidden">
          {selectedOffender ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Profile Card */}
              <div className="pb-4 border-b border-[var(--border)] mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white truncate">{selectedOffender.accused_name}</h3>
                  <p className="text-[10px] text-[var(--foreground-dim)] uppercase font-bold tracking-wider">Recidivism profile card</p>
                </div>
                
                {/* Risk score badge */}
                <div 
                  className="p-2 rounded-xl text-center flex flex-col items-center justify-center min-w-[70px]"
                  style={{ background: `${getRiskColor(selectedOffender.risk_score)}12` }}
                >
                  <span className="text-xs font-black" style={{ color: getRiskColor(selectedOffender.risk_score) }}>{selectedOffender.risk_score}%</span>
                  <span className="text-[8px] text-[var(--foreground-dim)] uppercase font-bold mt-0.5">Recidivism</span>
                </div>
              </div>

              {/* Crime timeline */}
              <div className="flex-1 overflow-y-auto pr-1">
                <span className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider mb-4">Case Chronology Timeline</span>
                <div className="border-l border-[var(--border)] pl-4 ml-2 space-y-6 relative">
                  {selectedOffender.cases.map((c: any, i: number) => (
                    <div key={i} className="relative text-xs">
                      {/* Timeline dot */}
                      <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-[var(--primary)] border-2 border-[var(--background)]" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">{c.crime_type}</span>
                          <span className="text-[10px] text-[var(--foreground-dim)] font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {c.date}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--foreground-dim)] truncate">{c.crime_no}</p>
                        
                        {/* Link to case */}
                        <Link 
                          href="/cases" 
                          className="inline-flex items-center gap-1 text-[9px] text-[var(--primary)] hover:text-white mt-1.5 transition-colors"
                        >
                          <span>Inspect docket</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--foreground-dim)] text-xs">
              Select an offender to view timeline profile.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}