"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { 
  Users, Search, Share2, ZoomIn, ZoomOut, Maximize2, GitPullRequest, 
  MapPin, AlertCircle, Plus, Trash2, Edit, ChevronRight, Info, HelpCircle
} from "lucide-react";
import api from "@/lib/api";

// Dynamically import force graph to prevent Next.js SSR window errors
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

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

export default function NetworkPage() {
  // Page Mode: "syndicate" | "canvas"
  const [pageMode, setPageMode] = useState<"syndicate" | "canvas">("canvas");

  // ==========================================
  // Mode 1: Co-Accused Syndicate Graph State
  // ==========================================
  const [accusedId, setAccusedId] = useState<number>(3); // Default accused
  const [graphData, setGraphData] = useState<any>(null);
  const [clusters, setClusters] = useState<any>([]);
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [inputVal, setInputVal] = useState("3");
  const fgRef = useRef<any>(null);

  useEffect(() => {
    if (pageMode !== "syndicate") return;
    async function loadGraph() {
      setLoadingGraph(true);
      try {
        const [graphRes, clusterRes] = await Promise.all([
          api.network.accused(accusedId, 2),
          api.network.clusters()
        ]);
        
        const formattedNodes = graphRes.nodes.map((n: any) => ({
          id: n.id,
          name: n.label,
          val: n.size || 8,
          color: n.color || "#3B82F6",
          type: n.type
        }));
        
        const formattedLinks = graphRes.edges.map((e: any) => ({
          source: e.source,
          target: e.target,
          label: e.relationship
        }));
        
        setGraphData({ nodes: formattedNodes, links: formattedLinks });
        setClusters(clusterRes.clusters);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingGraph(false);
      }
    }
    loadGraph();
  }, [accusedId, pageMode]);

  const handleSearchGraph = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(inputVal);
    if (!isNaN(id)) {
      setAccusedId(id);
    }
  };

  const handleNodeClick = (node: any) => {
    if (node.type === "accused") {
      const match = node.id.match(/\d+/);
      if (match) {
        setAccusedId(parseInt(match[0]));
        setInputVal(match[0]);
      }
    }
  };

  // ==========================================
  // Mode 2: Interactive Investigation Canvas State
  // ==========================================
  const [casesList, setCasesList] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [loadingCanvas, setLoadingCanvas] = useState(false);
  const [searchCaseNo, setSearchCaseNo] = useState("");

  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [links, setLinks] = useState<CanvasLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);

  // Drag State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Wiring State (connecting anchors)
  const [activeAnchor, setActiveAnchor] = useState<{
    nodeId: string;
    anchor: "top" | "right" | "bottom" | "left";
  } | null>(null);

  // Custom node input
  const [showCustomNodeModal, setShowCustomNodeModal] = useState(false);
  const [customNodeType, setCustomNodeType] = useState<"note" | "suspect">("note");
  const [customNodeLabel, setCustomNodeLabel] = useState("");
  const [customNodeDetails, setCustomNodeDetails] = useState("");

  // Load available cases on mount
  useEffect(() => {
    async function loadCases() {
      try {
        const res = await api.cases.list({ page: 1, page_size: 50 });
        setCasesList(res.items || []);
        if (res.items && res.items.length > 0) {
          handleSelectCase(res.items[0].ROWID);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadCases();
  }, []);

  const handleSelectCase = async (caseId: number) => {
    setLoadingCanvas(true);
    setSelectedCaseId(caseId);
    try {
      // 1. Fetch case details (includes accused_list)
      const caseDetail = await api.cases.get(caseId);
      // 2. Fetch similar suspects sharing same crime type/district
      const relatedSuspects = await api.cases.getSimilarSuspects(caseId);

      // Create new initial Canvas Nodes
      const newNodes: CanvasNode[] = [];
      const newLinks: CanvasLink[] = [];

      // A. Center Case Node
      const caseNodeId = `case-${caseDetail.ROWID}`;
      newNodes.push({
        id: caseNodeId,
        type: "case",
        label: caseDetail.crime_no,
        x: 100,
        y: 180,
        details: caseDetail
      });

      // B. Primary Suspect Nodes (Current Accused)
      caseDetail.accused_list.forEach((acc: any, index: number) => {
        const accusedNodeId = `suspect-${acc.ROWID}`;
        newNodes.push({
          id: accusedNodeId,
          type: "suspect",
          label: acc.accused_name,
          x: 400,
          y: 60 + index * 130,
          details: {
            ...acc,
            status: "Primary Accused",
            police_station: caseDetail.police_station,
            district_name: caseDetail.district_name,
            crime_no: caseDetail.crime_no
          }
        });

        // Link primary accused to case node (Right of case connects to Left of suspect)
        newLinks.push({
          id: `link-init-${accusedNodeId}`,
          fromId: caseNodeId,
          fromAnchor: "right",
          toId: accusedNodeId,
          toAnchor: "left",
          label: "Accused"
        });
      });

      // C. Related suspects (Criminals in the same area / same crime)
      relatedSuspects.forEach((rel: any, index: number) => {
        const relatedNodeId = `related-${rel.ROWID}`;
        newNodes.push({
          id: relatedNodeId,
          type: "related",
          label: rel.accused_name,
          x: 700,
          y: 60 + index * 130,
          details: rel
        });
      });

      setNodes(newNodes);
      setLinks(newLinks);
      setSelectedNode(newNodes[0]); // default select the Case node
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCanvas(false);
    }
  };

  // Drag handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    // Avoid triggering drag if clicking on anchor handles or delete buttons
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

  // Wire connecting handler
  const handleAnchorClick = (
    nodeId: string,
    anchor: "top" | "right" | "bottom" | "left"
  ) => {
    if (!activeAnchor) {
      // Start connecting
      setActiveAnchor({ nodeId, anchor });
    } else {
      // Connect to second anchor (if not same node)
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
            label: "Related"
          }
        ]);
      }
      setActiveAnchor(null);
    }
  };

  // Delete line
  const handleDeleteLink = (linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setLinks(prev => prev.filter(l => l.fromId !== nodeId && l.toId !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  // Add Custom Node
  const handleAddCustomNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNodeLabel) return;

    const newNodeId = `custom-${Date.now()}`;
    const newNode: CanvasNode = {
      id: newNodeId,
      type: customNodeType,
      label: customNodeLabel,
      x: 150,
      y: 80,
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

  // Helper coordinates calculation for drawing links
  const getNodeAnchorCoords = (
    node: CanvasNode,
    anchor: "top" | "right" | "bottom" | "left"
  ) => {
    const cardWidth = 200;
    const cardHeight = 110;

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
    <div className="space-y-6">
      
      {/* Header and Toggle */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Intelligence Link Analysis</h2>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            Explore mapped co-offence syndicates or build an interactive case board to link suspects, facts, and custom notes.
          </p>
        </div>

        {/* Mode Toggle Button */}
        <div className="flex bg-[var(--surface-elevated)] p-1 rounded-lg border border-[var(--border)] self-stretch md:self-auto">
          <button
            onClick={() => setPageMode("canvas")}
            className={`flex-1 md:flex-none py-1.5 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              pageMode === "canvas"
                ? "bg-[var(--primary)] text-[var(--foreground)] shadow-md shadow-[var(--primary-glow)]/10"
                : "text-[var(--foreground-dim)] hover:text-white"
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            Investigation Canvas
          </button>
          <button
            onClick={() => setPageMode("syndicate")}
            className={`flex-1 md:flex-none py-1.5 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              pageMode === "syndicate"
                ? "bg-[var(--primary)] text-[var(--foreground)] shadow-md"
                : "text-[var(--foreground-dim)] hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Syndicate Map
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODE 1: SYNDICATE MAP                                     */}
      {/* ======================================================== */}
      {pageMode === "syndicate" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="chart-container lg:col-span-2 min-h-[550px] relative overflow-hidden flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Syndicate Graph (Accused #{accusedId})</h3>
                <p className="text-xs text-[var(--foreground-dim)]">Red nodes denote accused, Yellow nodes denote cases</p>
              </div>

              {/* Controls */}
              <form onSubmit={handleSearchGraph} className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Accused ID (e.g. 3)" 
                  className="input w-36 text-xs py-1 px-3"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                />
                <button type="submit" className="btn-secondary py-1 px-3 text-xs">Search</button>
                <button type="button" onClick={() => fgRef.current?.zoomToFit(400)} className="btn-secondary p-1.5 rounded-lg text-xs" title="Reset View">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            <div className="flex-1 w-full bg-[var(--surface-dim)] border border-[var(--border)] rounded-xl relative min-h-[400px]">
              {loadingGraph && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10">
                  <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {graphData && (
                <ForceGraph2D
                  ref={fgRef}
                  graphData={graphData}
                  nodeLabel="name"
                  nodeColor={(node: any) => node.color}
                  nodeVal={(node: any) => node.val}
                  linkColor={() => "rgba(0,0,0,0.15)"}
                  linkWidth={1.5}
                  nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
                    const label = node.name;
                    const fontSize = 11 / globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    ctx.fillStyle = node.color;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, node.val / 1.5, 0, 2 * Math.PI, false);
                    ctx.fill();

                    // Label text background shadow
                    ctx.fillStyle = "rgba(255,255,255,0.8)";
                    ctx.fillText(label, node.x + node.val / 1.3, node.y + fontSize / 3.5);
                    // Actual text
                    ctx.fillStyle = "#111827";
                    ctx.fillText(label, node.x + node.val / 1.3, node.y + fontSize / 3.5);
                  }}
                  onNodeClick={handleNodeClick}
                />
              )}
            </div>
          </div>

          {/* Communities Sidebar */}
          <div className="chart-container flex flex-col justify-between max-h-[550px]">
            <div className="mb-4">
              <h3 className="text-sm font-bold">Syndicate Clusters</h3>
              <p className="text-xs text-[var(--foreground-dim)]">Detected co-offence communities</p>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {clusters.map((c: any) => (
                <div key={c.cluster_id} className="p-4 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--primary)]">Syndicate Ring #{c.cluster_id}</span>
                    <span className="badge badge-danger text-[10px]">{c.size} Accused</span>
                  </div>
                  <div className="text-[11px] text-[var(--foreground-muted)]">
                    <span className="font-semibold text-[var(--foreground-dim)]">Members:</span>{" "}
                    {c.members.join(", ")}
                  </div>
                  <div className="text-[11px] text-[var(--foreground-dim)]">
                    Linked across <span className="text-[var(--foreground)] font-semibold">{c.case_count} offences</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: INTERACTIVE INVESTIGATION CANVAS                   */}
      {/* ======================================================== */}
      {pageMode === "canvas" && (
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col space-y-4">
            
            {/* Toolbar Panel */}
            <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--foreground-dim)] uppercase">Focus Case Docket</span>
                <select 
                  className="input cursor-pointer py-1 px-3 text-xs w-64"
                  value={selectedCaseId || ""}
                  onChange={(e) => handleSelectCase(Number(e.target.value))}
                >
                  {casesList.map(c => (
                    <option key={c.ROWID} value={c.ROWID}>
                      {c.crime_no} ({c.police_station})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => { setCustomNodeType("note"); setShowCustomNodeModal(true); }}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--primary)]" /> Add Note Node
                </button>
                <button 
                  onClick={() => { setCustomNodeType("suspect"); setShowCustomNodeModal(true); }}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--warning)]" /> Add Suspect Node
                </button>
              </div>
            </div>

            {/* Interactive Drawing Board */}
            <div 
              className="w-full h-[600px] bg-[var(--surface-dim)]/50 border border-[var(--border)] rounded-2xl relative overflow-hidden select-none cursor-crosshair"
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            >
              
              {/* Wiring Help tooltip */}
              <div className="absolute top-4 left-4 z-20 bg-black/70 backdrop-blur-md border border-[var(--border)] rounded-lg p-3 text-[10px] text-[var(--foreground-muted)] max-w-xs space-y-1">
                <p className="font-semibold text-[var(--foreground)] flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-[var(--primary)]" /> Canvas Instructions
                </p>
                <p>• <b>Drag headers</b> to position suspect & case cards.</p>
                <p>• <b>Click any anchor handle</b> (○) on Card A, then click an anchor handle on Card B to connect them with a wire.</p>
                <p>• <b>Double click</b> any wire to delete the connection.</p>
              </div>

              {/* Dynamic SVG Connection Layer */}
              <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
                {links.map((link) => {
                  const fromNode = nodes.find(n => n.id === link.fromId);
                  const toNode = nodes.find(n => n.id === link.toId);
                  if (!fromNode || !toNode) return null;

                  const start = getNodeAnchorCoords(fromNode, link.fromAnchor);
                  const end = getNodeAnchorCoords(toNode, link.toAnchor);

                  // Curve calculation
                  const dx = Math.abs(end.x - start.x) * 0.5;
                  const dy = Math.abs(end.y - start.y) * 0.5;
                  const c1x = link.fromAnchor === "right" ? start.x + dx : link.fromAnchor === "left" ? start.x - dx : start.x;
                  const c1y = link.fromAnchor === "bottom" ? start.y + dy : link.fromAnchor === "top" ? start.y - dy : start.y;
                  const c2x = link.toAnchor === "right" ? end.x + dx : link.toAnchor === "left" ? end.x - dx : end.x;
                  const c2y = link.toAnchor === "bottom" ? end.y + dy : link.toAnchor === "top" ? end.y - dy : end.y;

                  return (
                    <g key={link.id} className="pointer-events-auto cursor-pointer group">
                      {/* Interactive thick hover wire */}
                      <path
                        d={`M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="10"
                        onDoubleClick={() => handleDeleteLink(link.id)}
                        className="hover:stroke-red-500/20 transition-colors"
                      >
                        <title>Double-click to delete link</title>
                      </path>
                      {/* Glow stroke */}
                      <path
                        d={`M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="2"
                        className="stroke-[var(--primary)]/30 group-hover:stroke-red-500/80 transition-colors"
                      />
                      {/* Central Link Label if exists */}
                      <text
                        x={(start.x + end.x) / 2}
                        y={(start.y + end.y) / 2}
                        fill="var(--foreground-dim)"
                        fontSize="9"
                        textAnchor="middle"
                        className="bg-black select-none pointer-events-none"
                      >
                        {link.label || ""}
                      </text>
                    </g>
                  );
                })}

                {/* Currently Active connection line (dragging helper) */}
                {activeAnchor && (() => {
                  const node = nodes.find(n => n.id === activeAnchor.nodeId);
                  if (!node) return null;
                  const coords = getNodeAnchorCoords(node, activeAnchor.anchor);
                  return (
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r="5"
                      fill="none"
                      stroke="var(--warning)"
                      strokeWidth="2"
                      className="animate-ping"
                    />
                  );
                })()}
              </svg>

              {/* Render Nodes (Cards) */}
              <div className="absolute inset-0 z-10 pointer-events-none">
                {loadingCanvas ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm z-30">
                    <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : null}

                {nodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  let cardColorClass = "";
                  
                  if (node.type === "case") cardColorClass = "border-blue-500/40 bg-blue-950/20";
                  else if (node.type === "suspect") cardColorClass = "border-amber-500/40 bg-amber-950/20";
                  else if (node.type === "related") cardColorClass = "border-cyan-500/40 bg-cyan-950/20";
                  else cardColorClass = "border-emerald-500/40 bg-emerald-950/20";

                  return (
                    <div
                      key={node.id}
                      style={{ left: node.x, top: node.y }}
                      className={`absolute w-[200px] h-[110px] rounded-xl border glass-card flex flex-col justify-between p-3 select-none pointer-events-auto cursor-default transition-shadow shadow-md ${cardColorClass} ${
                        isSelected ? "ring-2 ring-[var(--primary)] shadow-lg shadow-[var(--primary-glow)]/10" : ""
                      }`}
                      onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    >
                      {/* Node Header */}
                      <div className="flex items-center justify-between cursor-move bg-white/5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase text-[var(--foreground)] truncate">
                        <span className="truncate">{node.type}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedNode(node)}
                            className="p-0.5 text-[var(--foreground-dim)] hover:text-white"
                            title="Inspect info"
                          >
                            <Info className="w-3 h-3" />
                          </button>
                          {node.type !== "case" && (
                            <button
                              onClick={() => handleDeleteNode(node.id)}
                              className="delete-btn p-0.5 text-red-400 hover:text-red-300"
                              title="Delete point"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Node Content */}
                      <div className="flex-1 flex flex-col justify-center py-2 px-1">
                        <p className="text-xs font-bold text-[var(--foreground)] leading-tight truncate">{node.label}</p>
                        {node.type === "suspect" && (
                          <span className="text-[9px] text-amber-300 mt-0.5">Primary Accused</span>
                        )}
                        {node.type === "related" && (
                          <span className="text-[9px] text-cyan-300 mt-0.5">Similar Suspect (Same Area)</span>
                        )}
                        {node.type === "note" && (
                          <span className="text-[9px] text-emerald-300 mt-0.5 truncate">{node.details?.description || "Memo"}</span>
                        )}
                      </div>

                      {/* 4 Connection Anchors (○) */}
                      {/* Top */}
                      <button
                        onClick={() => handleAnchorClick(node.id, "top")}
                        className="anchor-handle absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full hover:bg-[var(--primary)] hover:scale-125 transition-all z-20 flex items-center justify-center cursor-pointer"
                        title="Connect Top"
                      >
                        <span className="w-1 h-1 bg-[var(--foreground-dim)] rounded-full" />
                      </button>
                      {/* Bottom */}
                      <button
                        onClick={() => handleAnchorClick(node.id, "bottom")}
                        className="anchor-handle absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full hover:bg-[var(--primary)] hover:scale-125 transition-all z-20 flex items-center justify-center cursor-pointer"
                        title="Connect Bottom"
                      >
                        <span className="w-1 h-1 bg-[var(--foreground-dim)] rounded-full" />
                      </button>
                      {/* Left */}
                      <button
                        onClick={() => handleAnchorClick(node.id, "left")}
                        className="anchor-handle absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full hover:bg-[var(--primary)] hover:scale-125 transition-all z-20 flex items-center justify-center cursor-pointer"
                        title="Connect Left"
                      >
                        <span className="w-1 h-1 bg-[var(--foreground-dim)] rounded-full" />
                      </button>
                      {/* Right */}
                      <button
                        onClick={() => handleAnchorClick(node.id, "right")}
                        className="anchor-handle absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full hover:bg-[var(--primary)] hover:scale-125 transition-all z-20 flex items-center justify-center cursor-pointer"
                        title="Connect Right"
                      >
                        <span className="w-1 h-1 bg-[var(--foreground-dim)] rounded-full" />
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          {/* Details Sidebar Panel */}
          <div className="w-full lg:w-80 chart-container max-h-[670px] overflow-y-auto flex flex-col justify-between">
            <div className="space-y-6 text-xs">
              <div className="border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1">
                  🔍 Point Analysis
                </h3>
                <p className="text-[10px] text-[var(--foreground-dim)]">Inspect facts and cross-references of nodes</p>
              </div>

              {!selectedNode ? (
                <div className="text-center py-12 text-[var(--foreground-dim)]">
                  Click on any card to view intelligence details
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Card Type Header Badge */}
                  <div>
                    <span className={`badge ${
                      selectedNode.type === "case" ? "badge-info" :
                      selectedNode.type === "suspect" ? "badge-danger" :
                      selectedNode.type === "related" ? "badge-warning" : "badge-success"
                    } uppercase text-[9px] font-bold`}>
                      {selectedNode.type} Node
                    </span>
                    <h4 className="text-base font-bold text-[var(--foreground)] mt-1.5">{selectedNode.label}</h4>
                  </div>

                  {/* Case Node details */}
                  {selectedNode.type === "case" && selectedNode.details && (
                    <div className="space-y-3">
                      <div>
                        <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Registered Date</span>
                        <p className="text-[var(--foreground)] font-semibold">{selectedNode.details.crime_registered_date}</p>
                      </div>
                      <div>
                        <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Jurisdiction Station</span>
                        <p className="text-[var(--foreground)] font-semibold">{selectedNode.details.police_station}</p>
                      </div>
                      <div>
                        <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">District</span>
                        <p className="text-[var(--foreground)] font-semibold">{selectedNode.details.district_name}</p>
                      </div>
                      <div>
                        <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Offence Sub-Head</span>
                        <p className="text-[var(--primary)] font-semibold">{selectedNode.details.crime_sub_head}</p>
                      </div>
                      <div className="pt-2 border-t border-[var(--border)]">
                        <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase mb-1">Brief Facts</span>
                        <p className="text-[var(--foreground-muted)] leading-relaxed bg-[var(--surface-dim)] p-3 rounded-lg border border-[var(--border)]">
                          {selectedNode.details.brief_facts}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Suspect / Related Accused details */}
                  {(selectedNode.type === "suspect" || selectedNode.type === "related") && selectedNode.details && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 bg-[var(--surface-dim)] p-2.5 rounded-lg border border-[var(--border)]">
                        <div>
                          <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Age</span>
                          <p className="text-[var(--foreground)] font-semibold">{selectedNode.details.age_year || "Unknown"}</p>
                        </div>
                        <div>
                          <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Gender</span>
                          <p className="text-[var(--foreground)] font-semibold">{selectedNode.details.gender}</p>
                        </div>
                      </div>

                      {selectedNode.details.crime_no && (
                        <>
                          <div>
                            <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Linked FIR No</span>
                            <p className="text-[var(--foreground)] font-semibold flex items-center gap-1">
                              {selectedNode.details.crime_no}
                              {selectedNode.type === "related" && (
                                <span className="badge badge-warning text-[8px] py-0">Similar Case</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Police Station / Area</span>
                            <p className="text-[var(--foreground)] font-semibold">{selectedNode.details.police_station} ({selectedNode.details.district_name})</p>
                          </div>
                          <div>
                            <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Crime Sub-Head Type</span>
                            <p className="text-[var(--primary)] font-semibold">{selectedNode.details.crime_sub_head}</p>
                          </div>
                          <div className="pt-2 border-t border-[var(--border)]">
                            <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase mb-1">Brief Facts of Match</span>
                            <p className="text-[var(--foreground-muted)] leading-relaxed bg-[var(--surface-dim)] p-3 rounded-lg border border-[var(--border)] max-h-40 overflow-y-auto">
                              {selectedNode.details.brief_facts}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Custom Note Node Details */}
                  {selectedNode.type === "note" && (
                    <div className="space-y-3">
                      <div>
                        <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Note Description</span>
                        <p className="text-[var(--foreground)] bg-[var(--surface-dim)] p-3 rounded-lg border border-[var(--border)] leading-relaxed font-sans whitespace-pre-line mt-1">
                          {selectedNode.details?.description || "No text description added."}
                        </p>
                      </div>
                      <div>
                        <span className="block font-bold text-[var(--foreground-dim)] text-[9px] uppercase">Added At</span>
                        <p className="text-[var(--foreground-muted)] mt-0.5">{selectedNode.details?.created_at}</p>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 🚀 MODAL: ADD CUSTOM POINT / NOTE                         */}
      {/* ======================================================== */}
      {showCustomNodeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-in border border-[var(--border)] text-xs">
            <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
              Add Custom {customNodeType === "note" ? "Note Memo" : "Suspect Point"} to Canvas
            </h3>

            <form onSubmit={handleAddCustomNode} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">
                  {customNodeType === "note" ? "Memo Title *" : "Suspect Full Name *"}
                </label>
                <input 
                  type="text" className="input" required
                  placeholder={customNodeType === "note" ? "e.g. Witness observations" : "e.g. Ramesh Gowda"}
                  value={customNodeLabel}
                  onChange={(e) => setCustomNodeLabel(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[var(--foreground-muted)] uppercase">
                  Description / Facts Detail
                </label>
                <textarea 
                  rows={4}
                  placeholder={customNodeType === "note" ? "Write custom observations, facts, or logs..." : "Add details like suspected location, link references..."}
                  className="input resize-none font-sans text-xs"
                  value={customNodeDetails}
                  onChange={(e) => setCustomNodeDetails(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border)]">
                <button type="button" onClick={() => setShowCustomNodeModal(false)} className="btn-secondary py-1.5 px-3">Cancel</button>
                <button type="submit" className="btn-primary py-1.5 px-4 flex items-center gap-1">
                  Add Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}