import { memo } from 'react';
import { getBezierPath, type Position } from '@xyflow/react';

// ============================================================================
// TYPES
// ============================================================================

export interface CorrelationEdgeData {
  correlation: number; // -1 to 1
  confidence: number;  // 0 to 100
  [key: string]: unknown; // Index signature for ReactFlow compatibility
}

interface CorrelationEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data?: CorrelationEdgeData;
  selected?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

const getEdgeColor = (correlation: number): string => {
  if (correlation > 0.3) return '#10b981'; // emerald-500
  if (correlation < -0.3) return '#ef4444'; // red-500
  return '#a78bfa'; // violet-400
};

const getEdgeWidth = (confidence: number): number => {
  if (confidence >= 80) return 3;
  if (confidence >= 50) return 2;
  return 1.5;
};

// ============================================================================
// CORRELATION EDGE COMPONENT
// ============================================================================

function CorrelationEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: CorrelationEdgeProps) {
  const correlation = data?.correlation ?? 0;
  const confidence = data?.confidence ?? 50;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = getEdgeColor(correlation);
  const width = getEdgeWidth(confidence);

  return (
    <>
      {/* Glow effect for selected edges */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={width + 4}
          strokeOpacity={0.3}
          className="transition-all duration-200"
        />
      )}

      {/* Main edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeOpacity={selected ? 1 : 0.6}
        strokeDasharray={correlation < 0 ? '5,5' : undefined}
        className="transition-all duration-200"
      />

      {/* Correlation label */}
      <foreignObject
        width={40}
        height={20}
        x={(sourceX + targetX) / 2 - 20}
        y={(sourceY + targetY) / 2 - 10}
        className="pointer-events-none"
      >
        <div
          className={`
            text-[8px] font-medium text-center py-0.5 px-1 rounded
            ${correlation > 0.3 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' :
              correlation < -0.3 ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' :
              'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-400'}
          `}
        >
          {correlation > 0 ? '+' : ''}{(correlation * 100).toFixed(0)}%
        </div>
      </foreignObject>
    </>
  );
}

export const CorrelationEdge = memo(CorrelationEdgeComponent);

// ============================================================================
// EDGE TYPES EXPORT
// ============================================================================

export const edgeTypes = {
  correlation: CorrelationEdge,
};
