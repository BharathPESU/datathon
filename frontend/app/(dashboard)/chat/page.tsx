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

export default function ChatPage() {
  const [sessionUuid, setSessionUuid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<QueryMode>("database");
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = mode === "database" ? DB_SUGGESTIONS : KB_SUGGESTIONS;

  useEffect(() => {
    async function startSession() {
      try {
        const res = await api.chat.createSession("en");
        setSessionUuid(res.session_id);
      } catch (err) {
        console.error("Failed to start chat session", err);
      }
    }
    startSession();
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
                      <div className="flex flex-wrap gap-1.5">
                        {m.refs.map((r, i) => (
                          <button
                            key={i}
                            onClick={() =>
                              r.case_master_id
                                ? handleShowCase(r.case_master_id)
                                : null
                            }
                            title={r.snippet || ""}
                            className={`badge text-[9px] cursor-pointer transition-colors ${
                              m.mode === "knowledge_base"
                                ? "badge-info hover:bg-[var(--accent)] hover:text-white"
                                : "badge-info hover:bg-[var(--primary)] hover:text-white"
                            }`}
                          >
                            {r.crime_no}
                          </button>
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

      {/* ── Side Case Details panel ── */}
      {selectedCase && (
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
    </div>
  );
}