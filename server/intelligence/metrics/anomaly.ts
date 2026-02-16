/**
 * Volume Anomaly Detector
 *
 * Detects unusual spikes in article volume per category using
 * Z-score analysis against 7-day rolling mean.
 *
 * Z-score > 2.0 = anomaly alert (i.e., more than 2 standard deviations above mean)
 */

import { AnomalyAlert, ArticleCategory, EnrichedArticle } from '../core/types';
import { storage } from '../core/storage';

class AnomalyDetector {
  private cachedAnomalies: AnomalyAlert[] = [];

  /**
   * Track daily volume and detect anomalies for the current pipeline run
   */
  public detectAnomalies(articles: EnrichedArticle[], date: string): AnomalyAlert[] {
    console.log(`[Anomaly] Analyzing volume for ${date}...`);

    // Count articles per category
    const categoryCounts = new Map<string, number>();
    for (const article of articles) {
      const cat = article.category || 'unknown';
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }

    // Save daily volume to SQLite
    const entries = Array.from(categoryCounts.entries());
    for (let i = 0; i < entries.length; i++) {
      storage.saveDailyVolume(date, entries[i][0], entries[i][1]);
    }

    // Check each category for anomalies
    const anomalies: AnomalyAlert[] = [];

    const categories = Array.from(categoryCounts.entries());
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i][0];
      const currentCount = categories[i][1];
      const history = storage.getVolumeHistory(category, 7);

      // Need at least 3 days of history for meaningful detection
      if (history.length < 3) continue;

      // Calculate rolling mean and standard deviation
      const counts = history.map(h => h.count);
      const mean = counts.reduce((s: number, v: number) => s + v, 0) / counts.length;
      const variance = counts.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / counts.length;
      const stdDev = Math.sqrt(variance);

      // Avoid division by zero
      if (stdDev === 0) continue;

      const zScore = (currentCount - mean) / stdDev;

      if (zScore > 2.0) {
        const multiplier = Math.round((currentCount / mean) * 10) / 10;
        anomalies.push({
          category,
          currentVolume: currentCount,
          rollingAvg7d: Math.round(mean * 10) / 10,
          standardDev: Math.round(stdDev * 10) / 10,
          zScore: Math.round(zScore * 100) / 100,
          isAnomaly: true,
          message: `${multiplier}x normal coverage on ${this.formatCategory(category)}`,
          date
        });

        console.log(`[Anomaly] ALERT: ${category} has ${currentCount} articles (${multiplier}x normal, z=${zScore.toFixed(2)})`);
      }
    }

    this.cachedAnomalies = anomalies;
    console.log(`[Anomaly] Found ${anomalies.length} anomalies`);
    return anomalies;
  }

  /**
   * Get cached anomalies from the most recent pipeline run
   */
  public getAnomalies(): AnomalyAlert[] {
    return this.cachedAnomalies;
  }

  /**
   * Format category name for human-readable display
   */
  private formatCategory(category: string): string {
    const labels: Record<string, string> = {
      'ai_compute_infra': 'AI & Compute',
      'fintech_regtech': 'FinTech & RegTech',
      'rpa_enterprise_ai': 'RPA & Enterprise AI',
      'semiconductor': 'Semiconductors',
      'cybersecurity': 'Cybersecurity',
      'geopolitics': 'Geopolitics'
    };
    return labels[category] || category;
  }
}

export const anomalyDetector = new AnomalyDetector();
