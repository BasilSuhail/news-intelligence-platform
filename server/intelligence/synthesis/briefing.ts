import {
    ArticleCluster,
    DailyBriefing,
    GPRIndex,
    MarketSentiment
} from '../core/types';
import { geminiSynthesis } from './gemini';
import { briefingCache } from '../core/cache';
import { storage } from '../core/storage';

/**
 * Briefing Generator - Orchestrates the Synthesis Layer
 * Coordinates caching, AI generation, and local fallback.
 */
export class BriefingGenerator {
    /**
     * Generate today's briefing
     */
    public async generate(
        date: string,
        clusters: ArticleCluster[],
        gprIndex: GPRIndex,
        marketSentiment: MarketSentiment
    ): Promise<DailyBriefing> {

        // 1. Check Cache for Idempotence
        const { shouldCallApi, cachedBriefing, inputHash } = await briefingCache.checkBeforeApiCall(clusters);

        if (!shouldCallApi && cachedBriefing) {
            return cachedBriefing;
        }

        try {
            // 2. Attempt Gemini Synthesis
            const executiveSummary = await geminiSynthesis.generateSummary(date, clusters, gprIndex);

            const briefing: DailyBriefing = {
                date,
                executiveSummary,
                topClusters: clusters,
                gprIndex,
                marketSentiment,
                generatedAt: new Date().toISOString(),
                cacheHash: inputHash,
                source: 'gemini'
            };

            // 3. Save & Cache
            storage.saveBriefing(briefing);
            briefingCache.storeBriefing(date, briefing, inputHash);

            return briefing;
        } catch (error) {
            console.warn(`[Synthesis] Falling back to local briefing for ${date}`);

            // 4. Local Fallback
            const fallbackSummary = this.generateFallbackSummary(clusters, gprIndex);

            const briefing: DailyBriefing = {
                date,
                executiveSummary: fallbackSummary,
                topClusters: clusters,
                gprIndex,
                marketSentiment,
                generatedAt: new Date().toISOString(),
                cacheHash: inputHash,
                source: 'local-fallback'
            };

            // Save fallback briefing to storage and cache (was missing!)
            storage.saveBriefing(briefing);
            briefingCache.storeBriefing(date, briefing, inputHash);

            return briefing;
        }
    }

    private generateFallbackSummary(clusters: ArticleCluster[], gprIndex: GPRIndex): string {
        const topTopic = clusters[0]?.topic || 'Market Trends';
        const riskLevel = gprIndex.current > 50 ? 'Elevated' : 'Stable';

        return `Daily Market Intelligence Report. Top trending topic today is "${topTopic}". 
    Geopolitical risk remains ${riskLevel} at index level ${gprIndex.current}. 
    Detailed topic breakdowns are available in the cluster section below. 
    (Note: This is an automatically generated summary because the primary AI service was temporarily unavailable.)`;
    }
}

export const briefingGenerator = new BriefingGenerator();
