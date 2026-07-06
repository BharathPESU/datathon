"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Users, Search, Share2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import api from "@/lib/api";

// Dynamically import force graph to prevent Next.js SSR window errors
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export default function NetworkPage() {
  const [accusedId, setAccusedId] = useState<number>(3); // Default accused
  const [graphData, setGraphData] = useState<any>(null);
  const [clusters, setClusters] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [inputVal, setInputVal] = useState("3");
  const fgRef = useRef<any>(null);

  useEffect(() => {
    async function loadGraph() {
      setLoading(true);
      try {
        const [graphRes, clusterRes] = await Promise.all([
          api.network.accused(accusedId, 2),
          api.network.clusters()
        ]);
        
        // Format for react-force-graph-2d
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
        setLoading(false);
      }
    }
    loadGraph();
  }, [accusedId]);

  const handleSearch = (e: React.FormEvent) => {
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

  return (
    <div className="space-y-6">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold gradient-text">Co-Accused Syndicate Mapping</h2>
          <p className="text-xs text-[var(--foreground-dim)]">Interactive modular network visualization uncovering crime rings and shared offences</p>
        </div>
        
        {/* Search Panel */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-dim)]" />
            <input 
              type="number" 
              placeholder="Accused ID (e.g. 3)" 
              className="input pl-9 w-48 text-xs py-1.5"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary py-1.5 text-xs">Refocus Graph</button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Network Canvas */}
        <div className="chart-container lg:col-span-2 min-h-[550px] relative overflow-hidden flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Syndicate Graph (Accused #{accusedId})</h3>
              <p className="text-xs text-[var(--foreground-dim)]">Red nodes denote accused, Yellow nodes denote cases</p>
            </div>
            
            {/* Graph control overlays */}
            <div className="flex gap-1">
              <button onClick={() => fgRef.current?.zoomToFit(400)} className="btn-secondary p-1.5 rounded-lg text-xs" title="Reset View">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 w-full bg-[var(--surface-dim)] border border-[var(--border)] rounded-xl relative min-h-[400px]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10">
                <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : null}
            
            {graphData && (
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                nodeLabel="name"
                nodeColor={(node: any) => node.color}
                nodeVal={(node: any) => node.val}
                linkColor={() => "rgba(255,255,255,0.15)"}
                linkWidth={1.5}
                nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
                  const label = node.name;
                  const fontSize = 11 / globalScale;
                  ctx.font = `${fontSize}px Sans-Serif`;
                  ctx.fillStyle = node.color;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.val / 1.5, 0, 2 * Math.PI, false);
                  ctx.fill();
                  
                  // Label text shadows
                  ctx.fillStyle = "rgba(11,15,25,0.8)";
                  ctx.fillText(label, node.x + node.val / 1.3, node.y + fontSize / 3.5);
                  ctx.fillStyle = node.type === "accused" ? "#FFFFFF" : "var(--foreground-muted)";
                  ctx.fillText(label, node.x + node.val / 1.3, node.y + fontSize / 3.5);
                }}
                onNodeClick={handleNodeClick}
              />
            )}
          </div>
        </div>

        {/* Syndicate Communities / Clusters */}
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
                  Linked across <span className="text-white font-semibold">{c.case_count} offences</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}