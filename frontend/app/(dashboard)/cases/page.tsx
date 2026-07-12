"use client";
import { useState, useEffect, useRef } from "react";
import {
  Search, ChevronLeft, ChevronRight, Eye, Users, Scale, Plus, Edit2, Trash2,
  FileText, ShieldCheck, UserCheck, MapPin, Calendar, Briefcase, PlusCircle,
  AlertTriangle, Check
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function CasesPage() {
  const { user } = useAuthStore();
  const [currentUserEmpId, setCurrentUserEmpId] = useState<number | null>(null);
  
  // List State
  const [cases, setCases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [crimeNo, setCrimeNo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);

  // Lookups metadata
  const [metadata, setMetadata] = useState<any>(null);

  // Modals & Active dockets
  const [activeCase, setActiveCase] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  
  // Entity Form Modals
  const [entityModalType, setEntityModalType] = useState<"accused" | "victim" | "complainant" | "arrest" | null>(null);
  const [editingEntity, setEditingEntity] = useState<any>(null);

  // Active sub-tab inside Case Details Dialog
  const [detailTab, setDetailTab] = useState<"summary" | "accused" | "victims" | "complainants" | "arrests">("summary");

  // --- Forms State ---
  // 1. FIR Register form
  const [firForm, setFirForm] = useState({
    crime_no: "",
    case_no: "",
    crime_registered_date: new Date().toISOString().split("T")[0],
    incident_from_date: "",
    incident_to_date: "",
    police_station_id: "",
    district_id: "",
    case_category_id: "",
    gravity_offence_id: "",
    crime_head_id: "",
    crime_sub_head_id: "",
    case_status_id: "",
    court_id: "",
    latitude: "",
    longitude: "",
    brief_facts: ""
  });

  // 2. Accused Form
  const [accusedForm, setAccusedForm] = useState({
    accused_name: "",
    age_year: "",
    gender: "Male",
    person_id: "A1"
  });

  // 3. Victim Form
  const [victimForm, setVictimForm] = useState({
    victim_name: "",
    age_year: "",
    gender: "Male"
  });

  // 4. Complainant Form
  const [complainantForm, setComplainantForm] = useState({
    complainant_name: "",
    age_year: "",
    gender: "Male",
    occupation_id: ""
  });

  // 5. Arrest Form
  const [arrestForm, setArrestForm] = useState({
    type_id: "1",
    arrest_date: new Date().toISOString().split("T")[0],
    state_id: "1",
    district_id: "",
    police_station_id: "",
    court_id: "",
    accused_master_id: "",
    is_accused: "1",
    is_complainant_accused: "0"
  });

  // Load User details and Metadata lookups
  useEffect(() => {
    async function init() {
      try {
        const me = await api.auth.me();
        setCurrentUserEmpId(me.employee_id);
      } catch (err) {
        console.error("Failed to load user info", err);
      }
      try {
        const meta = await api.lookups.getMetadata();
        setMetadata(meta);
      } catch (err) {
        console.error("Failed to load dropdown metadata", err);
      }
    }
    init();
  }, []);

  // Load Cases List
  const loadCases = async () => {
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
  };

  useEffect(() => {
    loadCases();
  }, [page, crimeNo, keyword, pageSize]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleViewDetails = async (id: number) => {
    try {
      const res = await api.cases.get(id);
      setActiveCase(res);
      setDetailTab("summary");
      setShowDetailModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Ownership Guard
  const hasWriteAccess = (caseObj: any) => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "supervisor") return true;
    if (user.role === "investigator") {
      return (
        currentUserEmpId !== null &&
        caseObj?.police_person_id !== null &&
        Number(caseObj?.police_person_id) === Number(currentUserEmpId)
      );
    }
    return false;
  };

  // Refresh Active Case Details
  const refreshActiveCase = async () => {
    if (!activeCase) return;
    try {
      const res = await api.cases.get(activeCase.ROWID);
      setActiveCase(res);
    } catch (err) {
      console.error(err);
    }
  };

  // --- CRUD Submission Handlers ---
  const handleRegisterFIR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...firForm,
        police_station_id: parseInt(firForm.police_station_id),
        district_id: parseInt(firForm.district_id),
        case_category_id: firForm.case_category_id ? parseInt(firForm.case_category_id) : null,
        gravity_offence_id: firForm.gravity_offence_id ? parseInt(firForm.gravity_offence_id) : null,
        crime_head_id: parseInt(firForm.crime_head_id),
        crime_sub_head_id: parseInt(firForm.crime_sub_head_id),
        case_status_id: firForm.case_status_id ? parseInt(firForm.case_status_id) : null,
        court_id: firForm.court_id ? parseInt(firForm.court_id) : null,
        latitude: firForm.latitude ? parseFloat(firForm.latitude) : null,
        longitude: firForm.longitude ? parseFloat(firForm.longitude) : null,
      };

      const newCase = await api.cases.create(payload);
      setShowRegisterModal(false);
      loadCases();
      handleViewDetails(newCase.ROWID);
    } catch (err: any) {
      alert(err.message || "Failed to register FIR. Verify all required fields.");
    }
  };

  const handleEntitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase) return;
    const caseId = activeCase.ROWID;

    try {
      if (entityModalType === "accused") {
        const payload = {
          ...accusedForm,
          age_year: accusedForm.age_year ? parseInt(accusedForm.age_year) : null
        };
        if (editingEntity) {
          await api.cases.updateAccused(caseId, editingEntity.ROWID, payload);
        } else {
          await api.cases.addAccused(caseId, payload);
        }
      } else if (entityModalType === "victim") {
        const payload = {
          ...victimForm,
          age_year: victimForm.age_year ? parseInt(victimForm.age_year) : null
        };
        if (editingEntity) {
          await api.cases.updateVictim(caseId, editingEntity.ROWID, payload);
        } else {
          await api.cases.addVictim(caseId, payload);
        }
      } else if (entityModalType === "complainant") {
        const payload = {
          ...complainantForm,
          age_year: complainantForm.age_year ? parseInt(complainantForm.age_year) : null,
          occupation_id: complainantForm.occupation_id ? parseInt(complainantForm.occupation_id) : null
        };
        if (editingEntity) {
          await api.cases.updateComplainant(caseId, editingEntity.ROWID, payload);
        } else {
          await api.cases.addComplainant(caseId, payload);
        }
      } else if (entityModalType === "arrest") {
        const payload = {
          ...arrestForm,
          type_id: arrestForm.type_id ? parseInt(arrestForm.type_id) : null,
          state_id: arrestForm.state_id ? parseInt(arrestForm.state_id) : null,
          district_id: arrestForm.district_id ? parseInt(arrestForm.district_id) : null,
          police_station_id: arrestForm.police_station_id ? parseInt(arrestForm.police_station_id) : null,
          court_id: arrestForm.court_id ? parseInt(arrestForm.court_id) : null,
          accused_master_id: parseInt(arrestForm.accused_master_id),
          is_accused: parseInt(arrestForm.is_accused),
          is_complainant_accused: parseInt(arrestForm.is_complainant_accused)
        };
        if (editingEntity) {
          await api.cases.updateArrest(caseId, editingEntity.ROWID, payload);
        } else {
          await api.cases.addArrest(caseId, payload);
        }
      }
      setEntityModalType(null);
      setEditingEntity(null);
      refreshActiveCase();
      loadCases();
    } catch (err: any) {
      alert(err.message || "Failed to save record.");
    }
  };

  const handleEntityDelete = async (type: "accused" | "victim" | "complainant" | "arrest", entityId: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    const caseId = activeCase.ROWID;
    try {
      if (type === "accused") await api.cases.deleteAccused(caseId, entityId);
      if (type === "victim") await api.cases.deleteVictim(caseId, entityId);
      if (type === "complainant") await api.cases.deleteComplainant(caseId, entityId);
      if (type === "arrest") await api.cases.deleteArrest(caseId, entityId);
      refreshActiveCase();
      loadCases();
    } catch (err: any) {
      alert(err.message || "Failed to delete record.");
    }
  };

  const openAddEntity = (type: "accused" | "victim" | "complainant" | "arrest") => {
    setEditingEntity(null);
    setEntityModalType(type);
    if (type === "accused") setAccusedForm({ accused_name: "", age_year: "", gender: "Male", person_id: `A${activeCase.accused_list.length + 1}` });
    if (type === "victim") setVictimForm({ victim_name: "", age_year: "", gender: "Male" });
    if (type === "complainant") setComplainantForm({ complainant_name: "", age_year: "", gender: "Male", occupation_id: "" });
    if (type === "arrest") setArrestForm({ type_id: "1", arrest_date: new Date().toISOString().split("T")[0], state_id: "1", district_id: "", police_station_id: "", court_id: "", accused_master_id: activeCase.accused_list[0]?.ROWID.toString() || "", is_accused: "1", is_complainant_accused: "0" });
  };

  const openEditEntity = (type: "accused" | "victim" | "complainant" | "arrest", entity: any) => {
    setEditingEntity(entity);
    setEntityModalType(type);
    if (type === "accused") {
      setAccusedForm({
        accused_name: entity.accused_name,
        age_year: entity.age_year?.toString() || "",
        gender: entity.gender || "Male",
        person_id: entity.person_id || "A1"
      });
    }
    if (type === "victim") {
      setVictimForm({
        victim_name: entity.victim_name,
        age_year: entity.age_year?.toString() || "",
        gender: entity.gender || "Male"
      });
    }
    if (type === "complainant") {
      // Find occupation_id if match
      const occ = metadata?.occupations.find((o: any) => o.occupation_name === entity.occupation);
      setComplainantForm({
        complainant_name: entity.complainant_name,
        age_year: entity.age_year?.toString() || "",
        gender: entity.gender || "Male",
        occupation_id: occ?.ROWID?.toString() || ""
      });
    }
    if (type === "arrest") {
      setArrestForm({
        type_id: entity.type_id?.toString() || "1",
        arrest_date: entity.arrest_date || "",
        state_id: entity.state_id?.toString() || "1",
        district_id: entity.district_id?.toString() || "",
        police_station_id: entity.police_station_id?.toString() || "",
        court_id: entity.court_id?.toString() || "",
        accused_master_id: entity.accused_master_id?.toString() || "",
        is_accused: entity.is_accused?.toString() || "1",
        is_complainant_accused: entity.is_complainant_accused?.toString() || "0"
      });
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      
      {/* Title with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold gradient-text">Criminal Case Records</h2>
          <p className="text-xs text-[var(--foreground-dim)]">Search, filter, and inspect case dockets and registered FIRs</p>
        </div>
        
        {/* Register FIR Button for Investigators/Admins/Supervisors */}
        {user && ["admin", "supervisor", "investigator"].includes(user.role) && (
          <button 
            onClick={() => setShowRegisterModal(true)}
            className="btn-primary py-2 text-xs flex items-center gap-1.5 shadow-lg shadow-[var(--primary-glow)]/20"
          >
            <Plus className="w-4 h-4" />
            Register New FIR
          </button>
        )}
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
                  <tr key={c.ROWID} className="hover:bg-[var(--surface-dim)]/50 transition-colors">
                    <td className="font-semibold text-white">{c.crime_no}</td>
                    <td>{c.crime_registered_date}</td>
                    <td>{c.district_name}</td>
                    <td>{c.police_station}</td>
                    <td>{c.crime_sub_head}</td>
                    <td>
                      <span className={`badge ${
                        ["Closed", "Convicted"].includes(c.status) ? "badge-success" :
                        c.status === "Under Investigation" ? "badge-warning" :
                        "badge-primary"
                      }`}>
                        {c.status || "Under Investigation"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button 
                        onClick={() => handleViewDetails(c.ROWID)}
                        className="p-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--border)] border border-[var(--border)] rounded-lg text-[var(--primary)] hover:text-white transition-all hover:scale-105"
                        title="View Case Docket"
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

      {/* ========================================== */}
      {/* 🚀 REGISTER NEW FIR MODAL (Multi-column Form) */}
      {/* ========================================== */}
      {showRegisterModal && metadata && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6 animate-slide-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-lg font-bold text-white">Register New Crime FIR Record</h3>
              </div>
              <button onClick={() => setShowRegisterModal(false)} className="btn-secondary py-1 px-3 text-xs rounded-lg">Cancel</button>
            </div>

            <form onSubmit={handleRegisterFIR} className="space-y-6 text-xs">
              
              {/* Core Case Information */}
              <div className="space-y-4">
                <h4 className="font-bold text-white border-b border-[var(--border)] pb-1.5 uppercase text-[10px] tracking-wider text-[var(--primary)]">1. General Case Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Crime Number *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. CR-2026-0034"
                      className="input" 
                      value={firForm.crime_no}
                      onChange={(e) => setFirForm(prev => ({ ...prev, crime_no: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Court Case ID (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. CC-456/2026"
                      className="input" 
                      value={firForm.case_no}
                      onChange={(e) => setFirForm(prev => ({ ...prev, case_no: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Registration Date *</label>
                    <input 
                      type="date" 
                      className="input" 
                      value={firForm.crime_registered_date}
                      onChange={(e) => setFirForm(prev => ({ ...prev, crime_registered_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Incident Occurrence From</label>
                    <input 
                      type="date" 
                      className="input" 
                      value={firForm.incident_from_date}
                      onChange={(e) => setFirForm(prev => ({ ...prev, incident_from_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Incident Occurrence To</label>
                    <input 
                      type="date" 
                      className="input" 
                      value={firForm.incident_to_date}
                      onChange={(e) => setFirForm(prev => ({ ...prev, incident_to_date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Jurisdiction & Legal Selectors */}
              <div className="space-y-4">
                <h4 className="font-bold text-white border-b border-[var(--border)] pb-1.5 uppercase text-[10px] tracking-wider text-[var(--primary)]">2. Jurisdiction & Classification</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">District Name *</label>
                    <select 
                      className="input cursor-pointer"
                      value={firForm.district_id}
                      onChange={(e) => setFirForm(prev => ({ ...prev, district_id: e.target.value }))}
                      required
                    >
                      <option value="">Select District</option>
                      {metadata.districts.map((d: any) => <option key={d.ROWID} value={d.ROWID}>{d.district_name}</option>)}
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Police Station Unit *</label>
                    <select 
                      className="input cursor-pointer"
                      value={firForm.police_station_id}
                      onChange={(e) => setFirForm(prev => ({ ...prev, police_station_id: e.target.value }))}
                      required
                    >
                      <option value="">Select Police Station</option>
                      {metadata.units
                        .filter((u: any) => !firForm.district_id || u.district_id.toString() === firForm.district_id.toString())
                        .map((u: any) => <option key={u.ROWID} value={u.ROWID}>{u.unit_name}</option>)
                      }
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Court Name (Optional)</label>
                    <select 
                      className="input cursor-pointer"
                      value={firForm.court_id}
                      onChange={(e) => setFirForm(prev => ({ ...prev, court_id: e.target.value }))}
                    >
                      <option value="">Select Court</option>
                      {metadata.courts
                        .filter((c: any) => !firForm.district_id || c.district_id.toString() === firForm.district_id.toString())
                        .map((c: any) => <option key={c.ROWID} value={c.ROWID}>{c.court_name}</option>)
                      }
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Case Category</label>
                    <select 
                      className="input cursor-pointer"
                      value={firForm.case_category_id}
                      onChange={(e) => setFirForm(prev => ({ ...prev, case_category_id: e.target.value }))}
                    >
                      <option value="">Select Category</option>
                      {metadata.categories.map((c: any) => <option key={c.ROWID} value={c.ROWID}>{c.category_name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Gravity level</label>
                    <select 
                      className="input cursor-pointer"
                      value={firForm.gravity_offence_id}
                      onChange={(e) => setFirForm(prev => ({ ...prev, gravity_offence_id: e.target.value }))}
                    >
                      <option value="">Select Gravity</option>
                      {metadata.gravities.map((g: any) => <option key={g.ROWID} value={g.ROWID}>{g.gravity_name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Crime Head *</label>
                    <select 
                      className="input cursor-pointer"
                      value={firForm.crime_head_id}
                      onChange={(e) => setFirForm(prev => ({ ...prev, crime_head_id: e.target.value }))}
                      required
                    >
                      <option value="">Select Crime Head</option>
                      {metadata.crime_heads.map((c: any) => <option key={c.ROWID} value={c.ROWID}>{c.crime_head_name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Offence Sub-Head *</label>
                    <select 
                      className="input cursor-pointer"
                      value={firForm.crime_sub_head_id}
                      onChange={(e) => setFirForm(prev => ({ ...prev, crime_sub_head_id: e.target.value }))}
                      required
                    >
                      <option value="">Select Sub-Head</option>
                      {metadata.crime_subheads
                        .filter((s: any) => !firForm.crime_head_id || s.crime_head_id.toString() === firForm.crime_head_id.toString())
                        .map((s: any) => <option key={s.ROWID} value={s.ROWID}>{s.crime_sub_head_name}</option>)
                      }
                    </select>
                  </div>
                </div>
              </div>

              {/* Location & Case Facts */}
              <div className="space-y-4">
                <h4 className="font-bold text-white border-b border-[var(--border)] pb-1.5 uppercase text-[10px] tracking-wider text-[var(--primary)]">3. Crime Scene Facts</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">GPS Latitude (Optional)</label>
                    <input 
                      type="number" step="any" placeholder="12.9716"
                      className="input" 
                      value={firForm.latitude}
                      onChange={(e) => setFirForm(prev => ({ ...prev, latitude: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">GPS Longitude (Optional)</label>
                    <input 
                      type="number" step="any" placeholder="77.5946"
                      className="input" 
                      value={firForm.longitude}
                      onChange={(e) => setFirForm(prev => ({ ...prev, longitude: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Current Investigation Status</label>
                    <select 
                      className="input cursor-pointer"
                      value={firForm.case_status_id}
                      onChange={(e) => setFirForm(prev => ({ ...prev, case_status_id: e.target.value }))}
                    >
                      <option value="">Select Status</option>
                      {metadata.statuses.map((s: any) => <option key={s.ROWID} value={s.ROWID}>{s.status_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Brief Facts Narrative *</label>
                  <textarea 
                    rows={4}
                    placeholder="Provide a comprehensive summary of the incident as reported in the complaint..."
                    className="input font-sans text-xs resize-none"
                    value={firForm.brief_facts}
                    onChange={(e) => setFirForm(prev => ({ ...prev, brief_facts: e.target.value }))}
                    maxLength={2000}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border)]">
                <button type="button" onClick={() => setShowRegisterModal(false)} className="btn-secondary py-2 px-4">Cancel</button>
                <button type="submit" className="btn-primary py-2 px-6 shadow-lg shadow-[var(--primary-glow)]/10">Register Case Docket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 🚀 CASE DETAILS & DOCKET MANAGER MODAL      */}
      {/* ========================================== */}
      {showDetailModal && activeCase && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 animate-slide-in relative border border-[var(--border)]/80">
            
            {/* Header */}
            <div className="p-6 border-b border-[var(--border)] bg-[var(--surface-dim)]/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge badge-info text-[9px] uppercase tracking-wider">{activeCase.category_name || "NCR"} Docket</span>
                  {activeCase.police_person_id && (
                    <span className="badge badge-primary text-[9px]">Owner ID: {activeCase.police_person_id}</span>
                  )}
                  {hasWriteAccess(activeCase) ? (
                    <span className="badge badge-success text-[9px] flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      Write Access
                    </span>
                  ) : (
                    <span className="badge badge-warning text-[9px]">Read-Only</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">{activeCase.crime_no}</h3>
                <p className="text-[11px] text-[var(--foreground-dim)]">Court Case ID: {activeCase.case_no || "N/A"}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="btn-secondary py-1.5 px-4 text-xs rounded-lg"
                >
                  Close Docket
                </button>
              </div>
            </div>

            {/* Inner Navigation Tabs */}
            <div className="flex border-b border-[var(--border)] bg-[var(--surface-dim)]/30 overflow-x-auto">
              {[
                { id: "summary", label: "Docket Summary", icon: FileText },
                { id: "complainants", label: "Complainants", icon: UserCheck },
                { id: "accused", label: "Accused Entities", icon: Users },
                { id: "victims", label: "Victims", icon: Scale },
                { id: "arrests", label: "Arrests & Surrenders", icon: ShieldCheck }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setDetailTab(t.id as any)}
                    className={`flex items-center gap-1.5 px-5 py-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
                      detailTab === t.id
                        ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--surface-dim)]/50"
                        : "border-transparent text-[var(--foreground-dim)] hover:text-white"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* Tab 1: Summary */}
              {detailTab === "summary" && (
                <div className="space-y-6 animate-fade-in text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">District</span>
                      <p className="text-white font-semibold mt-0.5">{activeCase.district_name}</p>
                    </div>
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Police Station</span>
                      <p className="text-white font-semibold mt-0.5">{activeCase.police_station}</p>
                    </div>
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Registered Date</span>
                      <p className="text-white font-semibold mt-0.5">{activeCase.crime_registered_date}</p>
                    </div>
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Investigation Status</span>
                      <span className={`badge mt-0.5 ${
                        ["Closed", "Convicted"].includes(activeCase.status) ? "badge-success" : "badge-warning"
                      }`}>{activeCase.status || "Under Investigation"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--surface-dim)]/50 p-4 border border-[var(--border)] rounded-xl">
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Crime Classification Head</span>
                      <p className="text-white font-semibold mt-0.5">{activeCase.crime_head}</p>
                    </div>
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Offence Sub-Type</span>
                      <p className="text-white font-semibold mt-0.5">{activeCase.crime_sub_head}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Incident Occurrence From</span>
                      <p className="text-white font-semibold mt-0.5">{activeCase.incident_from_date || "N/A"}</p>
                    </div>
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Incident Occurrence To</span>
                      <p className="text-white font-semibold mt-0.5">{activeCase.incident_to_date || "N/A"}</p>
                    </div>
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Latitude</span>
                      <p className="text-white font-semibold mt-0.5">{activeCase.latitude || "N/A"}</p>
                    </div>
                    <div>
                      <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">Longitude</span>
                      <p className="text-white font-semibold mt-0.5">{activeCase.longitude || "N/A"}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider">Brief Facts Narrative</span>
                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed bg-[var(--surface-dim)] p-4 rounded-xl border border-[var(--border)]">
                      {activeCase.brief_facts}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Complainants */}
              {detailTab === "complainants" && (
                <div className="space-y-4 animate-fade-in text-xs">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-[10px] uppercase tracking-wider">Registered Complainant</h4>
                    {hasWriteAccess(activeCase) && activeCase.complainant_list.length === 0 && (
                      <button 
                        onClick={() => openAddEntity("complainant")}
                        className="btn-primary py-1 px-3 text-[10px] flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Add Complainant
                      </button>
                    )}
                  </div>

                  {activeCase.complainant_list.length === 0 ? (
                    <div className="text-center py-8 bg-[var(--surface-dim)] rounded-xl border border-[var(--border)] text-[var(--foreground-dim)]">
                      No complainant record registered.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeCase.complainant_list.map((c: any) => (
                        <div key={c.ROWID} className="flex justify-between items-center bg-[var(--surface-dim)] p-4 rounded-xl border border-[var(--border)]">
                          <div>
                            <p className="font-bold text-white text-sm">{c.complainant_name}</p>
                            <p className="text-[10px] text-[var(--foreground-dim)] mt-0.5">
                              Gender: <span className="text-white">{c.gender}</span> | Age: <span className="text-white">{c.age_year || "Unknown"}</span> | Occupation: <span className="text-[var(--primary)] font-semibold">{c.occupation || "Unemployed / Unknown"}</span>
                            </p>
                          </div>
                          
                          {hasWriteAccess(activeCase) && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => openEditEntity("complainant", c)}
                                className="p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-[var(--primary)] hover:text-white"
                                title="Edit Complainant"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => handleEntityDelete("complainant", c.ROWID)}
                                className="p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-[var(--danger)] hover:text-white"
                                title="Delete Complainant"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Accused */}
              {detailTab === "accused" && (
                <div className="space-y-4 animate-fade-in text-xs">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-[10px] uppercase tracking-wider">Accused list ({activeCase.accused_list.length})</h4>
                    {hasWriteAccess(activeCase) && (
                      <button 
                        onClick={() => openAddEntity("accused")}
                        className="btn-primary py-1 px-3 text-[10px] flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Add Accused
                      </button>
                    )}
                  </div>

                  {activeCase.accused_list.length === 0 ? (
                    <div className="text-center py-8 bg-[var(--surface-dim)] rounded-xl border border-[var(--border)] text-[var(--foreground-dim)]">
                      No accused registered.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeCase.accused_list.map((a: any) => (
                        <div key={a.ROWID} className="flex justify-between items-center bg-[var(--surface-dim)] p-4 rounded-xl border border-[var(--border)]">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="badge badge-danger text-[9px]">{a.person_id || "A"}</span>
                              <p className="font-bold text-white">{a.accused_name}</p>
                            </div>
                            <p className="text-[10px] text-[var(--foreground-dim)] mt-1">
                              Gender: <span className="text-white">{a.gender}</span> | Age: <span className="text-white">{a.age_year || "Unknown"}</span>
                            </p>
                          </div>
                          
                          {hasWriteAccess(activeCase) && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => openEditEntity("accused", a)}
                                className="p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-[var(--primary)] hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => handleEntityDelete("accused", a.ROWID)}
                                className="p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-[var(--danger)] hover:text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Victims */}
              {detailTab === "victims" && (
                <div className="space-y-4 animate-fade-in text-xs">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-[10px] uppercase tracking-wider">Victims list ({activeCase.victim_list.length})</h4>
                    {hasWriteAccess(activeCase) && (
                      <button 
                        onClick={() => openAddEntity("victim")}
                        className="btn-primary py-1 px-3 text-[10px] flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Add Victim
                      </button>
                    )}
                  </div>

                  {activeCase.victim_list.length === 0 ? (
                    <div className="text-center py-8 bg-[var(--surface-dim)] rounded-xl border border-[var(--border)] text-[var(--foreground-dim)]">
                      No victims registered.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeCase.victim_list.map((v: any) => (
                        <div key={v.ROWID} className="flex justify-between items-center bg-[var(--surface-dim)] p-4 rounded-xl border border-[var(--border)]">
                          <div>
                            <p className="font-bold text-white">{v.victim_name}</p>
                            <p className="text-[10px] text-[var(--foreground-dim)] mt-1">
                              Gender: <span className="text-white">{v.gender}</span> | Age: <span className="text-white">{v.age_year || "Unknown"}</span>
                            </p>
                          </div>
                          
                          {hasWriteAccess(activeCase) && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => openEditEntity("victim", v)}
                                className="p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-[var(--primary)] hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => handleEntityDelete("victim", v.ROWID)}
                                className="p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-[var(--danger)] hover:text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Arrests */}
              {detailTab === "arrests" && (
                <div className="space-y-4 animate-fade-in text-xs">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-[10px] uppercase tracking-wider">Arrests & Surrenders ({activeCase.arrests.length})</h4>
                    {hasWriteAccess(activeCase) && activeCase.accused_list.length > 0 && (
                      <button 
                        onClick={() => openAddEntity("arrest")}
                        className="btn-primary py-1 px-3 text-[10px] flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Log Arrest Record
                      </button>
                    )}
                  </div>

                  {activeCase.arrests.length === 0 ? (
                    <div className="text-center py-8 bg-[var(--surface-dim)] rounded-xl border border-[var(--border)] text-[var(--foreground-dim)]">
                      No arrest / surrender logs on file.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeCase.arrests.map((arr: any) => {
                        // Find matching accused name
                        const acc = activeCase.accused_list.find((a: any) => a.ROWID === arr.accused_master_id);
                        return (
                          <div key={arr.ROWID} className="flex justify-between items-center bg-[var(--surface-dim)] p-4 rounded-xl border border-[var(--border)]">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`badge ${arr.is_accused ? "badge-danger" : "badge-warning"}`}>
                                  {arr.is_accused ? "Arrested Accused" : "Surrendered"}
                                </span>
                                <p className="font-bold text-white">{acc?.accused_name || `Accused #${arr.accused_master_id}`}</p>
                              </div>
                              <p className="text-[10px] text-[var(--foreground-dim)] mt-1.5">
                                Logged Date: <span className="text-white font-medium">{arr.arrest_date || "N/A"}</span>
                              </p>
                            </div>
                            
                            {hasWriteAccess(activeCase) && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => openEditEntity("arrest", arr)}
                                  className="p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-[var(--primary)] hover:text-white"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => handleEntityDelete("arrest", arr.ROWID)}
                                  className="p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-[var(--danger)] hover:text-white"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🚀 SUB-ENTITY MODAL FOR CRUD (Accused/Victim/Complainant/Arrest) */}
      {/* ======================================================= */}
      {entityModalType && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-in border border-[var(--border)]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[var(--border)] pb-2">
              {editingEntity ? "Edit" : "Add New"} {entityModalType.toUpperCase()} Record
            </h3>

            <form onSubmit={handleEntitySubmit} className="space-y-4 text-xs">
              
              {/* Accused Input fields */}
              {entityModalType === "accused" && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Accused Full Name *</label>
                    <input 
                      type="text" className="input" required
                      value={accusedForm.accused_name}
                      onChange={(e) => setAccusedForm(prev => ({ ...prev, accused_name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Age (Years)</label>
                      <input 
                        type="number" className="input"
                        value={accusedForm.age_year}
                        onChange={(e) => setAccusedForm(prev => ({ ...prev, age_year: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Gender</label>
                      <select 
                        className="input cursor-pointer"
                        value={accusedForm.gender}
                        onChange={(e) => setAccusedForm(prev => ({ ...prev, gender: e.target.value }))}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Accused Code (e.g. A1, A2)</label>
                    <input 
                      type="text" className="input" required
                      value={accusedForm.person_id}
                      onChange={(e) => setAccusedForm(prev => ({ ...prev, person_id: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Victim Input fields */}
              {entityModalType === "victim" && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Victim Name *</label>
                    <input 
                      type="text" className="input" required
                      value={victimForm.victim_name}
                      onChange={(e) => setVictimForm(prev => ({ ...prev, victim_name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Age (Years)</label>
                      <input 
                        type="number" className="input"
                        value={victimForm.age_year}
                        onChange={(e) => setVictimForm(prev => ({ ...prev, age_year: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Gender</label>
                      <select 
                        className="input cursor-pointer"
                        value={victimForm.gender}
                        onChange={(e) => setVictimForm(prev => ({ ...prev, gender: e.target.value }))}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Complainant Input fields */}
              {entityModalType === "complainant" && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Complainant Name *</label>
                    <input 
                      type="text" className="input" required
                      value={complainantForm.complainant_name}
                      onChange={(e) => setComplainantForm(prev => ({ ...prev, complainant_name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Age (Years)</label>
                      <input 
                        type="number" className="input"
                        value={complainantForm.age_year}
                        onChange={(e) => setComplainantForm(prev => ({ ...prev, age_year: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Gender</label>
                      <select 
                        className="input cursor-pointer"
                        value={complainantForm.gender}
                        onChange={(e) => setComplainantForm(prev => ({ ...prev, gender: e.target.value }))}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Occupation</label>
                    <select 
                      className="input cursor-pointer"
                      value={complainantForm.occupation_id}
                      onChange={(e) => setComplainantForm(prev => ({ ...prev, occupation_id: e.target.value }))}
                    >
                      <option value="">Select Occupation</option>
                      {metadata?.occupations.map((o: any) => <option key={o.ROWID} value={o.ROWID}>{o.occupation_name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Arrest Input fields */}
              {entityModalType === "arrest" && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Select Accused *</label>
                    <select 
                      className="input cursor-pointer" required
                      value={arrestForm.accused_master_id}
                      onChange={(e) => setArrestForm(prev => ({ ...prev, accused_master_id: e.target.value }))}
                    >
                      <option value="">Choose Accused</option>
                      {activeCase.accused_list.map((a: any) => (
                        <option key={a.ROWID} value={a.ROWID}>{a.accused_name} ({a.person_id})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Arrest Date *</label>
                      <input 
                        type="date" className="input" required
                        value={arrestForm.arrest_date}
                        onChange={(e) => setArrestForm(prev => ({ ...prev, arrest_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Arrest Type</label>
                      <select 
                        className="input cursor-pointer"
                        value={arrestForm.type_id}
                        onChange={(e) => setArrestForm(prev => ({ ...prev, type_id: e.target.value }))}
                      >
                        <option value="1">Under Investigation</option>
                        <option value="2">Surrender in Court</option>
                        <option value="3">Bail Executed</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Is Accused?</label>
                      <select 
                        className="input cursor-pointer"
                        value={arrestForm.is_accused}
                        onChange={(e) => setArrestForm(prev => ({ ...prev, is_accused: e.target.value }))}
                      >
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Complainant Accused?</label>
                      <select 
                        className="input cursor-pointer"
                        value={arrestForm.is_complainant_accused}
                        onChange={(e) => setArrestForm(prev => ({ ...prev, is_complainant_accused: e.target.value }))}
                      >
                        <option value="0">No</option>
                        <option value="1">Yes</option>
                      </select>
                    </div>
                  </div>

                  {metadata && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Arrest District</label>
                        <select 
                          className="input cursor-pointer"
                          value={arrestForm.district_id}
                          onChange={(e) => setArrestForm(prev => ({ ...prev, district_id: e.target.value }))}
                        >
                          <option value="">Choose District</option>
                          {metadata.districts.map((d: any) => <option key={d.ROWID} value={d.ROWID}>{d.district_name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">Arrest Station Unit</label>
                        <select 
                          className="input cursor-pointer"
                          value={arrestForm.police_station_id}
                          onChange={(e) => setArrestForm(prev => ({ ...prev, police_station_id: e.target.value }))}
                        >
                          <option value="">Choose Station</option>
                          {metadata.units
                            .filter((u: any) => !arrestForm.district_id || u.district_id.toString() === arrestForm.district_id.toString())
                            .map((u: any) => <option key={u.ROWID} value={u.ROWID}>{u.unit_name}</option>)
                          }
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border)]">
                <button type="button" onClick={() => setEntityModalType(null)} className="btn-secondary py-1.5 px-3">Cancel</button>
                <button type="submit" className="btn-primary py-1.5 px-4 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}