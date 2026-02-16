import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TrendingUp, TrendingDown, Minus, Newspaper, Zap, Target } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface ClusterNodeData {
  label: string;
  sentiment: number;
  impact: number;
  keywords: string[];
  articleCount: number;
  type: 'cluster' | 'event' | 'consequence';
  [key: string]: unknown;
}

interface ClusterNodeProps {
  data: ClusterNodeData;
  selected?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

const getSentimentColor = (sentiment: number) => {
  if (sentiment > 10) return {
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    border: 'border-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    label: 'Bullish',
  };
  if (sentiment < -10) return {
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-400',
    text: 'text-red-600 dark:text-red-400',
    label: 'Bearish',
  };
  return {
    bg: 'bg-white dark:bg-neutral-800',
    border: 'border-gray-200 dark:border-neutral-700',
    text: 'text-gray-600 dark:text-neutral-400',
    label: 'Neutral',
  };
};

const getSentimentIcon = (sentiment: number) => {
  if (sentiment > 10) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (sentiment < -10) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'event': return <Zap className="w-3.5 h-3.5 text-amber-500" />;
    case 'consequence': return <Target className="w-3.5 h-3.5 text-blue-500" />;
    default: return <Newspaper className="w-3.5 h-3.5 text-violet-500" />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'event': return 'EVENT';
    case 'consequence': return 'EFFECT';
    default: return 'CLUSTER';
  }
};

// ============================================================================
// CLUSTER NODE COMPONENT
// ============================================================================

function ClusterNodeComponent({ data, selected }: ClusterNodeProps) {
  const colors = getSentimentColor(data.sentiment);

  return (
    <div
      className={`
        relative px-4 py-3 rounded-xl border-2 w-[220px] shadow-sm
        transition-all duration-200 cursor-pointer
        ${colors.bg} ${colors.border}
        ${selected ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-neutral-900 shadow-xl scale-[1.02]' : 'hover:shadow-lg hover:scale-[1.01]'}
      `}
    >
      {/* Left Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white dark:!border-neutral-900 !-left-1.5"
      />

      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {getTypeIcon(data.type)}
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
            {getTypeLabel(data.type)}
          </span>
        </div>
        <div className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500 text-white">
          {data.impact}
        </div>
      </div>

      {/* Topic Title */}
      <h4 className="text-sm font-semibold text-gray-800 dark:text-neutral-200 leading-snug line-clamp-2 mb-3">
        {data.label}
      </h4>

      {/* Sentiment Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getSentimentIcon(data.sentiment)}
          <span className={`text-xl font-semibold tabular-nums ${colors.text}`}>
            {data.sentiment > 0 ? '+' : ''}{data.sentiment.toFixed(0)}
          </span>
        </div>
        <span className={`text-[10px] font-medium uppercase ${colors.text}`}>
          {colors.label}
        </span>
      </div>

      {/* Keywords */}
      {data.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-neutral-700/50">
          {data.keywords.slice(0, 3).map((kw) => (
            <span
              key={kw}
              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-700/50 text-gray-500 dark:text-neutral-400"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 text-[9px] text-gray-400 dark:text-neutral-500">
        {data.articleCount} sources
      </div>

      {/* Right Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white dark:!border-neutral-900 !-right-1.5"
      />
    </div>
  );
}

export const ClusterNode = memo(ClusterNodeComponent);

// ============================================================================
// NODE TYPES EXPORT
// ============================================================================

export const nodeTypes = {
  cluster: ClusterNode,
};
