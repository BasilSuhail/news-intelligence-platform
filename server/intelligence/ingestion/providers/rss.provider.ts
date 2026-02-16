import Parser from 'rss-parser';
import { BaseProvider } from './base.provider';
import {
    RawArticle,
    FetchOptions,
    ArticleCategory,
    DataProvider
} from '../../core/types';

/**
 * RSS Provider - Fetches articles from curated RSS feeds
 * Works as a fallback or parallel source to API providers.
 */
export class RSSProvider extends BaseProvider {
    public name: DataProvider = 'rss';

    private parser: Parser;
    private feeds: Record<string, Array<{ url: string; source: string; ticker: string }>> = {
        ai_compute_infra: [
            { url: "https://techcrunch.com/category/artificial-intelligence/feed/", source: "TechCrunch AI", ticker: "AI" },
            { url: "https://feeds.arstechnica.com/arstechnica/technology-lab", source: "Ars Technica", ticker: "AI" },
            { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", source: "The Verge AI", ticker: "AI" },
            { url: "https://siliconangle.com/category/ai/feed/", source: "SiliconANGLE AI", ticker: "AI" },
        ],
        fintech_regtech: [
            { url: "https://www.pymnts.com/feed/", source: "PYMNTS", ticker: "FIN" },
            { url: "https://techcrunch.com/category/fintech/feed/", source: "TechCrunch Fintech", ticker: "FIN" },
            { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk", ticker: "CRYPTO" },
        ],
        rpa_enterprise_ai: [
            { url: "https://siliconangle.com/category/cloud/feed/", source: "SiliconANGLE Cloud", ticker: "ENT" },
            { url: "https://www.zdnet.com/topic/digital-transformation/rss.xml", source: "ZDNet Enterprise", ticker: "ENT" },
            { url: "https://techcrunch.com/category/enterprise/feed/", source: "TechCrunch Enterprise", ticker: "ENT" },
        ],
        semiconductor: [
            { url: "https://wccftech.com/feed/", source: "Wccftech", ticker: "SEMI" },
            { url: "https://www.tomshardware.com/feeds/all", source: "Tom's Hardware", ticker: "SEMI" },
            { url: "https://www.anandtech.com/rss/", source: "AnandTech", ticker: "SEMI" },
        ],
        cybersecurity: [
            { url: "https://krebsonsecurity.com/feed/", source: "Krebs on Security", ticker: "SEC" },
            { url: "https://feeds.feedburner.com/TheHackersNews", source: "The Hacker News", ticker: "SEC" },
            { url: "https://www.helpnetsecurity.com/feed/", source: "Help Net Security", ticker: "SEC" },
        ],
        geopolitics: [
            { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World", ticker: "GEO" },
            { url: "https://feeds.reuters.com/Reuters/worldNews", source: "Reuters World", ticker: "GEO" },
            { url: "https://foreignpolicy.com/feed/", source: "Foreign Policy", ticker: "GEO" },
        ],
    };

    constructor() {
        super();
        this.parser = new Parser({
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
            },
        });
        this.remainingCalls = 999999; // Unlimited
    }

    public async isAvailable(): Promise<boolean> {
        return true; // RSS is almost always available
    }

    public async fetchArticles(options: FetchOptions): Promise<RawArticle[]> {
        const categories = options.categories || (Object.keys(this.feeds) as ArticleCategory[]);
        const allArticles: RawArticle[] = [];

        const targetDate = options.dateFrom ? new Date(options.dateFrom) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        targetDate.setHours(0, 0, 0, 0);

        for (const category of categories) {
            const feedConfigs = this.feeds[category];
            if (!feedConfigs) continue;

            for (const config of feedConfigs) {
                try {
                    const feed = await this.parser.parseURL(config.url);

                    const filteredItems = feed.items
                        .filter(item => {
                            if (!item.pubDate && !item.isoDate) return true;
                            const pubDate = new Date(item.pubDate || item.isoDate!);
                            return pubDate >= targetDate;
                        })
                        .slice(0, 10);

                    console.log(`[RSS] Processing ${filteredItems.length} items from ${config.source}`);

                    for (const item of filteredItems) {
                        const title = item.title?.trim();
                        const sourceLower = config.source.toLowerCase();

                        // Debug: Log what we're getting from RSS
                        console.log(`[RSS] Item: title="${title?.substring(0, 50)}..." link=${item.link ? 'yes' : 'no'}`);

                        // Validate title is real content, not just source name or domain
                        if (!title || title.length < 20 || !item.link) {
                            console.log(`[RSS] SKIP: too short or no link`);
                            continue;
                        }
                        if (title.toLowerCase() === sourceLower || title.toLowerCase().includes(sourceLower)) {
                            console.log(`[RSS] SKIP: matches source name`);
                            continue;
                        }
                        if (/\.(com|org|net|io|co|uk|ie|in)$/i.test(title)) {
                            console.log(`[RSS] SKIP: looks like domain`);
                            continue;
                        }
                        if (title.split(/\s+/).length < 4) {
                            console.log(`[RSS] SKIP: too few words`);
                            continue;
                        }

                        console.log(`[RSS] ACCEPTED: "${title.substring(0, 50)}..."`);
                        allArticles.push({
                            id: this.generateId(item.link),
                            title,
                            description: item.contentSnippet || item.content || null,
                            content: item.content || null,
                            url: item.link,
                            source: config.source,
                            sourceId: config.source.toLowerCase().replace(/\s+/g, '-'),
                            publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
                            category: category as ArticleCategory,
                            ticker: config.ticker,
                            provider: this.name,
                        });
                    }

                    // Small delay between feeds
                    await new Promise(r => setTimeout(r, 200));
                } catch (error) {
                    console.warn(`[RSS] Failed to fetch ${config.source}:`, error);
                }
            }
        }

        return allArticles;
    }
}
