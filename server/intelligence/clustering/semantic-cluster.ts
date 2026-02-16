/**
 * Semantic Clustering Engine
 *
 * Uses sentence embeddings (all-MiniLM-L6-v2) to cluster articles by meaning.
 * Falls back to TF-IDF + K-Means if embeddings are unavailable.
 *
 * Key advantage over TF-IDF:
 * - "Oil prices rise" and "Energy sector booming" → SAME cluster
 * - "Apple stock drops" and "iPhone sales decline" → SAME cluster
 * - Handles synonyms, paraphrases, and conceptual similarity
 */

import { EnrichedArticle, ArticleCluster } from '../core/types';
import { embeddingEngine } from './embeddings';
import { clusteringEngine } from './tfidf';

let nlpModule: any = null;

async function loadNLP() {
  if (!nlpModule) {
    nlpModule = await import('compromise');
  }
}

class SemanticClusterEngine {

  /**
   * Cluster articles using semantic embeddings
   * Falls back to TF-IDF if embeddings unavailable
   */
  public async cluster(articles: EnrichedArticle[]): Promise<ArticleCluster[]> {
    if (articles.length < 3) {
      console.log(`[SemanticCluster] Too few articles (${articles.length}) to cluster.`);
      return [];
    }

    // Try semantic clustering first
    if (embeddingEngine.isAvailable()) {
      try {
        return await this.semanticCluster(articles);
      } catch (error) {
        console.error('[SemanticCluster] Semantic clustering failed, falling back to TF-IDF:', error);
      }
    } else {
      console.log('[SemanticCluster] Embedding model not available, using TF-IDF fallback');
    }

    // Fallback to existing TF-IDF + K-Means
    return clusteringEngine.cluster(articles);
  }

  /**
   * Core semantic clustering using embeddings + cosine similarity
   */
  private async semanticCluster(articles: EnrichedArticle[]): Promise<ArticleCluster[]> {
    console.log(`[SemanticCluster] Running semantic clustering on ${articles.length} articles...`);

    // 1. Generate embeddings from article headlines + descriptions
    const texts = articles.map(a => `${a.title} ${a.description || ''}`);
    const embeddings = await embeddingEngine.embed(texts);

    if (!embeddings || embeddings.length !== articles.length) {
      console.error('[SemanticCluster] Embedding count mismatch, falling back to TF-IDF');
      return clusteringEngine.cluster(articles);
    }

    // 2. Cluster by cosine similarity (threshold-based)
    // Lower threshold = more articles per cluster, higher = tighter clusters
    const threshold = articles.length > 50 ? 0.50 : 0.55;
    const clusterIndices = embeddingEngine.clusterBySimilarity(embeddings, threshold);

    console.log(`[SemanticCluster] Found ${clusterIndices.length} raw clusters`);

    // 3. Filter out singleton clusters (noise)
    const meaningfulClusters = clusterIndices.filter(c => c.length >= 2);

    // Also collect singletons into an "Other" cluster if there are enough
    const singletons = clusterIndices.filter(c => c.length === 1).map(c => c[0]);
    if (singletons.length >= 3) {
      meaningfulClusters.push(singletons);
    }

    console.log(`[SemanticCluster] ${meaningfulClusters.length} meaningful clusters (after filtering singletons)`);

    // 4. Build ArticleCluster objects
    await loadNLP();
    const clusters: ArticleCluster[] = [];

    for (let idx = 0; idx < meaningfulClusters.length; idx++) {
      const articleIndices = meaningfulClusters[idx];
      const clusterArticles = articleIndices.map(i => articles[i]);

      if (clusterArticles.length === 0) continue;

      const cluster = this.buildCluster(clusterArticles, idx.toString());
      clusters.push(cluster);
    }

    // Sort by aggregate impact (most important first)
    clusters.sort((a, b) => b.aggregateImpact - a.aggregateImpact);

    console.log(`[SemanticCluster] Final: ${clusters.length} clusters, method=semantic-embeddings`);
    return clusters;
  }

  /**
   * Build an ArticleCluster from a group of articles
   * Matches the exact same structure as TF-IDF clustering output
   */
  private buildCluster(articles: EnrichedArticle[], id: string): ArticleCluster {
    const combinedText = articles.map(a => `${a.title} ${a.description || ''}`).join(' ');
    const keywords = this.extractKeywords(combinedText);
    const topic = this.generateTopicName(articles[0].title, keywords);

    const earliest = articles.reduce((min, a) => a.publishedAt < min ? a.publishedAt : min, articles[0].publishedAt);
    const latest = articles.reduce((max, a) => a.publishedAt > max ? a.publishedAt : max, articles[0].publishedAt);

    return {
      id: `cluster_${Date.now()}_${id}`,
      topic,
      keywords,
      articles,
      aggregateSentiment: articles.reduce((sum, a) => sum + a.sentiment.normalizedScore, 0) / articles.length,
      aggregateImpact: articles.reduce((sum, a) => sum + a.impactScore, 0) / articles.length,
      articleCount: articles.length,
      categories: Array.from(new Set(articles.map(a => a.category))),
      dateRange: { earliest, latest }
    };
  }

  /**
   * Extract keywords using Compromise NLP
   */
  private extractKeywords(text: string): string[] {
    if (!nlpModule) {
      return text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 10);
    }
    const nlp = nlpModule.default || nlpModule;
    const doc = nlp(text);
    const keywords = doc.topics().out('array')
      .concat(doc.nouns().out('array'))
      .filter((w: string) => w.length > 3)
      .slice(0, 10);

    return Array.from(new Set(keywords)) as string[];
  }

  /**
   * Generate a topic name from keywords
   */
  private generateTopicName(primaryHeadline: string, keywords: string[]): string {
    if (keywords.length > 0) {
      const topWords = keywords.slice(0, 3).map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(' & ');
      return `Trends in ${topWords}`;
    }
    return primaryHeadline.length > 50 ? primaryHeadline.slice(0, 47) + '...' : primaryHeadline;
  }
}

export const semanticClusterEngine = new SemanticClusterEngine();
