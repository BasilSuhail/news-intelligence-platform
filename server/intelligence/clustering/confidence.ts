/**
 * Cross-Source Confidence Scorer
 *
 * Scores clusters by how many independent sources report the same story.
 * More sources = higher confidence that the story is real and significant.
 *
 * Thresholds:
 * - 4+ unique sources → High confidence
 * - 2-3 unique sources → Medium confidence
 * - 1 source → Low confidence (flag with "Single Source" warning)
 */

import { ArticleCluster, ClusterConfidence } from '../core/types';

class ConfidenceScorer {

  /**
   * Score a single cluster's source confidence
   */
  public scoreCluster(cluster: ArticleCluster): ClusterConfidence {
    const sources = new Set<string>();

    for (const article of cluster.articles) {
      if (article.source) {
        sources.add(article.source.toLowerCase().trim());
      }
    }

    const uniqueSources = sources.size;
    const sourceList = Array.from(sources);

    let tier: ClusterConfidence['tier'];
    let confidenceScore: number;

    if (uniqueSources >= 4) {
      tier = 'high';
      confidenceScore = Math.min(100, 60 + uniqueSources * 10);
    } else if (uniqueSources >= 2) {
      tier = 'medium';
      confidenceScore = 30 + uniqueSources * 15;
    } else {
      tier = 'low';
      confidenceScore = 20;
    }

    return {
      uniqueSources,
      sourceList,
      confidenceScore,
      tier
    };
  }

  /**
   * Score all clusters in a batch
   */
  public scoreClusters(clusters: ArticleCluster[]): Map<string, ClusterConfidence> {
    console.log(`[Confidence] Scoring ${clusters.length} clusters...`);

    const results = new Map<string, ClusterConfidence>();

    for (const cluster of clusters) {
      const confidence = this.scoreCluster(cluster);
      results.set(cluster.id, confidence);
    }

    const highCount = Array.from(results.values()).filter(c => c.tier === 'high').length;
    const lowCount = Array.from(results.values()).filter(c => c.tier === 'low').length;
    console.log(`[Confidence] Results: ${highCount} high, ${clusters.length - highCount - lowCount} medium, ${lowCount} low`);

    return results;
  }
}

export const confidenceScorer = new ConfidenceScorer();
