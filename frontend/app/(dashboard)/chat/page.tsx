"use client";
import { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  ChevronRight,
  Database,
  BookOpen,
  Loader2,
  AlertCircle,
  Cpu,
  FileSearch,
  UploadCloud,
  Trash2,
  FileText,
  Plus,
  Search,
  MapPin,
  GitPullRequest,
  HelpCircle,
  Edit,
} from "lucide-react";
import api from "@/lib/api";

type QueryMode = "database" | "knowledge_base";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  refs?: any[];
  intent?: string;
  mode?: QueryMode;
}

const DB_SUGGESTIONS = [
  "Show murder cases in Bengaluru involving repeat offenders",
  "Find all cyber crime cases registered last month",
  "Identify heinous offenses in Mangaluru district",
  "Compare crime trends in Mysuru vs Bengaluru",
  "List accused with more than 3 cases on file",
];

const KB_SUGGESTIONS = [
  "What is the standard procedure for FIR registration?",
  "Explain the legal sections for crimes against women",
  "What are the escalation protocols for heinous offences?",
  "Summarise the Karnataka Police Act provisions",
  "What documents are required to file a complaint?",
];

interface CanvasNode {
  id: string; // 'case-X', 'suspect-Y', 'related-Z', 'note-W'
  type: "case" | "suspect" | "related" | "note";
  label: string;
  x: number;
  y: number;
  details?: any;
}

interface CanvasLink {
  id: string;
  fromId: string;
  fromAnchor: "top" | "right" | "bottom" | "left";
  toId: string;
  toAnchor: "top" | "right" | "bottom" | "left";
  label?: string;
}

export default function ChatPage() {
  const [sessionUuid, setSessionUuid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<QueryMode>("database");
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Document Management States
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Dropdown Metadata & Filtering States
  const [metadata, setMetadata] = useState<any>(null);
  const [districtFilter, setDistrictFilter] = useState<string>("");
  const [stationFilter, setStationFilter] = useState<string>("");
  const [crimeHeadFilter, setCrimeHeadFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [criminalSearchQuery, setCriminalSearchQuery] = useState<string>("");
  const [searchedCriminals, setSearchedCriminals] = useState<any[]>([]);
  const [searchingCriminals, setSearchingCriminals] = useState(false);

  // Interactive Canvas Board States
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [links, setLinks] = useState<CanvasLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [activeAnchor, setActiveAnchor] = useState<{
    nodeId: string;
    anchor: "top" | "right" | "bottom" | "left";
  } | null>(null);

  // Custom note insertion modal state
  const [showCustomNodeModal, setShowCustomNodeModal] = useState(false);
  const [customNodeType, setCustomNodeType] = useState<"note" | "suspect">("note");
  const [customNodeLabel, setCustomNodeLabel] = useState("");
  const [customNodeDetails, setCustomNodeDetails] = useState("");

  const suggestions = mode === "database" ? DB_SUGGESTIONS : KB_SUGGESTIONS;

  // Fetch Lookups Metadata on Mount
  useEffect(() => {
    async function loadMetadata() {
      try {
        const data = await api.lookups.getMetadata();
        setMetadata(data);
      } catch (err) {
        console.error("Failed to load metadata", err);
      }
    }
    loadMetadata();
  }, []);

  // Load past sessions
  const [sessions, setSessions] = useState<any[]>([]);

  const loadSessions = async () => {
    try {
      const data = await api.chat.listSessions();
      setSessions(data);
      return data;
    } catch (err) {
      console.error("Failed to load sessions", err);
      return [];
    }
  };

  const loadHistory = async (uuid: string) => {
    try {
      const history = await api.chat.getHistory(uuid);
      const formatted: Message[] = history.map((m: any) => ({
        id: m.message_uuid || m.ROWID || Date.now().toString(),
        role: m.role,
        content: m.content,
        refs: m.retrieved_refs ? JSON.parse(m.retrieved_refs) : [],
        mode: m.mode || "database",
      }));
      setMessages(formatted);
    } catch (err) {
      console.error("Failed to load session history", err);
    }
  };

  const handleCreateNewSession = async () => {
    try {
      setLoading(true);
      const res = await api.chat.createSession("en");
      setSessionUuid(res.session_id);
      setMessages([]);
      await loadSessions();
    } catch (err) {
      console.error("Failed to create new session", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch RAG documents
  const fetchDocs = async () => {
    if (!sessionUuid) return;
    setDocsLoading(true);
    try {
      const data = await api.chat.listDocuments(sessionUuid);
      setUploadedDocs(data);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionUuid) {
      loadHistory(sessionUuid);
      if (mode === "knowledge_base") {
        fetchDocs();
      }
    }
  }, [sessionUuid, mode]);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionUuid) return;

    setUploading(true);
    try {
      await api.chat.uploadDocument(sessionUuid, file);
      await fetchDocs();
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this document?") || !sessionUuid) return;
    try {
      await api.chat.deleteDocument(sessionUuid, fileId);
      await fetchDocs();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  useEffect(() => {
    async function initChat() {
      try {
        const existing = await loadSessions();
        if (existing.length > 0) {
          setSessionUuid(existing[0].session_uuid);
        } else {
          const res = await api.chat.createSession("en");
          setSessionUuid(res.session_id);
          await loadSessions();
        }
      } catch (err) {
        console.error("Failed to initialize chat", err);
      }
    }
    initChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !sessionUuid || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      mode,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.chat.sendMessage(sessionUuid, text, mode);
      const botMsg: Message = {
        id: response.message_id,
        role: "assistant",
        content: response.content,
        refs: response.retrieved_doc_refs,
        intent: response.intent,
        mode,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "Sorry, I encountered an issue processing your query. Please try again.",
          mode,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleShowCase = async (id: number) => {
    try {
      const caseDetail = await api.cases.get(id);
      setSelectedCase(caseDetail);
    } catch (err) {
      console.error(err);
    }
  };

  const handleModeChange = (newMode: QueryMode) => {
    setMode(newMode);
    setMessages([]);
    setSelectedCase(null);
    inputRef.current?.focus();
  };

  // Database Criminal Search
  const handleSearchCriminals = async () => {
    setSearchingCriminals(true);
    try {
      const params: Record<string, any> = {};
      if (districtFilter) params.district_id = parseInt(districtFilter);
      if (stationFilter) params.police_station_id = parseInt(stationFilter);
      if (crimeHeadFilter) params.crime_head_id = parseInt(crimeHeadFilter);
      if (statusFilter) params.case_status_id = parseInt(statusFilter);
      if (criminalSearchQuery) params.name = criminalSearchQuery;

      const data = await api.cases.searchAccused(params);
      setSearchedCriminals(data || []);
    } catch (err) {
      console.error("Criminal search failed", err);
    } finally {
      setSearchingCriminals(false);
    }
  };

  // Auto-search when filters change
  useEffect(() => {
    handleSearchCriminals();
  }, [districtFilter, stationFilter, crimeHeadFilter, statusFilter]);

  // Board Add Handlers
  const handleAddCriminalToBoard = (criminal: any) => {
    const nodeId = `suspect-${criminal.ROWID}-${Date.now()}`;
    const newNode: CanvasNode = {
      id: nodeId,
      type: "suspect",
      label: criminal.accused_name,
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      details: criminal
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNode(newNode);
  };

  const handleAddCaseToBoard = async (caseId: number) => {
    try {
      const caseDetail = await api.cases.get(caseId);
      const nodeId = `case-${caseDetail.ROWID}-${Date.now()}`;
      const newNode: CanvasNode = {
        id: nodeId,
        type: "case",
        label: caseDetail.crime_no,
        x: 50 + Math.random() * 100,
        y: 100 + Math.random() * 100,
        details: caseDetail
      };
      setNodes(prev => [...prev, newNode]);
      setSelectedNode(newNode);
    } catch (err) {
      console.error(err);
    }
  };

  // Draggable whiteboard mouse math handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest(".anchor-handle") || (e.target as HTMLElement).closest(".delete-btn")) {
      return;
    }
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggingNodeId(nodeId);
    dragOffset.current = {
      x: e.clientX - node.x,
      y: e.clientY - node.y
    };
    setSelectedNode(node);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId) return;

    setNodes(prev =>
      prev.map(n =>
        n.id === draggingNodeId
          ? {
              ...n,
              x: Math.max(0, e.clientX - dragOffset.current.x),
              y: Math.max(0, e.clientY - dragOffset.current.y)
            }
          : n
      )
    );
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleAnchorClick = (
    nodeId: string,
    anchor: "top" | "right" | "bottom" | "left"
  ) => {
    if (!activeAnchor) {
      setActiveAnchor({ nodeId, anchor });
    } else {
      if (activeAnchor.nodeId !== nodeId) {
        const newLinkId = `link-${activeAnchor.nodeId}-${nodeId}-${Date.now()}`;
        setLinks(prev => [
          ...prev,
          {
            id: newLinkId,
            fromId: activeAnchor.nodeId,
            fromAnchor: activeAnchor.anchor,
            toId: nodeId,
            toAnchor: anchor,
            label: "Associated"
          }
        ]);
      }
      setActiveAnchor(null);
    }
  };

  const handleDeleteLink = (linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setLinks(prev => prev.filter(l => l.fromId !== nodeId && l.toId !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const handleAddCustomNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNodeLabel) return;

    const newNodeId = `custom-${Date.now()}`;
    const newNode: CanvasNode = {
      id: newNodeId,
      type: customNodeType,
      label: customNodeLabel,
      x: 100 + Math.random() * 80,
      y: 100 + Math.random() * 80,
      details: {
        description: customNodeDetails,
        created_at: new Date().toLocaleDateString()
      }
    };

    setNodes(prev => [...prev, newNode]);
    setShowCustomNodeModal(false);
    setCustomNodeLabel("");
    setCustomNodeDetails("");
    setSelectedNode(newNode);
  };

  const getNodeAnchorCoords = (
    node: CanvasNode,
    anchor: "top" | "right" | "bottom" | "left"
  ) => {
    const cardWidth = 180;
    const cardHeight = 90;

    switch (anchor) {
      case "top":
        return { x: node.x + cardWidth / 2, y: node.y };
      case "bottom":
        return { x: node.x + cardWidth / 2, y: node.y + cardHeight };
      case "left":
        return { x: node.x, y: node.y + cardHeight / 2 };
      case "right":
        return { x: node.x + cardWidth, y: node.y + cardHeight / 2 };
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-var(--header-height)-3rem)] min-h-[500px]">
      {/* Main Chat Panel */}
      <div className="flex-1 chart-container flex flex-col p-0 overflow-hidden relative">
        {/* ── Header with Mode Switcher ── */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-dim)]/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Title */}
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--primary)]" />
              <div>
                <h3 className="text-sm font-bold">AI Analytics Assistant</h3>
                <p className="text-[10px] text-[var(--foreground-dim)] font-semibold uppercase tracking-wider">
                  Powered by Zoho Catalyst QuickML AutoML
                </p>
              </div>
            </div>

            {/* Session Selector */}
            <div className="flex items-center gap-2">
              <select
                value={sessionUuid || ""}
                onChange={(e) => {
                  if (e.target.value === "new") {
                    handleCreateNewSession();
                  } else {
                    setSessionUuid(e.target.value);
                  }
                }}
                className="bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs outline-none cursor-pointer hover:border-[var(--primary)] transition-all font-semibold"
              >
                {sessions.map((sess) => (
                  <option key={sess.session_uuid} value={sess.session_uuid}>
                    Session: {sess.started_at ? new Date(sess.started_at).toLocaleTimeString() : sess.session_uuid.slice(0, 8)}
                  </option>
                ))}
                <option value="new">+ Start New Session</option>
              </select>
              <button
                onClick={handleCreateNewSession}
                className="flex items-center gap-1 bg-[var(--primary-glow)]/40 hover:bg-[var(--primary)] hover:text-white text-[var(--primary)] border border-[var(--primary)]/30 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
                title="Start a fresh chat session with isolated knowledge base documents"
              >
                <Plus className="w-3.5 h-3.5" />
                New Session
              </button>
            </div>

            {/* Mode Toggle */}
            <div
              className="flex rounded-xl overflow-hidden border border-[var(--border)] shrink-0"
              role="group"
              aria-label="Query mode selector"
            >
              <button
                id="mode-database"
                onClick={() => handleModeChange("database")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
                  mode === "database"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--foreground-dim)] hover:bg-[var(--border)]"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                Database
              </button>
              <button
                id="mode-knowledge-base"
                onClick={() => handleModeChange("knowledge_base")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all border-l border-[var(--border)] ${
                  mode === "knowledge_base"
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--foreground-dim)] hover:bg-[var(--border)]"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Knowledge Base
              </button>
            </div>
          </div>

          {/* Mode description banner */}
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-[10px] flex items-center gap-2 ${
              mode === "database"
                ? "bg-[var(--primary-glow)]/30 text-[var(--primary)]"
                : "bg-[var(--accent)]/10 text-[var(--accent)]"
            }`}
          >
            {mode === "database" ? (
              <>
                <Cpu className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>Database Mode</strong> — Your query is classified by
                  intent, executed as a ZCQL query on the Catalyst Datastore,
                  and explained by the QuickML AutoML GLM model.
                </span>
              </>
            ) : (
              <>
                <FileSearch className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>Knowledge Base Mode</strong> — Your query is answered
                  by the Catalyst QuickML RAG engine using uploaded police
                  procedural and legal documents.
                </span>
              </>
            )}
          </div>

          {sessionUuid && (
            <span className="badge badge-success text-[9px] font-mono mt-2 inline-block">
              Session: {sessionUuid.substring(0, 8)}
            </span>
          )}
        </div>

        {/* ── Message timeline ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-lg mx-auto">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse ${
                  mode === "database"
                    ? "bg-[var(--primary-glow)] text-[var(--primary)]"
                    : "bg-[var(--accent)]/20 text-[var(--accent)]"
                }`}
              >
                {mode === "database" ? (
                  <Database className="w-7 h-7" />
                ) : (
                  <BookOpen className="w-7 h-7" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-white">
                  {mode === "database"
                    ? "Query the Crime Database"
                    : "Ask the Knowledge Base"}
                </h4>
                <p className="text-xs text-[var(--foreground-dim)] mt-2">
                  {mode === "database"
                    ? "Search cases, find repeat offenders, analyse crime trends, or predict hotspots using natural language."
                    : "Ask about legal procedures, FIR protocols, criminal statutes, or policing best practices."}
                </p>
              </div>

              {/* Suggested queries */}
              <div className="w-full grid grid-cols-1 gap-2">
                {suggestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSendMessage(q)}
                    className="p-3 text-left bg-[var(--surface-elevated)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl text-xs text-[var(--foreground-muted)] transition-all flex items-center justify-between group"
                  >
                    <span>{q}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-slide-in`}
              >
                <div
                  className={`chat-bubble ${
                    m.role === "user"
                      ? "chat-bubble-user"
                      : "chat-bubble-assistant"
                  } space-y-3 max-w-[85%]`}
                >
                  {/* Mode badge on assistant messages */}
                  {m.role === "assistant" && m.mode && (
                    <div className="flex items-center gap-1 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          m.mode === "database"
                            ? "bg-[var(--primary-glow)] text-[var(--primary)]"
                            : "bg-[var(--accent)]/20 text-[var(--accent)]"
                        }`}
                      >
                        {m.mode === "database" ? (
                          <Database className="w-2.5 h-2.5" />
                        ) : (
                          <BookOpen className="w-2.5 h-2.5" />
                        )}
                        {m.mode === "database" ? "Database" : "Knowledge Base"}
                      </span>
                      {m.intent && m.intent !== "knowledge_base" && (
                        <span className="badge text-[9px] font-mono">
                          intent: {m.intent}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message content — preserve newlines */}
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>

                  {/* Citations */}
                  {m.refs && m.refs.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border)]/40 mt-2 space-y-1">
                      <span className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider">
                        {m.mode === "knowledge_base" ? "Sources" : "Citations"}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {m.refs.map((r, i) => (
                          <div key={i} className="flex items-center gap-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded px-1.5 py-0.5">
                            <button
                              onClick={() =>
                                r.case_master_id
                                  ? handleShowCase(r.case_master_id)
                                  : null
                              }
                              title={r.snippet || ""}
                              className="text-[9px] text-[var(--foreground-muted)] hover:text-white transition-colors truncate max-w-[80px]"
                            >
                              {r.crime_no}
                            </button>
                            {m.mode === "database" && r.case_master_id && (
                              <button
                                onClick={() => handleAddCaseToBoard(r.case_master_id)}
                                className="ml-1 px-1 rounded bg-[var(--primary)] text-white text-[8px] font-bold transition-all shrink-0"
                                title="Add case node to whiteboard canvas"
                              >
                                + Board
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="chat-bubble chat-bubble-assistant flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[var(--primary)] animate-spin" />
                <span className="text-xs text-[var(--foreground-dim)]">
                  {mode === "database"
                    ? "Querying database & running AutoML…"
                    : "Searching knowledge base…"}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input box ── */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-dim)]/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="flex gap-3"
          >
            <input
              ref={inputRef}
              id="chat-input"
              type="text"
              placeholder={
                mode === "database"
                  ? "Ask about cases, offenders, trends…"
                  : "Ask about legal procedures, FIR rules…"
              }
              className="input flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              id="chat-send"
              type="submit"
              className={`btn-primary flex items-center justify-center p-3 shrink-0 transition-all ${
                mode === "knowledge_base" ? "bg-[var(--accent)] hover:opacity-90" : ""
              }`}
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ── Right Panel: Investigation Board (Database Mode) ── */}
      {mode === "database" && (
        <div className="w-[50%] chart-container flex flex-col justify-between overflow-hidden p-0 border border-[var(--border)] bg-[var(--surface-elevated)]/40 rounded-2xl relative">
          
          {/* Header & Filter Controls */}
          <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-dim)]/50 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-white">
                  <GitPullRequest className="w-4 h-4 text-[var(--primary)]" />
                  Investigation Canvas & Criminal Filter
                </h3>
                <p className="text-[10px] text-[var(--foreground-dim)] leading-tight">
                  Filter database, add criminals to board, and wire nodes to map connections.
                </p>
              </div>
              <button
                onClick={() => {
                  setCustomNodeType("note");
                  setShowCustomNodeModal(true);
                }}
                className="btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1 shrink-0 bg-[var(--primary)]"
              >
                <Plus className="w-3 h-3" /> Note
              </button>
            </div>

            {/* Dropdown Filters */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-bold text-[var(--foreground-dim)] uppercase mb-0.5">District / Place</label>
                <select
                  className="input py-1 px-1.5 text-[10px] h-8 w-full bg-[var(--surface-dim)]"
                  value={districtFilter}
                  onChange={(e) => {
                    setDistrictFilter(e.target.value);
                    setStationFilter("");
                  }}
                >
                  <option value="">All Districts</option>
                  {metadata?.districts?.map((d: any) => (
                    <option key={d.ROWID} value={d.ROWID}>{d.district_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-bold text-[var(--foreground-dim)] uppercase mb-0.5">Police Station</label>
                <select
                  className="input py-1 px-1.5 text-[10px] h-8 w-full bg-[var(--surface-dim)]"
                  value={stationFilter}
                  onChange={(e) => setStationFilter(e.target.value)}
                >
                  <option value="">All Stations</option>
                  {metadata?.units
                    ?.filter((u: any) => !districtFilter || u.district_id === parseInt(districtFilter))
                    ?.map((u: any) => (
                      <option key={u.ROWID} value={u.ROWID}>{u.unit_name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-bold text-[var(--foreground-dim)] uppercase mb-0.5">Case Type</label>
                <select
                  className="input py-1 px-1.5 text-[10px] h-8 w-full bg-[var(--surface-dim)]"
                  value={crimeHeadFilter}
                  onChange={(e) => setCrimeHeadFilter(e.target.value)}
                >
                  <option value="">All Types</option>
                  {metadata?.crime_heads?.map((h: any) => (
                    <option key={h.ROWID} value={h.ROWID}>{h.crime_head_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-bold text-[var(--foreground-dim)] uppercase mb-0.5">Status</label>
                <select
                  className="input py-1 px-1.5 text-[10px] h-8 w-full bg-[var(--surface-dim)]"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  {metadata?.statuses?.map((s: any) => (
                    <option key={s.ROWID} value={s.ROWID}>{s.status_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Criminal Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-dim)]" />
                <input
                  type="text"
                  placeholder="Search criminals/accused by name..."
                  className="input pl-8 py-1 h-8 text-[11px] w-full bg-[var(--surface-dim)]"
                  value={criminalSearchQuery}
                  onChange={(e) => setCriminalSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearchCriminals();
                  }}
                />
              </div>
              <button
                onClick={handleSearchCriminals}
                className="btn-primary h-8 py-1 px-3 text-[11px] shrink-0 bg-[var(--primary)]"
              >
                Search
              </button>
            </div>

            {/* Criminals Result list */}
            <div className="pt-2">
              <span className="block text-[8px] font-bold text-[var(--foreground-dim)] uppercase mb-1">
                Matching Criminals ({searchedCriminals.length})
              </span>
              <div className="flex gap-1.5 overflow-x-auto pb-1 max-h-[85px] scrollbar-thin">
                {searchingCriminals ? (
                  <span className="text-[10px] text-[var(--foreground-dim)] py-2">Searching...</span>
                ) : searchedCriminals.length === 0 ? (
                  <span className="text-[10px] text-[var(--foreground-dim)] py-2">No suspects found</span>
                ) : (
                  searchedCriminals.map((c) => (
                    <div
                      key={c.ROWID}
                      className="flex items-center gap-2 p-1.5 pr-2 bg-[var(--surface-dim)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg shrink-0 transition-all"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-white leading-tight truncate max-w-[100px]">{c.accused_name}</p>
                        <p className="text-[8px] text-[var(--foreground-dim)] leading-none mt-0.5 truncate max-w-[100px]">
                          {c.police_station} | {c.crime_head}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddCriminalToBoard(c)}
                        className="py-0.5 px-1.5 rounded bg-[var(--primary)] hover:opacity-90 text-[8px] font-bold text-white shrink-0"
                      >
                        + Board
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Draggable canvas */}
          <div
            className="flex-1 relative overflow-hidden bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:16px_16px] cursor-grab select-none active:cursor-grabbing min-h-[220px]"
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            {/* SVG wires */}
            <svg className="absolute inset-0 pointer-events-none w-full h-full">
              <defs>
                <marker
                  id="arrow-wire"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--primary)" />
                </marker>
              </defs>
              {links.map((link) => {
                const fromNode = nodes.find(n => n.id === link.fromId);
                const toNode = nodes.find(n => n.id === link.toId);
                if (!fromNode || !toNode) return null;

                const fromPt = getNodeAnchorCoords(fromNode, link.fromAnchor);
                const toPt = getNodeAnchorCoords(toNode, link.toAnchor);

                const dx = toPt.x - fromPt.x;
                const dy = toPt.y - fromPt.y;
                const cx = fromPt.x + dx / 2;
                const cy = fromPt.y + dy / 2 - 20;

                return (
                  <g key={link.id}>
                    <path
                      d={`M ${fromPt.x} ${fromPt.y} Q ${cx} ${cy} ${toPt.x} ${toPt.y}`}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2"
                      style={{ strokeDasharray: "4,4" }}
                      markerEnd="url(#arrow-wire)"
                    />
                    <text
                      x={cx}
                      y={cy - 5}
                      fill="var(--foreground-dim)"
                      fontSize="8"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="bg-black/90 px-1 pointer-events-auto cursor-pointer hover:fill-red-400"
                      onClick={() => handleDeleteLink(link.id)}
                    >
                      ✕ Link
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Draggable Cards */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isSuspect = node.type === "suspect";
              const isCase = node.type === "case";

              return (
                <div
                  key={node.id}
                  style={{ left: node.x, top: node.y }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  className={`absolute w-[180px] rounded-xl border p-2.5 transition-shadow cursor-grab active:cursor-grabbing select-none ${
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--surface-elevated)] ring-1 ring-[var(--primary-glow)] shadow-lg shadow-[var(--primary-glow)]/10"
                      : "border-[var(--border)] bg-[var(--surface-dim)]/95 shadow-md"
                  }`}
                >
                  <button
                    onClick={() => handleDeleteNode(node.id)}
                    className="delete-btn absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white text-[8px] font-bold transition-all"
                  >
                    ✕
                  </button>

                  <span className={`inline-block text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded mb-1.5 ${
                    isSuspect ? "bg-red-500/10 text-red-400" : isCase ? "bg-blue-500/10 text-blue-400" : "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {node.type}
                  </span>

                  <h4 className="text-[11px] font-bold text-white truncate max-w-[130px]" title={node.label}>
                    {node.label}
                  </h4>

                  {node.type === "suspect" && node.details && (
                    <div className="mt-1 text-[9px] text-[var(--foreground-dim)] leading-tight space-y-0.5">
                      <p className="truncate">Age/Sex: {node.details.age_year || "N/A"} / {node.details.gender || "M"}</p>
                      <p className="truncate">Station: {node.details.police_station || "Unknown"}</p>
                    </div>
                  )}

                  {node.type === "case" && node.details && (
                    <div className="mt-1 text-[9px] text-[var(--foreground-dim)] leading-tight space-y-0.5">
                      <p className="truncate">Station: {node.details.police_station || "Unknown"}</p>
                      <p className="truncate">Brief: {node.details.brief_facts || "N/A"}</p>
                    </div>
                  )}

                  {node.type === "note" && (
                    <p className="mt-1 text-[9px] text-[var(--foreground-muted)] leading-tight line-clamp-2">
                      {node.details?.description}
                    </p>
                  )}

                  {/* Wire connecting anchors */}
                  <button
                    onClick={() => handleAnchorClick(node.id, "top")}
                    className={`anchor-handle absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border transition-all ${
                      activeAnchor?.nodeId === node.id && activeAnchor?.anchor === "top"
                        ? "bg-green-500 border-white scale-125"
                        : "bg-[var(--border)] border-[var(--primary)] hover:bg-green-400"
                    }`}
                  />
                  <button
                    onClick={() => handleAnchorClick(node.id, "right")}
                    className={`anchor-handle absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border transition-all ${
                      activeAnchor?.nodeId === node.id && activeAnchor?.anchor === "right"
                        ? "bg-green-500 border-white scale-125"
                        : "bg-[var(--border)] border-[var(--primary)] hover:bg-green-400"
                    }`}
                  />
                  <button
                    onClick={() => handleAnchorClick(node.id, "bottom")}
                    className={`anchor-handle absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full border transition-all ${
                      activeAnchor?.nodeId === node.id && activeAnchor?.anchor === "bottom"
                        ? "bg-green-500 border-white scale-125"
                        : "bg-[var(--border)] border-[var(--primary)] hover:bg-green-400"
                    }`}
                  />
                  <button
                    onClick={() => handleAnchorClick(node.id, "left")}
                    className={`anchor-handle absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border transition-all ${
                      activeAnchor?.nodeId === node.id && activeAnchor?.anchor === "left"
                        ? "bg-green-500 border-white scale-125"
                        : "bg-[var(--border)] border-[var(--primary)] hover:bg-green-400"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Help Bar */}
          <div className="p-2 border-t border-[var(--border)] bg-[var(--surface-dim)]/80 flex items-center justify-between text-[8px] text-[var(--foreground-dim)] font-semibold uppercase shrink-0">
            <span>Drag cards • Connect wire handles • Click ✕ Link to delete</span>
            {nodes.length > 0 && (
              <button onClick={() => { setNodes([]); setLinks([]); }} className="text-red-400 hover:text-red-300">
                Clear All
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Document Management Panel for Knowledge Base Mode ── */}
      {mode === "knowledge_base" && (
        <div className="w-80 chart-container flex flex-col justify-between overflow-hidden animate-slide-in">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="text-sm font-bold">RAG Documents</h3>
              <p className="text-[10px] text-[var(--accent)] uppercase font-semibold">
                Catalyst File Store
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            {/* Upload Box */}
            <div className="relative group border border-dashed border-[var(--border)] hover:border-[var(--accent)]/50 rounded-xl p-4 text-center cursor-pointer transition-all bg-[var(--surface-dim)]/30">
              <input
                type="file"
                accept=".txt,.pdf,.md,.csv,.json"
                onChange={handleUploadFile}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={uploading}
              />
              <UploadCloud className="w-6 h-6 text-[var(--foreground-dim)] group-hover:text-[var(--accent)] mx-auto mb-2 transition-colors" />
              {uploading ? (
                <span className="text-[10px] text-[var(--accent)] font-semibold flex items-center justify-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading to File Store...
                </span>
              ) : (
                <>
                  <p className="text-xs text-white font-bold">Upload Document</p>
                  <p className="text-[9px] text-[var(--foreground-dim)] mt-1">
                    PDF, TXT, MD, CSV, JSON (max 5MB)
                  </p>
                </>
              )}
            </div>

            {/* Documents List */}
            <div className="space-y-2">
              <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px]">
                Uploaded Files ({uploadedDocs.length})
              </span>
              
              {docsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                </div>
              ) : uploadedDocs.length === 0 ? (
                <div className="text-center py-6 text-[var(--foreground-dim)] bg-[var(--surface-dim)]/20 rounded-xl border border-[var(--border)] border-dashed">
                  <p className="text-[10px]">No documents uploaded.</p>
                  <p className="text-[8px] mt-0.5">Upload manuals or laws to start querying them.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
                  {uploadedDocs.map((doc) => (
                    <div
                      key={doc.file_id}
                      className="flex items-center justify-between p-2 bg-[var(--surface-dim)]/50 hover:bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-white truncate" title={doc.filename}>
                            {doc.filename}
                          </p>
                          <p className="text-[9px] text-[var(--foreground-dim)]">
                            {(doc.size_bytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteFile(doc.file_id)}
                        className="text-[var(--foreground-dim)] hover:text-red-400 p-1 rounded transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cited details */}
            {selectedCase && (
              <div className="border-t border-[var(--border)] pt-4 mt-4 space-y-4 animate-slide-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white truncate">{selectedCase.crime_no}</h4>
                    <p className="text-[9px] text-[var(--foreground-dim)] uppercase font-semibold">
                      Cited Record
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="text-[10px] text-[var(--foreground-dim)] hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[8px] mb-0.5">
                      Station & Date
                    </span>
                    <p className="text-[11px] text-white font-medium">
                      {selectedCase.police_station} ({selectedCase.crime_registered_date})
                    </p>
                  </div>
                  <div>
                    <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[8px] mb-0.5">
                      Narrative Snippet
                    </span>
                    <p className="text-[10px] text-[var(--foreground-muted)] leading-relaxed bg-[var(--surface-dim)] p-2 rounded-lg border border-[var(--border)] line-clamp-4">
                      {selectedCase.brief_facts}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Side Details panel (Database Mode if no Canvas or canvas card clicked) ── */}
      {mode === "database" && selectedCase && !selectedNode && (
        <div className="w-80 chart-container flex flex-col justify-between overflow-hidden animate-slide-in">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="text-sm font-bold truncate">{selectedCase.crime_no}</h3>
              <p className="text-[10px] text-[var(--foreground-dim)] uppercase font-semibold">
                Case Citation Details
              </p>
            </div>
            <button
              onClick={() => setSelectedCase(null)}
              className="text-xs text-[var(--foreground-dim)] hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            <div>
              <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px] mb-1">
                Police Station
              </span>
              <p className="text-white font-semibold">{selectedCase.police_station}</p>
            </div>
            <div>
              <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px] mb-1">
                Registered Date
              </span>
              <p className="text-white font-semibold">
                {selectedCase.crime_registered_date}
              </p>
            </div>
            <div>
              <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px] mb-1">
                Case Category
              </span>
              <p className="text-white font-semibold">
                {selectedCase.category_name} ({selectedCase.gravity})
              </p>
            </div>
            <div>
              <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px] mb-1">
                Brief Facts Narrative
              </span>
              <p className="text-[var(--foreground-muted)] leading-relaxed bg-[var(--surface-dim)] p-2.5 rounded-lg border border-[var(--border)]">
                {selectedCase.brief_facts}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Note Node Modal */}
      {showCustomNodeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm chart-container border border-[var(--border)] bg-[var(--surface-elevated)] p-6 space-y-4 animate-slide-in">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-[var(--primary)]" />
              Add Custom Note
            </h3>
            <form onSubmit={handleAddCustomNode} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase mb-1">
                  Note Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. Modus Operandi Match"
                  className="input w-full text-xs"
                  value={customNodeLabel}
                  onChange={(e) => setCustomNodeLabel(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase mb-1">
                  Details / Evidence
                </label>
                <textarea
                  placeholder="Details of suspect association or facts..."
                  className="input w-full text-xs h-24 resize-none"
                  value={customNodeDetails}
                  onChange={(e) => setCustomNodeDetails(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowCustomNodeModal(false)}
                  className="btn-secondary py-1.5 px-3"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 bg-[var(--primary)]">
                  Add Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}