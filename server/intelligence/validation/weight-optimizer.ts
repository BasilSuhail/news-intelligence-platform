/**
 * Weight Optimizer - Grid Search for Impact Score Weights
 *
 * Tests different weight combinations and finds which one best correlates
 * with next-day SPY returns using Pearson correlation.
 *
 * Grid search space (~100 valid combinations):
 * - sentiment_weight: [0.2, 0.3, 0.4, 0.5]
 * - cluster_weight:   [0.15, 0.2, 0.3, 0.4]
 * - source_weight:    [0.1, 0.15, 0.2, 0.25]
 * - recency_weight:   [0.05, 0.1, 0.15, 0.2]
 * - Constraint: all weights must sum to 1.0
 */

import { storage } from '../core/storage';
import { correlationEngine } from './correlation';

export interface OptimizedWeights {
    sentimentWeight: number;
    clusterWeight: number;
    sourceWeight: number;
    recencyWeight: number;
    pearsonCorrelation: number;
    spearmanCorrelation: number;
    sampleSize: number;
    periodStart: string;
    periodEnd: string;
    calculatedAt: string;
}

interface WeightCombo {
    sentiment: number;
    cluster: number;
    source: number;
    recency: number;
}

class WeightOptimizer {
    private static readonly SENTIMENT_OPTIONS = [0.2, 0.3, 0.4, 0.5];
    private static readonly CLUSTER_OPTIONS = [0.15, 0.2, 0.3, 0.4];
    private static readonly SOURCE_OPTIONS = [0.1, 0.15, 0.2, 0.25];
    private static readonly RECENCY_OPTIONS = [0.05, 0.1, 0.15, 0.2];

    constructor() {
        this.ensureTable();
    }

    /**
     * Create the optimized_weights table if it doesn't exist
     */
    private ensureTable(): void {
        try {
            storage.getDb().exec(`
        CREATE TABLE IF NOT EXISTS optimized_weights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sentiment_weight REAL NOT NULL,
          cluster_weight REAL NOT NULL,
          source_weight REAL NOT NULL,
          recency_weight REAL NOT NULL,
          pearson_correlation REAL NOT NULL,
          spearman_correlation REAL NOT NULL,
          sample_size INTEGER NOT NULL,
          period_start TEXT NOT NULL,
          period_end TEXT NOT NULL,
          calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
        } catch (err: any) {
            console.error('[WeightOptimizer] Table creation error:', err.message);
        }
    }

    /**
     * Run grid search to find optimal impact score weights
     */
    public async optimize(days = 30): Promise<{
        best: OptimizedWeights;
        top5: OptimizedWeights[];
        defaultCorrelation: number;
        improvement: string;
    }> {
        console.log(`[WeightOptimizer] Starting grid search over ${days} days...`);

        // 1. Get enriched articles for the period
        const enrichedArticles = this.getEnrichedArticlesForPeriod(days);
        if (enrichedArticles.length < 14) {
            console.log(`[WeightOptimizer] Insufficient data: ${enrichedArticles.length} days (need 14+)`);
            const defaults = this.getDefaultWeights();
            return {
                best: defaults,
                top5: [defaults],
                defaultCorrelation: 0,
                improvement: 'Insufficient data for optimization (need 14+ days)'
            };
        }

        // 2. Get market data for same period
        const marketData = storage.getMarketData(days + 7);
        const marketByDate = new Map<string, number>();
        for (const point of marketData) {
            marketByDate.set(point.date, point.changePct);
        }

        if (marketByDate.size < 5) {
            console.log('[WeightOptimizer] Insufficient market data');
            const defaults = this.getDefaultWeights();
            return {
                best: defaults,
                top5: [defaults],
                defaultCorrelation: 0,
                improvement: 'Insufficient market data for optimization'
            };
        }

        // 3. Generate all valid weight combinations
        const validCombos = this.generateValidCombinations();
        console.log(`[WeightOptimizer] Testing ${validCombos.length} weight combinations...`);

        // 4. For each valid combination, compute correlation
        const results: Array<{ combo: WeightCombo; pearson: number; spearman: number; sampleSize: number }> = [];

        for (const combo of validCombos) {
            const { pearson, spearman, sampleSize } = this.evaluateCombo(combo, enrichedArticles, marketByDate);
            if (sampleSize >= 3) {
                results.push({ combo, pearson, spearman, sampleSize });
            }
        }

        if (results.length === 0) {
            console.log('[WeightOptimizer] No valid results from grid search');
            const defaults = this.getDefaultWeights();
            return {
                best: defaults,
                top5: [defaults],
                defaultCorrelation: 0,
                improvement: 'Grid search produced no valid results'
            };
        }

        // 5. Sort by |Pearson correlation|
        results.sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson));

        // 6. Get default correlation for comparison
        const defaultResult = results.find(r =>
            r.combo.sentiment === 0.4 && r.combo.cluster === 0.3 &&
            r.combo.source === 0.2 && r.combo.recency === 0.1
        );
        const defaultCorrelation = defaultResult?.pearson || 0;

        // 7. Build top 5 results
        const dates = enrichedArticles.map(a => a.date).sort();
        const periodStart = dates[0];
        const periodEnd = dates[dates.length - 1];
        const now = new Date().toISOString();

        const top5: OptimizedWeights[] = results.slice(0, 5).map(r => ({
            sentimentWeight: r.combo.sentiment,
            clusterWeight: r.combo.cluster,
            sourceWeight: r.combo.source,
            recencyWeight: r.combo.recency,
            pearsonCorrelation: r.pearson,
            spearmanCorrelation: r.spearman,
            sampleSize: r.sampleSize,
            periodStart,
            periodEnd,
            calculatedAt: now
        }));

        const best = top5[0];

        // 8. Save best weights to SQLite
        this.saveWeights(best);

        // 9. Calculate improvement
        const improvementPct = defaultCorrelation !== 0
            ? Math.round(((Math.abs(best.pearsonCorrelation) - Math.abs(defaultCorrelation)) / Math.abs(defaultCorrelation)) * 100)
            : 0;
        const improvement = `Default: r=${defaultCorrelation.toFixed(4)} → Optimized: r=${best.pearsonCorrelation.toFixed(4)} (${improvementPct > 0 ? '+' : ''}${improvementPct}%)`;

        console.log(`[WeightOptimizer] ${improvement}`);
        console.log(`[WeightOptimizer] Best weights: sentiment=${best.sentimentWeight}, cluster=${best.clusterWeight}, source=${best.sourceWeight}, recency=${best.recencyWeight}`);

        return { best, top5, defaultCorrelation, improvement };
    }

    /**
     * Get the most recent optimized weights
     */
    public getCurrentWeights(): { weights: OptimizedWeights | null; isOptimized: boolean } {
        try {
            const row = storage.getDb().prepare(
                'SELECT * FROM optimized_weights ORDER BY calculated_at DESC LIMIT 1'
            ).get() as any;

            if (!row) {
                return { weights: null, isOptimized: false };
            }

            // Check if less than 7 days old
            const calculatedAt = new Date(row.calculated_at);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            if (calculatedAt < sevenDaysAgo) {
                return { weights: null, isOptimized: false };
            }

            return {
                weights: {
                    sentimentWeight: row.sentiment_weight,
                    clusterWeight: row.cluster_weight,
                    sourceWeight: row.source_weight,
                    recencyWeight: row.recency_weight,
                    pearsonCorrelation: row.pearson_correlation,
                    spearmanCorrelation: row.spearman_correlation,
                    sampleSize: row.sample_size,
                    periodStart: row.period_start,
                    periodEnd: row.period_end,
                    calculatedAt: row.calculated_at
                },
                isOptimized: true
            };
        } catch (err: any) {
            console.error('[WeightOptimizer] Failed to get current weights:', err.message);
            return { weights: null, isOptimized: false };
        }
    }

    /**
     * Generate all valid weight combinations (sum to 1.0)
     */
    private generateValidCombinations(): WeightCombo[] {
        const combos: WeightCombo[] = [];

        for (const s of WeightOptimizer.SENTIMENT_OPTIONS) {
            for (const c of WeightOptimizer.CLUSTER_OPTIONS) {
                for (const src of WeightOptimizer.SOURCE_OPTIONS) {
                    for (const r of WeightOptimizer.RECENCY_OPTIONS) {
                        const sum = Math.round((s + c + src + r) * 100) / 100;
                        if (sum === 1.0) {
                            combos.push({ sentiment: s, cluster: c, source: src, recency: r });
                        }
                    }
                }
            }
        }

        return combos;
    }

    /**
     * Evaluate a single weight combination against market data
     */
    private evaluateCombo(
        combo: WeightCombo,
        articlesByDate: Array<{ date: string; articles: Array<{ sentimentMagnitude: number; clusterSize: number; sourceScore: number; recency: number }> }>,
        marketByDate: Map<string, number>
    ): { pearson: number; spearman: number; sampleSize: number } {
        // Calculate daily aggregate impact-weighted sentiment for this combo
        const sentimentByDate = new Map<string, number>();

        for (const day of articlesByDate) {
            let totalWeightedSentiment = 0;
            let totalWeight = 0;

            for (const article of day.articles) {
                const impactScore =
                    (article.sentimentMagnitude * combo.sentiment) +
                    (article.clusterSize * combo.cluster) +
                    (article.sourceScore * combo.source) +
                    (article.recency * combo.recency);

                totalWeightedSentiment += impactScore;
                totalWeight += 1;
            }

            if (totalWeight > 0) {
                sentimentByDate.set(day.date, totalWeightedSentiment / totalWeight);
            }
        }

        // Align with next-day market returns
        const dataPoints = correlationEngine.alignSentimentToMarket(sentimentByDate, marketByDate);

        if (dataPoints.length < 3) {
            return { pearson: 0, spearman: 0, sampleSize: 0 };
        }

        const sentimentScores = dataPoints.map(dp => dp.sentimentScore);
        const marketReturns = dataPoints.map(dp => dp.marketReturn);

        return {
            pearson: correlationEngine.pearson(sentimentScores, marketReturns),
            spearman: correlationEngine.spearman(sentimentScores, marketReturns),
            sampleSize: dataPoints.length
        };
    }

    /**
     * Get enriched articles grouped by date for the weight optimizer
     */
    private getEnrichedArticlesForPeriod(days: number): Array<{ date: string; articles: Array<{ sentimentMagnitude: number; clusterSize: number; sourceScore: number; recency: number }> }> {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            const cutoffStr = cutoff.toISOString().split('T')[0];

            const rows = storage.getDb().prepare(`
        SELECT
          e.sentiment_score,
          e.impact_score,
          r.published_at,
          r.source_id,
          SUBSTR(r.published_at, 1, 10) as date
        FROM enriched_articles e
        JOIN raw_articles r ON e.raw_article_id = r.id
        WHERE r.published_at >= ?
        ORDER BY r.published_at ASC
      `).all(cutoffStr) as any[];

            // Group by date
            const byDate = new Map<string, Array<{ sentimentMagnitude: number; clusterSize: number; sourceScore: number; recency: number }>>();

            for (const row of rows) {
                const date = row.date;
                if (!byDate.has(date)) {
                    byDate.set(date, []);
                }

                // Use absolute sentiment as magnitude (0-100 scale)
                const sentimentMagnitude = Math.abs(row.sentiment_score) * 100;

                // Use impact score as a proxy for cluster contribution
                const clusterSize = Math.min(100, (row.impact_score || 0));

                // Source score (simplified - using a default)
                const sourceScore = 50; // Middle of range as we don't have per-article source weight stored

                // Recency is always relative to "today" for each date
                const recency = 80; // Recent articles within the period

                byDate.get(date)!.push({ sentimentMagnitude, clusterSize, sourceScore, recency });
            }

            return Array.from(byDate.entries()).map(([date, articles]) => ({ date, articles }));
        } catch (err: any) {
            console.error('[WeightOptimizer] Failed to get enriched articles:', err.message);
            return [];
        }
    }

    /**
     * Save optimized weights to SQLite
     */
    private saveWeights(weights: OptimizedWeights): void {
        try {
            storage.getDb().prepare(`
        INSERT INTO optimized_weights (
          sentiment_weight, cluster_weight, source_weight, recency_weight,
          pearson_correlation, spearman_correlation, sample_size,
          period_start, period_end
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                weights.sentimentWeight,
                weights.clusterWeight,
                weights.sourceWeight,
                weights.recencyWeight,
                weights.pearsonCorrelation,
                weights.spearmanCorrelation,
                weights.sampleSize,
                weights.periodStart,
                weights.periodEnd
            );
            console.log('[WeightOptimizer] Saved optimized weights to database');
        } catch (err: any) {
            console.error('[WeightOptimizer] Failed to save weights:', err.message);
        }
    }

    /**
     * Return default weights as OptimizedWeights
     */
    private getDefaultWeights(): OptimizedWeights {
        return {
            sentimentWeight: 0.4,
            clusterWeight: 0.3,
            sourceWeight: 0.2,
            recencyWeight: 0.1,
            pearsonCorrelation: 0,
            spearmanCorrelation: 0,
            sampleSize: 0,
            periodStart: '',
            periodEnd: '',
            calculatedAt: new Date().toISOString()
        };
    }
}

export const weightOptimizer = new WeightOptimizer();
