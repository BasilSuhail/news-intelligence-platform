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
 *
 * Matching criteria (all must be met):
 * - Entity overlap >= 2 AND keyword overlap >= 2
 * - At least 1 shared category
 * - Sentiment difference < 0.8 (same story, not unrelated coverage)
 * - Thread quality score >= 10
 */

import { ArticleCluster, NarrativeThread } from '../core/types';
import { storage } from '../core/storage';

class NarrativeEngine {
  private static readonly MAX_THREAD_AGE_DAYS = 14;
  private static readonly INACTIVE_RESOLVE_DAYS = 5;
  private static readonly MIN_THREAD_SCORE = 10;
  private static readonly MAX_SENTIMENT_DIFF = 0.8;

  constructor() {
    this.ensureStatusColumn();
  }

  /**
   * Add status column to narrative_threads if it doesn't exist
   */
  private ensureStatusColumn(): void {
    try {
      const db = storage.getDb();
      const columns = db.prepare("PRAGMA table_info(narrative_threads)").all() as any[];
      const hasStatus = columns.some((c: any) => c.name === 'status');
      if (!hasStatus) {
        db.exec("ALTER TABLE narrative_threads ADD COLUMN status TEXT DEFAULT 'active'");
        console.log('[Narrative] Added status column to narrative_threads');
      }
    } catch (err: any) {
      // Table might not exist yet
      console.log('[Narrative] Status column check:', err.message);
    }
  }

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

    // Load existing threads (active only)
    const existingThreads = this.getThreads(lookbackDays, 'active');

    // Mark stale threads as resolved
    this.resolveStaleThreads(existingThreads, date);

    const threads: NarrativeThread[] = [];

    for (const todayCluster of todayClusters) {
      const todayEntities = this.extractEntities(todayCluster);
      const todayKeywords = new Set(todayCluster.keywords.map(k => k.toLowerCase()));
      const todayCategories = new Set(todayCluster.categories);

      // Check against each historical cluster
      let bestMatch: { cluster: ArticleCluster; score: number; date: string } | null = null;

      for (const historical of recentClusters) {
        const historicalEntities = this.extractEntities(historical.cluster);
        const historicalKeywords = new Set(historical.cluster.keywords.map(k => k.toLowerCase()));

        // Score 1: Entity overlap
        const entityOverlap = this.setIntersectionSize(todayEntities, historicalEntities);

        // Score 2: Keyword overlap
        const keywordOverlap = this.setIntersectionSize(todayKeywords, historicalKeywords);

        // Score 3: Category match (REQUIRED - at least 1 shared category)
        const categoryMatch = todayCluster.categories.some(c =>
          historical.cluster.categories.includes(c)
        ) ? 1 : 0;

        if (categoryMatch === 0) continue; // Skip if no shared category

        // Score 4: Sentiment consistency check
        const sentimentDiff = Math.abs(todayCluster.aggregateSentiment - historical.cluster.aggregateSentiment);
        if (sentimentDiff > NarrativeEngine.MAX_SENTIMENT_DIFF * 100) continue; // Skip if sentiment too different (scores are -100 to 100)

        // Combined thread quality score
        const score = (entityOverlap * 3) + (keywordOverlap * 2) + (categoryMatch * 2);

        // REQUIRE BOTH entity overlap AND keyword overlap (changed OR to AND)
        // AND minimum thread score
        if (entityOverlap >= 2 && keywordOverlap >= 2 && score >= NarrativeEngine.MIN_THREAD_SCORE) {
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { cluster: historical.cluster, score, date: historical.date };
          }
        }
      }

      if (bestMatch) {
        // Check if this matches an existing thread
        const existingThread = existingThreads.find(t =>
          t.clusterIds.includes(bestMatch!.cluster.id)
        );

        if (existingThread) {
          // Check max thread age
          const threadAge = this.daysBetween(existingThread.firstSeen, date);
          if (threadAge > NarrativeEngine.MAX_THREAD_AGE_DAYS) continue;

          // Extend existing thread
          existingThread.clusterIds.push(todayCluster.id);
          existingThread.lastSeen = date;
          existingThread.durationDays = this.daysBetween(existingThread.firstSeen, date);
          existingThread.sentimentArc.push(todayCluster.aggregateSentiment);
          existingThread.escalation = this.detectEscalation(existingThread.sentimentArc);

          // Update title to most recent cluster's topic
          existingThread.title = `${todayCluster.topic} (${existingThread.durationDays} days developing)`;

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

          const durationDays = this.daysBetween(bestMatch.date, date);
          const thread: NarrativeThread = {
            id: `thread_${Date.now()}_${threads.length}`,
            title: `${todayCluster.topic} (${durationDays} days developing)`,
            firstSeen: bestMatch.date,
            lastSeen: date,
            durationDays,
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
  public getThreads(days = 14, status?: 'active' | 'resolved'): NarrativeThread[] {
    const allThreads = storage.getNarrativeThreads(days);

    if (!status) return allThreads;

    // Filter by status - check the status column
    try {
      const db = storage.getDb();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const rows = db.prepare(
        `SELECT * FROM narrative_threads WHERE last_seen >= ? AND (status = ? OR status IS NULL) ORDER BY last_seen DESC, duration_days DESC`
      ).all(cutoffStr, status === 'active' ? 'active' : 'resolved') as any[];

      return rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        durationDays: row.duration_days,
        clusterIds: JSON.parse(row.cluster_ids || '[]'),
        sentimentArc: JSON.parse(row.sentiment_arc || '[]'),
        entities: JSON.parse(row.entities || '[]'),
        escalation: row.escalation
      }));
    } catch {
      // Fallback to unfiltered if status column doesn't exist
      return allThreads;
    }
  }

  /**
   * Mark threads that haven't been updated in INACTIVE_RESOLVE_DAYS as resolved
   */
  private resolveStaleThreads(threads: NarrativeThread[], currentDate: string): void {
    try {
      const db = storage.getDb();
      for (const thread of threads) {
        const daysSinceUpdate = this.daysBetween(thread.lastSeen, currentDate);
        if (daysSinceUpdate >= NarrativeEngine.INACTIVE_RESOLVE_DAYS) {
          db.prepare("UPDATE narrative_threads SET status = 'resolved' WHERE id = ?").run(thread.id);
          console.log(`[Narrative] Resolved stale thread: ${thread.title}`);
        }
      }
    } catch (err: any) {
      console.log('[Narrative] Could not resolve stale threads:', err.message);
    }
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

