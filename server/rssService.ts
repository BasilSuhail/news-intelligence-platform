/**
 * RSS Feed Service - Fetch news from curated RSS feeds
 * Works as a fallback/supplement to NewsAPI
 */

import Parser from "rss-parser";

const parser = new Parser({
    timeout: 10000,
    headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)",
    },
});

// Interface matching NewsArticle in newsService
export interface RSSNewsArticle {
    ticker: string;
    headline: string;
    url: string;
    source: string;
    pubDate?: string;
}

// Curated RSS feeds mapped to categories
const RSS_FEEDS: Record<string, Array<{ url: string; source: string; ticker: string }>> = {
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
    semi_supply_chain: [
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

/**
 * Fetch news from a single RSS feed
 */
async function fetchSingleFeed(
    feedConfig: { url: string; source: string; ticker: string }
): Promise<RSSNewsArticle[]> {
    try {
        const feed = await parser.parseURL(feedConfig.url);
        const articles: RSSNewsArticle[] = [];

        for (const item of feed.items.slice(0, 10)) { // Limit to 10 items per feed
            if (item.title && item.link) {
                articles.push({
                    ticker: feedConfig.ticker,
                    headline: item.title.trim(),
                    url: item.link,
                    source: feedConfig.source,
                    pubDate: item.pubDate || item.isoDate,
                });
            }
        }

        console.log(`[RSS] Fetched ${articles.length} articles from ${feedConfig.source}`);
        return articles;
    } catch (error: any) {
        console.warn(`[RSS] Failed to fetch ${feedConfig.source}: ${error.message}`);
        return [];
    }
}

/**
 * Fetch all RSS feeds for a category
 */
export async function fetchRSSForCategory(category: string): Promise<RSSNewsArticle[]> {
    const feeds = RSS_FEEDS[category];
    if (!feeds || feeds.length === 0) {
        console.log(`[RSS] No feeds configured for category: ${category}`);
        return [];
    }

    console.log(`[RSS] Fetching ${feeds.length} feeds for ${category}...`);

    const results = await Promise.allSettled(
        feeds.map(feed => fetchSingleFeed(feed))
    );

    const articles: RSSNewsArticle[] = [];
    for (const result of results) {
        if (result.status === "fulfilled") {
            articles.push(...result.value);
        }
    }

    console.log(`[RSS] Total ${articles.length} articles for ${category}`);
    return articles;
}

/**
 * Fetch all RSS feeds for all categories
 */
export async function fetchAllRSSFeeds(): Promise<Record<string, RSSNewsArticle[]>> {
    console.log(`[RSS] Fetching all categories...`);

    const categories = Object.keys(RSS_FEEDS);
    const result: Record<string, RSSNewsArticle[]> = {};

    for (const category of categories) {
        result[category] = await fetchRSSForCategory(category);
        // Small delay between categories to be nice to servers
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return result;
}

/**
 * Filter RSS articles by date (articles published on or after the target date)
 */
export function filterRSSByDate(articles: RSSNewsArticle[], targetDate: string): RSSNewsArticle[] {
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    return articles.filter(article => {
        if (!article.pubDate) return true; // Include if no date available
        const pubDate = new Date(article.pubDate);
        pubDate.setHours(0, 0, 0, 0);
        return pubDate >= target;
    });
}

/**
 * Check if RSS feeds are available (for health checks)
 */
export async function testRSSConnection(): Promise<boolean> {
    try {
        // Test with one reliable feed
        const feed = await parser.parseURL("https://feeds.bbci.co.uk/news/technology/rss.xml");
        return feed.items.length > 0;
    } catch {
        return false;
    }
}

export { RSS_FEEDS };
