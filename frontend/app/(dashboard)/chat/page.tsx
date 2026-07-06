"use client";
import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, AlertTriangle, ShieldCheck, ChevronRight } from "lucide-react";
import api from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  refs?: any[];
  intent?: string;
}

export default function ChatPage() {
  const [sessionUuid, setSessionUuid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested starter queries
  const suggestedQueries = [
    "Find cases involving repeat offender Basavaraj",
    "Compare crime trends in Mysuru vs Bengaluru",
    "List cyber crime cases registered in last month",
    "Identify any heinous offenses flagged in Mangaluru"
  ];

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
      content: text
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.chat.sendMessage(sessionUuid, text);
      const botMsg: Message = {
        id: response.message_id,
        role: "assistant",
        content: response.content,
        refs: response.retrieved_doc_refs,
        intent: response.intent
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Sorry, I encountered an issue processing your query. Please try again."
      }]);
    } finally {
      setLoading(false);
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

  return (
    <div className="flex gap-6 h-[calc(100vh-var(--header-height)-3rem)] min-h-[500px]">
      
      {/* Main Chat Panel */}
      <div className="flex-1 chart-container flex flex-col justify-between p-0 overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-dim)]/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--primary)]" />
            <div>
              <h3 className="text-sm font-bold">Conversational Intelligence Assistant</h3>
              <p className="text-[10px] text-[var(--foreground-dim)] font-semibold uppercase tracking-wider">NVIDIA NIM & RAG Powered</p>
            </div>
          </div>
          {sessionUuid && (
            <span className="badge badge-success text-[9px] font-mono">ID: {sessionUuid.substring(0, 8)}</span>
          )}
        </div>

        {/* Message timeline */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[var(--primary-glow)] flex items-center justify-center text-[var(--primary)] animate-pulse">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white">Ask the Crime Database</h4>
                <p className="text-xs text-[var(--foreground-dim)] mt-2">
                  Query FIR facts, search offenders, predict future hotspots, or compare local trends in natural language.
                </p>
              </div>

              {/* Suggestions list */}
              <div className="w-full grid grid-cols-1 gap-2.5">
                {suggestedQueries.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSendMessage(q)}
                    className="p-3 text-left bg-[var(--surface-elevated)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl text-xs text-[var(--foreground-muted)] transition-all flex items-center justify-between"
                  >
                    <span>{q}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-slide-in`}>
                <div className={`chat-bubble ${m.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"} space-y-3`}>
                  <p>{m.content}</p>
                  
                  {/* Citations / Doc references */}
                  {m.refs && m.refs.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border)]/40 mt-2 space-y-1">
                      <span className="block text-[10px] font-bold text-[var(--foreground-dim)] uppercase tracking-wider">Citations</span>
                      <div className="flex flex-wrap gap-1.5">
                        {m.refs.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => handleShowCase(r.case_master_id)}
                            className="badge badge-info text-[9px] cursor-pointer hover:bg-[var(--accent)] hover:text-white transition-colors"
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
          {loading && (
            <div className="flex justify-start">
              <div className="chat-bubble chat-bubble-assistant flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[var(--foreground-dim)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-[var(--foreground-dim)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-[var(--foreground-dim)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-dim)]/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              placeholder="Ask anything..."
              className="input flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn-primary flex items-center justify-center p-3 shrink-0" disabled={loading}>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Side Case Details panel */}
      {selectedCase && (
        <div className="w-80 chart-container flex flex-col justify-between overflow-hidden animate-slide-in">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="text-sm font-bold truncate">{selectedCase.crime_no}</h3>
              <p className="text-[10px] text-[var(--foreground-dim)] uppercase font-semibold">Case Citation Details</p>
            </div>
            <button onClick={() => setSelectedCase(null)} className="text-xs text-[var(--foreground-dim)] hover:text-white">Close</button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            <div>
              <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px] mb-1">Police Station</span>
              <p className="text-white font-semibold">{selectedCase.police_station}</p>
            </div>
            <div>
              <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px] mb-1">Registered Date</span>
              <p className="text-white font-semibold">{selectedCase.crime_registered_date}</p>
            </div>
            <div>
              <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px] mb-1">Case Category</span>
              <p className="text-white font-semibold">{selectedCase.category_name} ({selectedCase.gravity})</p>
            </div>
            <div>
              <span className="block font-bold text-[var(--foreground-dim)] uppercase text-[9px] mb-1">Brief Facts Narrative</span>
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