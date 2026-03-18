import {
    DailyAnalysis,
    FetchOptions,
    MarketSentiment,
    GPRDataPoint,
    DataProvider
} from './types';
import { collector } from '../ingestion/collector';
import { enrichmentPipeline } from '../enrichment/pipeline';
import { clusteringPipeline } from '../clustering/pipeline';
import { briefingGenerator } from '../synthesis/briefing';
import { gprCalculator } from '../metrics/gpr';
import { entityTracker } from '../metrics/entity-tracker';
import { anomalyDetector } from '../metrics/anomaly';
import { narrativeEngine } from '../clustering/narrative';
import { storage } from './storage';
import { healthMonitor } from './health';
import { backupToSupabase } from './supabase-backup';

/**
 * Market Intelligence Pipeline - Main Orchestrator
 * 
 * Coordinates the full flow from data ingestion to final synthesis.
 * Now includes pipeline health monitoring for observability.
 */
export class IntelligencePipeline {
    /**
     * Run the full pipeline for a specific date
     */
    public async run(options: FetchOptions = {}): Promise<DailyAnalysis> {
        const startTime = Date.now();
        const date = options.dateTo || new Date().toISOString().split('T')[0];
        const errors: string[] = [];

        console.log(`\n=== Starting Intelligence Pipeline for ${date} ===`);
        healthMonitor.setDate(date);

        try {
            // 1. Ingestion
            healthMonitor.startStep('ingestion');
            const rawArticles = await collector.runCollection(options);
            healthMonitor.endStep('ingestion', 'success', { articles: rawArticles.length });

            // 2. Enrichment
            healthMonitor.startStep('enrichment');
            const enrichedArticles = await enrichmentPipeline.enrichBatch(rawArticles);
            healthMonitor.endStep('enrichment', 'success', { articles: enrichedArticles.length });

            // 3. Clustering
            healthMonitor.startStep('clustering');
            const clusters = await clusteringPipeline.clusterBatch(enrichedArticles);
            healthMonitor.endStep('clustering', 'success', { clusters: clusters.length });

            // 4. GPR Index Calculation
            healthMonitor.startStep('gpr');
            const gprData = gprCalculator.calculateDaily(enrichedArticles, date);
            storage.saveGPRPoint(gprData); // Persist GPR data
            const gprHistory = storage.getGPRHistory(14); // Load history for trend analysis
            const gprIndex = gprCalculator.getIndex(gprHistory.length > 0 ? gprHistory : [gprData]);
            healthMonitor.endStep('gpr', 'success', { score: gprData.score });

            // 4b. Entity Sentiment Tracking (Phase 2)
            healthMonitor.startStep('entity_tracking');
            try {
                entityTracker.trackEntities(enrichedArticles, date);
                healthMonitor.endStep('entity_tracking', 'success', { entities: enrichedArticles.length });
            } catch (err: any) {
                console.error('[Pipeline] Entity tracking failed (non-fatal):', err.message);
                errors.push(`Entity tracking: ${err.message}`);
                healthMonitor.endStep('entity_tracking', 'failure', { error: err.message });
            }

            // 4c. Anomaly Detection (Phase 3B)
            healthMonitor.startStep('anomaly');
            try {
                anomalyDetector.detectAnomalies(enrichedArticles, date);
                healthMonitor.endStep('anomaly', 'success', { articles: enrichedArticles.length });
            } catch (err: any) {
                console.error('[Pipeline] Anomaly detection failed (non-fatal):', err.message);
                errors.push(`Anomaly detection: ${err.message}`);
                healthMonitor.endStep('anomaly', 'failure', { error: err.message });
            }

            // 4d. Narrative Threading (Phase 5)
            healthMonitor.startStep('narrative');
            try {
                narrativeEngine.buildThreads(clusters, date);
                healthMonitor.endStep('narrative', 'success', { clusters: clusters.length });
            } catch (err: any) {
                console.error('[Pipeline] Narrative threading failed (non-fatal):', err.message);
                errors.push(`Narrative threading: ${err.message}`);
                healthMonitor.endStep('narrative', 'failure', { error: err.message });
            }

            // 5. Market Sentiment Calculation
            const marketSentiment = this.calculateMarketSentiment(enrichedArticles);

            // 6. Synthesis (Briefing Generation)
            healthMonitor.startStep('synthesis');
            const briefing = await briefingGenerator.generate(
                date,
                clusters,
                gprIndex,
                marketSentiment
            );
            healthMonitor.endStep('synthesis', 'success', { source: briefing.source });

            const processingTimeMs = Date.now() - startTime;
            console.log(`=== Pipeline Complete in ${processingTimeMs}ms ===\n`);

            const result: DailyAnalysis = {
                date,
                briefing,
                clusters: {
                    clusters,
                    outliers: [],
                    method: 'tfidf-kmeans',
                    timestamp: new Date().toISOString()
                },
                enrichedArticles,
                gprIndex,
                opportunities: [], // TODO: Implementation
                risks: [],         // TODO: Implementation
                metadata: {
                    articlesProcessed: rawArticles.length,
                    clustersFound: clusters.length,
                    apiCallsMade: briefing.source === 'gemini' ? 1 : 0,
                    processingTimeMs,
                    cacheHit: briefing.source !== 'gemini',
                    errors
                }
            };

            // Non-blocking Supabase backup (failures logged, never propagated)
            backupToSupabase(result).catch(err =>
                console.error('[Pipeline] Supabase backup failed (non-fatal):', err.message)
            );

            return result;
        } catch (error: any) {
            console.error(`[Pipeline] Fatal error:`, error);
            throw error;
        }
    }

    private calculateMarketSentiment(articles: any[]): MarketSentiment {
        if (articles.length === 0) {
            return { overall: 0, byCategory: {}, trend: 'neutral', confidence: 0 };
        }

        const overall = articles.reduce((sum, a) => sum + a.sentiment.normalizedScore, 0) / articles.length;

        return {
            overall,
            byCategory: {}, // Could be expanded
            trend: overall > 10 ? 'bullish' : overall < -10 ? 'bearish' : 'neutral',
            confidence: 0.8
        };
    }
}

export const pipeline = new IntelligencePipeline();

