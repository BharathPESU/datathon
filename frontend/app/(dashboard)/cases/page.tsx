"use client";
import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, Eye, ShieldAlert, Users, Scale } from "lucide-react";
import api from "@/lib/api";

export default function CasesPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  
  // Search parameters
  const [crimeNo, setCrimeNo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Selected Case for Modal
  const [activeCase, setActiveCase] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    async function loadCases() {
      setLoading(true);
      try {
        const res = await api.cases.list({
          crime_no: crimeNo || undefined,
          keyword: keyword || undefined,
          page,
          page_size: pageSize
        });
        setCases(res.items);
        setTotal(res.total);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, [page, crimeNo, keyword, pageSize]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset page to 1 on new search
  };

  const handleViewDetails = async (id: number) => {
    try {
      const res = await api.cases.get(id);
      setActiveCase(res);
      setShowModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold gradient-text">Criminal Case Records</h2>
        <p className="text-xs text-[var(--foreground-dim)]">Search, filter, and inspect case dockets and registered FIRs</p>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div className="w-full sm:w-64 space-y-1.5">
            <span className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider">Crime No / FIR No</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-dim)]" />
              <input 
                type="text" 
                placeholder="FIR/KAR/BENG/2026..." 
                className="input pl-9 text-xs py-1.5"
                value={crimeNo}
                onChange={(e) => setCrimeNo(e.target.value)}
              />
            </div>
          </div>

          <div className="w-full sm:w-64 space-y-1.5">
            <span className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider">Keyword Search (Brief facts)</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-dim)]" />
              <input 
                type="text" 
                placeholder="e.g. Basavaraj, theft, murder..." 
                className="input pl-9 text-xs py-1.5"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary py-1.5 text-xs">Filter Records</button>
        </form>
      </div>

      {/* Records Table */}
      <div className="chart-container">
        {loading ? (
          <div className="space-y-3 py-6">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-12 text-[var(--foreground-dim)] text-xs">
            No matching case records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Crime No</th>
                  <th>Registered Date</th>
                  <th>District</th>
                  <th>Station</th>
                  <th>Crime Sub-Head</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.ROWID}>
                    <td className="font-semibold text-white">{c.crime_no}</td>
                    <td>{c.crime_registered_date}</td>
                    <td>{c.district_name}</td>
                    <td>{c.police_station}</td>
                    <td>{c.crime_sub_head}</td>
                    <td>
                      <span className={`badge ${
                        c.status === "Closed" ? "badge-success" :
                        c.status === "Convicted" ? "badge-success" :
                        c.status === "Under Investigation" ? "badge-warning" :
                        "badge-primary"
                      }`}>
                        {c.status || "Under Investigation"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button 
                        onClick={() => handleViewDetails(c.ROWID)}
                        className="p-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--border)] border border-[var(--border)] rounded-lg text-[var(--primary)] hover:text-white transition-colors"
                        title="View Case Files"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 mt-4">
            <span className="text-[11px] text-[var(--foreground-dim)]">
              Showing page <span className="text-white font-semibold">{page}</span> of <span className="text-white font-semibold">{totalPages}</span> ({total} total records)
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary p-1.5 rounded-lg text-xs disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary p-1.5 rounded-lg text-xs disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Case Details Modal */}
      {showModal && activeCase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6 animate-slide-in">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <span className="badge badge-info text-[9px] uppercase tracking-wider mb-1.5">{activeCase.category_name} Docket</span>
                <h3 className="text-lg font-bold text-white">{activeCase.crime_no}</h3>
                <p className="text-[11px] text-[var(--foreground-dim)]">Court Case ID: {activeCase.case_no || "N/A"}</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="btn-secondary py-1 px-2.5 text-xs rounded-lg"
              >
                Close
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">District</span>
                <p className="text-white font-semibold mt-0.5">{activeCase.district_name}</p>
              </div>
              <div>
                <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Station Unit</span>
                <p className="text-white font-semibold mt-0.5">{activeCase.police_station}</p>
              </div>
              <div>
                <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Registered Date</span>
                <p className="text-white font-semibold mt-0.5">{activeCase.crime_registered_date}</p>
              </div>
              <div>
                <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Status</span>
                <span className={`badge mt-0.5 ${
                  activeCase.status === "Closed" ? "badge-success" : "badge-warning"
                }`}>{activeCase.status}</span>
              </div>
            </div>

            {/* Crime Classifications */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--surface-dim)]/50 p-4 border border-[var(--border)] rounded-xl text-xs">
              <div>
                <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Crime Classification Head</span>
                <p className="text-white font-semibold mt-0.5">{activeCase.crime_head}</p>
              </div>
              <div>
                <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Offence Sub-Type</span>
                <p className="text-white font-semibold mt-0.5">{activeCase.crime_sub_head}</p>
              </div>
            </div>

            {/* Narrative Facts */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider">Brief Facts Narrative</span>
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed bg-[var(--surface-dim)] p-4 rounded-xl border border-[var(--border)]">
                {activeCase.brief_facts}
              </p>
            </div>

            {/* Accused, Victims lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              
              {/* Accused */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 border-b border-[var(--border)] pb-2">
                  <Users className="w-4 h-4 text-[var(--danger)]" />
                  <span className="font-bold text-white uppercase tracking-wider text-[10px]">Accused ({activeCase.accused_list.length})</span>
                </div>
                {activeCase.accused_list.length === 0 ? (
                  <p className="text-[11px] text-[var(--foreground-dim)]">No accused registered.</p>
                ) : (
                  <div className="space-y-2">
                    {activeCase.accused_list.map((a: any) => (
                      <div key={a.ROWID} className="flex justify-between bg-[var(--surface-dim)] p-2.5 rounded-lg border border-[var(--border)]">
                        <div>
                          <p className="font-semibold text-white">{a.accused_name}</p>
                          <p className="text-[10px] text-[var(--foreground-dim)]">Age: {a.age_year || "Unknown"} | {a.gender}</p>
                        </div>
                        <span className="badge badge-danger text-[9px] h-fit">{a.person_id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Victims */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 border-b border-[var(--border)] pb-2">
                  <Scale className="w-4 h-4 text-[var(--success)]" />
                  <span className="font-bold text-white uppercase tracking-wider text-[10px]">Victims ({activeCase.victim_list.length})</span>
                </div>
                {activeCase.victim_list.length === 0 ? (
                  <p className="text-[11px] text-[var(--foreground-dim)]">No victims registered.</p>
                ) : (
                  <div className="space-y-2">
                    {activeCase.victim_list.map((v: any) => (
                      <div key={v.ROWID} className="bg-[var(--surface-dim)] p-2.5 rounded-lg border border-[var(--border)]">
                        <p className="font-semibold text-white">{v.victim_name}</p>
                        <p className="text-[10px] text-[var(--foreground-dim)]">Age: {v.age_year || "Unknown"} | {v.gender}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}