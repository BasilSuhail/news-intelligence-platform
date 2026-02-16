import { useState } from "react";
import { CausalFlowGraph } from "./CausalFlowGraph";
import { EntityPanel } from "./EntityPanel";
import type { ArticleCluster } from "@/types/intelligence";
import { Badge } from "@/components/ui/badge";
import { Network, Info } from "lucide-react";

interface CausalIntelligenceProps {
  clusters: ArticleCluster[];
}

export function CausalIntelligence({ clusters }: CausalIntelligenceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCluster = selectedId
    ? clusters.find(c => c.id === selectedId) || null
    : null;

  return (
    <section data-section="causal" className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-800 dark:text-neutral-200 flex items-center gap-2">
          <Network className="w-5 h-5 text-violet-500" />
          Causal Intelligence Map
          <Badge variant="secondary" className="text-[10px] h-4 px-1">ReactFlow</Badge>
        </h2>
        <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-neutral-500">
          <Info className="w-3 h-3" />
          Click nodes to explore
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-[10px] text-gray-500 dark:text-neutral-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"></span>
          Bullish (&gt;15)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-gray-300 bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800/50"></span>
          Neutral
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-red-500 bg-red-50 dark:bg-red-900/30"></span>
          Bearish (&lt;-15)
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-6 h-0.5 bg-emerald-500"></span>
          Positive
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-0.5 bg-red-500 border-dashed" style={{ borderTop: '2px dashed #ef4444', height: 0 }}></span>
          Inverse
        </div>
      </div>

      {/* Flow Graph */}
      <CausalFlowGraph
        clusters={clusters}
        selectedId={selectedId}
        onNodeClick={setSelectedId}
      />

      {/* Entity Panel Sidebar */}
      <EntityPanel
        cluster={selectedCluster}
        onClose={() => setSelectedId(null)}
      />

      {/* Backdrop when panel is open (mobile) */}
      {selectedCluster && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 sm:hidden"
          onClick={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}
