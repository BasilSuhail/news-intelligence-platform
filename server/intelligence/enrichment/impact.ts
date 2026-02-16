import {
    ImpactFactors,
    ArticleCategory
} from '../core/types';

/**
 * Market Intelligence - Impact Scoring Engine
 * 
 * Implements the formula from Phase 3:
 * Impact = (|Sentiment| × 0.4) + (ClusterSize × 0.3) + (SourceWeight × 0.2) + (Recency × 0.1)
 */
export class ImpactEngine {
    // Source Weights Tier List
    private static readonly SOURCE_WEIGHTS: Record<string, number> = {
        // Tier 1 (1.3)
        'reuters': 1.3,
        'bloomberg': 1.3,
        'financial-times': 1.3,
        'the-wall-street-journal': 1.3,
        'associated-press': 1.3,
        'the-economist': 1.3,

        // Tier 2 (1.1)
        'techcrunch': 1.1,
        'ars-technica': 1.1,
        'the-verge': 1.1,
        'cnbc': 1.1,
        'bbc-news': 1.1,
        'wired': 1.1,
        'mit-technology-review': 1.1,

        // Default Tier 3 (1.0)
        'default': 1.0,

        // Tier 4 (0.8)
        'unknown': 0.8,
        'content-farm': 0.7
    };

    /**
     * Calculate impact score for an article
     */
    public static calculate(
        factors: ImpactFactors,
        sourceId: string = 'default'
    ): number {
        const weights = {
            sentiment: 0.4,
            cluster: 0.3,
            source: 0.2,
            recency: 0.1
        };

        // Normalize source weight to 0-100 scale (1.3 -> 100, 0.7 -> 0)
        const rawSourceWeight = this.SOURCE_WEIGHTS[sourceId] || this.SOURCE_WEIGHTS['default'];
        const sourceScore = ((rawSourceWeight - 0.7) / 0.6) * 100;

        const finalScore =
            (factors.sentimentMagnitude * weights.sentiment) +
            (factors.clusterSize * weights.cluster) +
            (sourceScore * weights.source) +
            (factors.recency * weights.recency);

        return Math.round(Math.min(100, Math.max(0, finalScore)));
    }

    /**
     * Helper to calculate recency decay score (0-100)
     * Lambda = 0.05 (provides ~30 points at 24h)
     */
    public static calculateRecency(publishedAt: string): number {
        const hoursOld = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
        const lambda = 0.05;
        return Math.round(Math.exp(-lambda * Math.max(0, hoursOld)) * 100);
    }

    /**
     * Helper to calculate cluster size score (0-100)
     * Capped at 20 articles
     */
    public static calculateClusterScore(size: number): number {
        return Math.min(100, (size / 20) * 100);
    }
}
