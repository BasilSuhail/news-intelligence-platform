/**
 * Narrative Threading Engine
 *
 * Links clusters across dates by entity overlap + keyword similarity.
 * Tracks how stories evolve over time:
 *
 * Day 1: "US considering new chip export controls"
 * Day 3: "NVIDIA warns of revenue impact from export restrictions"
 * Day 5: "China retaliates with rare earth export limits"
 *
 * → Displayed as a connected narrative: "This story has been developing for 5 days"
 */

import { ArticleCluster, NarrativeThread } from '../core/types';
import { storage } from '../core/storage';

class NarrativeEngine {

  /**
   * After daily clustering, find narrative threads that connect
   * today's clusters to clusters from recent days
   */
  public buildThreads(todayClusters: ArticleCluster[], date: string, lookbackDays = 7): NarrativeThread[] {
    console.log(`[Narrative] Building threads for ${date}, looking back ${lookbackDays} days...`);

    // Get recent clusters from storage
    const recentClusters = this.getRecentClusters(date, lookbackDays);
    if (recentClusters.length === 0) {
      console.log('[Narrative] No historical clusters to thread against');
      return [];
    }

    // Load existing threads
    const existingThreads = storage.getNarrativeThreads(lookbackDays);

    const threads: NarrativeThread[] = [];

    for (const todayCluster of todayClusters) {
      const todayEntities = this.extractEntities(todayCluster);
      const todayKeywords = new Set(todayCluster.keywords.map(k => k.toLowerCase()));

      // Check against each historical cluster
      let bestMatch: { cluster: ArticleCluster; score: number; date: string } | null = null;

      for (const historical of recentClusters) {
        const historicalEntities = this.extractEntities(historical.cluster);
        const historicalKeywords = new Set(historical.cluster.keywords.map(k => k.toLowerCase()));

        // Score 1: Entity overlap
        const entityOverlap = this.setIntersectionSize(todayEntities, historicalEntities);

        // Score 2: Keyword overlap
        const keywordOverlap = this.setIntersectionSize(todayKeywords, historicalKeywords);

        // Score 3: Category match
        const categoryMatch = todayCluster.categories.some(c =>
          historical.cluster.categories.includes(c)
        ) ? 1 : 0;

        // Combined score: entity overlap weighted most heavily
        const score = (entityOverlap * 3) + (keywordOverlap * 2) + categoryMatch;

        // Need at least 2 entity matches OR 3 keyword matches to link
        if ((entityOverlap >= 2 || keywordOverlap >= 3) && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { cluster: historical.cluster, score, date: historical.date };
        }
      }

      if (bestMatch) {
        // Check if this matches an existing thread
        const existingThread = existingThreads.find(t =>
          t.clusterIds.includes(bestMatch!.cluster.id)
        );

        if (existingThread) {
          // Extend existing thread
          existingThread.clusterIds.push(todayCluster.id);
          existingThread.lastSeen = date;
          existingThread.durationDays = this.daysBetween(existingThread.firstSeen, date);
          existingThread.sentimentArc.push(todayCluster.aggregateSentiment);
          existingThread.escalation = this.detectEscalation(existingThread.sentimentArc);

          // Merge entities
          const newEntities = this.extractEntities(todayCluster);
          for (const entity of Array.from(newEntities)) {
            if (!existingThread.entities.includes(entity)) {
              existingThread.entities.push(entity);
            }
          }

          threads.push(existingThread);
        } else {
          // Create new thread
          const allEntities = new Set<string>();
          const fromEntities = this.extractEntities(bestMatch.cluster);
          const toEntities = this.extractEntities(todayCluster);
          for (const e of Array.from(fromEntities)) allEntities.add(e);
          for (const e of Array.from(toEntities)) allEntities.add(e);

          const sentimentArc = [
            bestMatch.cluster.aggregateSentiment,
            todayCluster.aggregateSentiment
          ];

          const thread: NarrativeThread = {
            id: `thread_${Date.now()}_${threads.length}`,
            title: this.generateThreadTitle(todayCluster, bestMatch.cluster),
            firstSeen: bestMatch.date,
            lastSeen: date,
            durationDays: this.daysBetween(bestMatch.date, date),
            clusterIds: [bestMatch.cluster.id, todayCluster.id],
            sentimentArc,
            entities: Array.from(allEntities),
            escalation: this.detectEscalation(sentimentArc)
          };

          threads.push(thread);
        }
      }
    }

    // Save threads to storage
    if (threads.length > 0) {
      storage.saveNarrativeThreads(threads);
      console.log(`[Narrative] Found ${threads.length} narrative threads`);
    } else {
      console.log('[Narrative] No narrative threads detected');
    }

    return threads;
  }

  /**
   * Get cached narrative threads
   */
  public getThreads(days = 14): NarrativeThread[] {
    return storage.getNarrativeThreads(days);
  }

  /**
   * Extract entity names from a cluster's articles
   */
  private extractEntities(cluster: ArticleCluster): Set<string> {
    const entities = new Set<string>();
    for (const article of cluster.articles) {
      if (!article.entities) continue;
      for (const person of article.entities.people) entities.add(person.toLowerCase());
      for (const org of article.entities.organizations) entities.add(org.toLowerCase());
      for (const place of article.entities.places) entities.add(place.toLowerCase());
    }
    return entities;
  }

  /**
   * Count intersection of two sets
   */
  private setIntersectionSize(a: Set<string>, b: Set<string>): number {
    let count = 0;
    for (const item of Array.from(a)) {
      if (b.has(item)) count++;
    }
    return count;
  }

  /**
   * Calculate days between two date strings
   */
  private daysBetween(dateA: string, dateB: string): number {
    const a = new Date(dateA);
    const b = new Date(dateB);
    return Math.ceil(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Detect escalation pattern from sentiment arc
   */
  private detectEscalation(sentimentArc: number[]): NarrativeThread['escalation'] {
    if (sentimentArc.length < 2) return 'stable';

    const first = sentimentArc[0];
    const last = sentimentArc[sentimentArc.length - 1];
    const diff = last - first;

    // Sentiment getting more negative = rising tension
    if (diff < -10) return 'rising';
    // Sentiment getting more positive = declining tension
    if (diff > 10) return 'declining';
    return 'stable';
  }

  /**
   * Generate a human-readable thread title from linked clusters
   */
  private generateThreadTitle(clusterA: ArticleCluster, clusterB: ArticleCluster): string {
    // Find shared keywords
    const keywordsA = new Set(clusterA.keywords.map(k => k.toLowerCase()));
    const shared: string[] = [];
    for (const keyword of clusterB.keywords) {
      if (keywordsA.has(keyword.toLowerCase())) {
        shared.push(keyword);
      }
    }

    if (shared.length > 0) {
      const topShared = shared.slice(0, 3).map(k =>
        k.charAt(0).toUpperCase() + k.slice(1)
      ).join(', ');
      return `Developing: ${topShared}`;
    }

    // Fallback to most recent cluster topic
    return `Ongoing: ${clusterA.topic}`;
  }

  /**
   * Get recent clusters from storage, grouped by date
   */
  private getRecentClusters(currentDate: string, days: number): Array<{ cluster: ArticleCluster; date: string }> {
    const results: Array<{ cluster: ArticleCluster; date: string }> = [];

    for (let i = 1; i <= days; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const clusters = storage.getClustersByDate(dateStr);
      if (clusters && Array.isArray(clusters)) {
        for (const cluster of clusters) {
          results.push({ cluster, date: dateStr });
        }
      }
    }

    return results;
  }
}

export const narrativeEngine = new NarrativeEngine();
