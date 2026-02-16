import {
    RawArticle,
    FetchOptions,
    DataProviderInterface
} from '../core/types';
import { NewsAPIProvider } from './providers/newsapi.provider';
import { RSSProvider } from './providers/rss.provider';
import { GDELTProvider } from './providers/gdelt.provider';
import { storage } from '../core/storage';

/**
 * News Collector - Orchestrates multi-source ingestion
 * Prioritizes providers and deduplicates results.
 */
export class NewsCollector {
    private providers: DataProviderInterface[] = [];

    constructor() {
        this.providers = [
            new NewsAPIProvider(),
            new RSSProvider(),
            new GDELTProvider()
        ];
    }

    /**
     * Run a full collection cycle
     */
    public async runCollection(options: FetchOptions = {}): Promise<RawArticle[]> {
        console.log(`[Collector] Starting ingestion cycle...`);

        const allArticles: RawArticle[] = [];
        const seenUrls = new Set<string>();

        for (const provider of this.providers) {
            if (!(await provider.isAvailable())) {
                console.warn(`[Collector] Provider ${provider.name} is unavailable, skipping.`);
                continue;
            }

            console.log(`[Collector] Fetching from ${provider.name}...`);
            try {
                const articles = await provider.fetchArticles(options);

                let newCount = 0;
                for (const article of articles) {
                    if (!seenUrls.has(article.url)) {
                        allArticles.push(article);
                        seenUrls.add(article.url);
                        newCount++;
                    }
                }

                console.log(`[Collector] ${provider.name} provided ${newCount} unique articles.`);
            } catch (error) {
                console.error(`[Collector] Provider ${provider.name} failed:`, error);
            }
        }

        console.log(`[Collector] Total unique articles collected: ${allArticles.length}`);

        // Persist to storage
        if (allArticles.length > 0) {
            console.log(`[Collector] Saving ${allArticles.length} articles to storage...`);
            storage.saveRawArticles(allArticles);
        }

        return allArticles;
    }

    /**
     * Get statuses of all providers
     */
    public getProviderStatuses() {
        return this.providers.map(p => ({
            name: p.name,
            rateLimit: p.getRateLimitStatus()
        }));
    }
}

export const collector = new NewsCollector();
