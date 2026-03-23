// =============================================================================
// INTELLIGENCE DASHBOARD TYPES
// Extends existing DailyBriefing types for causal visualization
// =============================================================================

// Re-export existing types from MarketTerminal for consistency
export interface EnrichedArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: {
    normalizedScore: number;
    label: string;
  };
  impactScore: number;
  geoTags: string[];
  topics: string[];
}

export interface ArticleCluster {
  id: string;
  topic: string;
  keywords: string[];
  articles: EnrichedArticle[];
  aggregateSentiment: number;
  aggregateImpact: number;
  articleCount: number;
  categories: string[];
}

export interface DailyBriefing {
  date: string;
  executiveSummary: string;
  topClusters: ArticleCluster[];
  gprIndex: {
    current: number;
    trend: 'rising' | 'falling' | 'stable';
    history: Array<{ date: string; value: number }>;
  };
  marketSentiment: {
    overall: number;
    byCategory: Record<string, number>;
    trend: string;
  };
  isEmpty?: boolean;
}

// Graph visualization types (derived from existing data)
export interface GraphNode {
  id: string;
  label: string;
  type: 'cluster' | 'article';
  sentiment: number;
  impact: number;
  keywords?: string[];
  source?: string;
  categories?: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number; // Based on shared keywords/topics
}

// Component props
export interface CausalGraphProps {
  clusters: ArticleCluster[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export interface EntityPanelProps {
  cluster: ArticleCluster | null;
  onClose: () => void;
}

// =============================================================================
// HINDSIGHT VALIDATION TYPES (Phase 1)
// =============================================================================

export interface BacktestDataPoint {
  date: string;
  sentimentScore: number;
  marketReturn: number;
  directionMatch: boolean;
  gprScore: number;
}

export interface ValidationResult {
  id: string;
  periodStart: string;
  periodEnd: string;
  sentimentAccuracy: number;
  pearsonCorrelation: number;
  spearmanCorrelation: number;
  gprCorrelation: number;
  sampleSize: number;
  dataPoints: BacktestDataPoint[];
  calculatedAt: string;
  isEmpty?: boolean;
  message?: string;
}

// =============================================================================
// ENTITY SENTIMENT TYPES (Phase 2)
// =============================================================================

export interface EntitySentimentPoint {
  entity: string;
  entityType: string;
  date: string;
  avgSentiment: number;
  articleCount: number;
}

export interface TopEntity {
  entity: string;
  entityType: string;
  totalMentions: number;
  avgSentiment: number;
}

// =============================================================================
// ANOMALY TYPES (Phase 3B)
// =============================================================================

export interface AnomalyAlert {
  category: string;
  currentVolume: number;
  rollingAvg7d: number;
  zScore: number;
  isAnomaly: boolean;
  message: string;
  date: string;
}
