import {
    RawArticle,
    EnrichedArticle
} from '../core/types';
import { sentimentEngine } from './sentiment';
import { ImpactEngine } from './impact';
import { GeoTagEngine } from './geotags';
import { nerEngine } from './ner';
import { storage } from '../core/storage';

/**
 * Enrichment Pipeline - Orchestrates the "Local Brain"
 * Processes raw articles and adds intelligent metadata.
 */
export class EnrichmentPipeline {
    /**
     * Enrich a batch of articles (uses BERT when available)
     */
    public async enrichBatch(articles: RawArticle[]): Promise<EnrichedArticle[]> {
        console.log(`[Enrichment] Processing ${articles.length} articles...`);
        console.log(`[Enrichment] BERT status:`, sentimentEngine.getBertStatus());

        const enriched: EnrichedArticle[] = [];

        for (const article of articles) {
            try {
                const enrichedArticle = await this.enrichSingle(article);
                enriched.push(enrichedArticle);
            } catch (error) {
                console.error(`[Enrichment] Failed for article ${article.id}:`, error);
            }
        }

        // Save enriched articles to storage
        if (enriched.length > 0) {
            console.log(`[Enrichment] Saving ${enriched.length} enriched articles...`);
            storage.saveEnrichedArticles(enriched);
        }

        return enriched;
    }

    /**
     * Perform all enrichment steps on a single article
     */
    private async enrichSingle(article: RawArticle): Promise<EnrichedArticle> {
        // 1. Sentiment Analysis (async - uses BERT when available)
        const textToAnalyze = `${article.title} ${article.description || ''}`;
        const sentiment = await sentimentEngine.analyzeAsync(textToAnalyze);

        // 2. Geopolitical Tagging
        const geoResult = GeoTagEngine.tag(textToAnalyze);

        // 3. Named Entity Recognition (NER)
        const entities = nerEngine.extract(textToAnalyze);

        // 4. Impact Scoring
        const impactScore = ImpactEngine.calculate({
            sentimentMagnitude: Math.abs(sentiment.normalizedScore),
            clusterSize: 1, // Default for non-clustered, will be updated after clustering
            sourceWeight: 1.0, // Should be looked up by source name
            recency: ImpactEngine.calculateRecency(article.publishedAt)
        }, article.sourceId);

        // 5. Topic Extraction - Use NER topics if available, fallback to simple
        const topics = entities.topics.length > 0
            ? entities.topics
            : this.extractSimpleTopics(textToAnalyze);

        return {
            ...article,
            sentiment,
            impactScore,
            geoTags: geoResult.tags,
            topics,
            entities,
            clusterId: undefined,
            isContrarian: false
        };
    }

    private extractSimpleTopics(text: string): string[] {
        // Very simple topic extractor - will be replaced by Clustering Layer
        const commonWords = ['the', 'and', 'for', 'with', 'this', 'that'];
        return text.split(/\s+/)
            .filter(w => w.length > 4 && !commonWords.includes(w.toLowerCase()))
            .slice(0, 5);
    }
}

export const enrichmentPipeline = new EnrichmentPipeline();
