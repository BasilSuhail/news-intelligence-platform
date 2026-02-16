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

/**
 * Market Intelligence Pipeline - Main Orchestrator
 * 
 * Coordinates the full flow from data ingestion to final synthesis.
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

        try {
            // 1. Ingestion
            const rawArticles = await collector.runCollection(options);

            // 2. Enrichment
            const enrichedArticles = await enrichmentPipeline.enrichBatch(rawArticles);

            // 3. Clustering
            const clusters = await clusteringPipeline.clusterBatch(enrichedArticles);

            // 4. GPR Index Calculation
            const gprData = gprCalculator.calculateDaily(enrichedArticles, date);
            storage.saveGPRPoint(gprData); // Persist GPR data
            const gprHistory = storage.getGPRHistory(14); // Load history for trend analysis
            const gprIndex = gprCalculator.getIndex(gprHistory.length > 0 ? gprHistory : [gprData]);

            // 4b. Entity Sentiment Tracking (Phase 2)
            try {
                entityTracker.trackEntities(enrichedArticles, date);
            } catch (err: any) {
                console.error('[Pipeline] Entity tracking failed (non-fatal):', err.message);
                errors.push(`Entity tracking: ${err.message}`);
            }

            // 4c. Anomaly Detection (Phase 3B)
            try {
                anomalyDetector.detectAnomalies(enrichedArticles, date);
            } catch (err: any) {
                console.error('[Pipeline] Anomaly detection failed (non-fatal):', err.message);
                errors.push(`Anomaly detection: ${err.message}`);
            }

            // 4d. Narrative Threading (Phase 5)
            try {
                narrativeEngine.buildThreads(clusters, date);
            } catch (err: any) {
                console.error('[Pipeline] Narrative threading failed (non-fatal):', err.message);
                errors.push(`Narrative threading: ${err.message}`);
            }

            // 5. Market Sentiment Calculation
            const marketSentiment = this.calculateMarketSentiment(enrichedArticles);

            // 6. Synthesis (Briefing Generation)
            const briefing = await briefingGenerator.generate(
                date,
                clusters,
                gprIndex,
                marketSentiment
            );

            const processingTimeMs = Date.now() - startTime;
            console.log(`=== Pipeline Complete in ${processingTimeMs}ms ===\n`);

            return {
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
