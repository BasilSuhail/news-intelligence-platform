import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes, type ClusterNodeData } from './CustomNodes';
import { edgeTypes } from './CustomEdges';
import type { ArticleCluster } from '@/types/intelligence';

// ============================================================================
// TYPES
// ============================================================================

interface CausalFlowGraphProps {
  clusters: ArticleCluster[];
  onNodeClick: (clusterId: string | null) => void;
  selectedId: string | null;
}

// ============================================================================
// CONFIG - Limit complexity
// ============================================================================

const MAX_NODES = 6;        // Only show top 6 clusters
const MAX_EDGES = 5;        // Only show top 5 connections
const MIN_CORRELATION = 0.3; // Higher threshold for cleaner graph

const NODE_WIDTH = 240;
const NODE_HEIGHT = 160;
const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 100;

// ============================================================================
// LAYOUT
// ============================================================================

const getCleanLayout = (
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: ClusterNodeData; selected?: boolean }>,
  edges: Array<{ id: string; source: string; target: string; type: string; data: { correlation: number; confidence: number }; animated?: boolean }>
) => {
  // 2 columns layout for cleaner appearance
  const cols = 2;

  const layoutedNodes = nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    return {
      ...node,
      position: {
        x: col * (NODE_WIDTH + HORIZONTAL_GAP),
        y: row * (NODE_HEIGHT + VERTICAL_GAP),
      },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    };
  });

  return { nodes: layoutedNodes, edges };
};

// ============================================================================
// CORRELATION CALCULATION
// ============================================================================

const calculateCorrelation = (a: ArticleCluster, b: ArticleCluster): number => {
  const sharedKeywords = a.keywords.filter(k =>
    b.keywords.some(bk =>
      bk.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(bk.toLowerCase())
    )
  );

  const sharedCategories = a.categories.filter(c => b.categories.includes(c));
  const sentimentAlignment = (a.aggregateSentiment * b.aggregateSentiment) > 0 ? 0.2 : -0.1;

  const baseCorrelation = (sharedKeywords.length * 0.15 + sharedCategories.length * 0.1 + sentimentAlignment);
  return Math.max(-1, Math.min(1, baseCorrelation));
};

// ============================================================================
// COMPONENT
// ============================================================================

export function CausalFlowGraph({ clusters, onNodeClick, selectedId }: CausalFlowGraphProps) {
  // Sort by impact and take top clusters only
  const topClusters = useMemo(() => {
    return [...clusters]
      .sort((a, b) => b.aggregateImpact - a.aggregateImpact)
      .slice(0, MAX_NODES);
  }, [clusters]);

  // Build nodes from top clusters
  const initialNodes = useMemo(() => {
    return topClusters.map((cluster, index) => ({
      id: cluster.id,
      type: 'cluster',
      position: { x: 0, y: 0 },
      data: {
        label: cluster.topic,
        sentiment: cluster.aggregateSentiment,
        impact: cluster.aggregateImpact,
        keywords: cluster.keywords,
        articleCount: cluster.articleCount,
        type: (index === 0 ? 'event' : index < 3 ? 'consequence' : 'cluster') as 'event' | 'consequence' | 'cluster',
      },
      selected: cluster.id === selectedId,
    }));
  }, [topClusters, selectedId]);

  // Build edges - only strongest connections
  const initialEdges = useMemo(() => {
    const allEdges: Array<{ id: string; source: string; target: string; type: string; data: { correlation: number; confidence: number }; animated?: boolean; strength: number }> = [];

    for (let i = 0; i < topClusters.length; i++) {
      for (let j = i + 1; j < topClusters.length; j++) {
        const correlation = calculateCorrelation(topClusters[i], topClusters[j]);

        if (Math.abs(correlation) >= MIN_CORRELATION) {
          allEdges.push({
            id: `e-${topClusters[i].id}-${topClusters[j].id}`,
            source: topClusters[i].id,
            target: topClusters[j].id,
            type: 'correlation',
            data: {
              correlation,
              confidence: Math.abs(correlation) * 100,
            },
            animated: false,
            strength: Math.abs(correlation),
          });
        }
      }
    }

    // Only keep top edges
    return allEdges
      .sort((a, b) => b.strength - a.strength)
      .slice(0, MAX_EDGES)
      .map(({ strength, ...edge }) => edge);
  }, [topClusters]);

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getCleanLayout(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes when selection changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: node.id === selectedId,
      }))
    );
  }, [selectedId, setNodes]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      onNodeClick(node.id === selectedId ? null : node.id);
    },
    [onNodeClick, selectedId]
  );

  // Handle background click
  const handlePaneClick = useCallback(() => {
    onNodeClick(null);
  }, [onNodeClick]);

  if (!clusters || clusters.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-gray-500 dark:text-neutral-500 border border-dashed border-gray-200 dark:border-neutral-800 rounded-2xl">
        No cluster data available for visualization
      </div>
    );
  }

  return (
    <div className="h-[450px] rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 bg-gradient-to-br from-gray-50 to-white dark:from-neutral-900 dark:to-neutral-900/80">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.8}
        maxZoom={1.2}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(139, 92, 246, 0.1)"
        />
        <Controls
          className="!bg-white dark:!bg-neutral-800 !border-gray-200 dark:!border-neutral-700 !shadow-lg !rounded-lg"
          showInteractive={false}
          showFitView={true}
          showZoom={true}
        />
      </ReactFlow>
    </div>
  );
}
