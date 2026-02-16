import { BaseProvider } from './base.provider';
import {
    RawArticle,
    FetchOptions,
    ArticleCategory,
    DataProvider
} from '../../core/types';

/**
 * Trusted tech/business news sources - only accept articles from these
 * This prevents garbage from random sites, package registries, and entertainment sites
 */
const TRUSTED_SOURCES = new Set([
    // Major Tech News
    'techcrunch', 'the verge', 'wired', 'ars technica', 'engadget',
    'cnet', 'zdnet', 'venturebeat', 'the next web', 'mashable',
    'gizmodo', 'tech radar', 'tom\'s hardware', 'anandtech',

    // Business & Finance
    'bloomberg', 'reuters', 'financial times', 'wall street journal', 'wsj',
    'cnbc', 'business insider', 'forbes', 'fortune', 'marketwatch',
    'barron\'s', 'economist', 'yahoo finance', 'seeking alpha',

    // AI & Tech Specialty
    'siliconangle', 'the register', 'protocol', 'axios', 'the information',
    'mit technology review', 'ieee spectrum', 'nvidia blog', 'google ai blog',

    // Cybersecurity
    'krebs on security', 'the hacker news', 'bleeping computer', 'dark reading',
    'security week', 'threatpost', 'cyberscoop',

    // Semiconductors
    'wccftech', 'videocardz', 'tom\'s hardware', 'anandtech', 'pcmag',
    'pc gamer', 'pc world',

    // World News
    'bbc', 'bbc news', 'associated press', 'ap news', 'npr',
    'al jazeera', 'foreign policy', 'politico',

    // FinTech
    'pymnts', 'coindesk', 'cointelegraph', 'the block', 'decrypt',
    'finextra', 'american banker'
]);

// Array version for iteration compatibility
const TRUSTED_SOURCES_ARRAY = Array.from(TRUSTED_SOURCES);

/**
 * Check if a source is trusted
 */
function isTrustedSource(sourceName: string): boolean {
    if (!sourceName) return false;
    const normalized = sourceName.toLowerCase().trim();

    // Direct match
    if (TRUSTED_SOURCES.has(normalized)) return true;

    // Partial match (e.g., "TechCrunch" matches "techcrunch")
    for (let i = 0; i < TRUSTED_SOURCES_ARRAY.length; i++) {
        const trusted = TRUSTED_SOURCES_ARRAY[i];
        if (normalized.includes(trusted) || trusted.includes(normalized)) {
            return true;
        }
    }
    return false;
}

/**
 * NewsAPI Provider - Fetches articles from newsapi.org
 * Implements multi-key rotation and rate limit tracking.
 */
export class NewsAPIProvider extends BaseProvider {
    public name: DataProvider = 'newsapi';

    private apiKeys: string[] = [];
    private currentKeyIndex: number = 0;
    private rateLimitedKeys: Set<string> = new Set();

    constructor() {
        super();
        this.loadApiKeys();
    }

    private loadApiKeys() {
        if (process.env.NEWS_API_KEY) this.apiKeys.push(process.env.NEWS_API_KEY);
        if (process.env.NEWS_API_KEY_2) this.apiKeys.push(process.env.NEWS_API_KEY_2);
        if (process.env.NEWS_API_KEY_3) this.apiKeys.push(process.env.NEWS_API_KEY_3);

        this.apiKeys = this.apiKeys.filter(k => k && !k.includes('YOUR_'));
        this.remainingCalls = this.apiKeys.length * 100; // Rough estimate for free tier
    }

    private getNextApiKey(): string | null {
        if (this.apiKeys.length === 0) return null;

        for (let i = 0; i < this.apiKeys.length; i++) {
            const index = (this.currentKeyIndex + i) % this.apiKeys.length;
            const key = this.apiKeys[index];

            if (!this.rateLimitedKeys.has(key)) {
                this.currentKeyIndex = (index + 1) % this.apiKeys.length;
                return key;
            }
        }

        return null;
    }

    private markRateLimited(key: string) {
        this.rateLimitedKeys.add(key);
        console.warn(`[NewsAPI] Key ${this.apiKeys.indexOf(key) + 1} hit rate limit`);
    }

    public async isAvailable(): Promise<boolean> {
        return this.apiKeys.length > 0 && this.getNextApiKey() !== null;
    }

    public async fetchArticles(options: FetchOptions): Promise<RawArticle[]> {
        const categories = options.categories || [
            'ai_compute_infra', 'fintech_regtech', 'rpa_enterprise_ai',
            'semiconductor', 'cybersecurity', 'geopolitics'
        ];

        // Default to last 24h if no dates provided
        const fromDate = options.dateFrom || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = options.dateTo || new Date().toISOString().split('T')[0];

        const allArticles: RawArticle[] = [];

        for (const category of categories) {
            const query = this.getQueryForCategory(category);
            const apiKey = this.getNextApiKey();

            if (!apiKey) {
                console.warn(`[NewsAPI] No available keys for category: ${category}`);
                break;
            }

            try {
                const encodedQuery = encodeURIComponent(query);
                const url = `https://newsapi.org/v2/everything?q=${encodedQuery}&language=en&sortBy=publishedAt&from=${fromDate}&to=${toDate}&pageSize=${options.maxArticles || 10}&apiKey=${apiKey}`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.status !== 'ok') {
                    if (data.message?.includes('rate limit') || data.message?.includes('too many requests')) {
                        this.markRateLimited(apiKey);
                        continue;
                    }
                    console.error(`[NewsAPI] Error: ${data.message}`);
                    continue;
                }

                // Filter out articles with invalid/missing titles
                // NewsAPI returns "[Removed]" for unavailable articles, and sometimes returns
                // articles where the title is just the source/domain name
                console.log(`[NewsAPI] Got ${data.articles?.length || 0} articles for ${category}`);

                const validArticles = (data.articles || []).filter((article: any) => {
                    const title = article.title?.trim();
                    const sourceName = article.source?.name;

                    // Debug: Log each article
                    console.log(`[NewsAPI] Checking: "${title?.substring(0, 50)}..." from ${sourceName}`);

                    // FIRST: Check if source is trusted
                    if (!isTrustedSource(sourceName)) {
                        console.log(`[NewsAPI] SKIP: untrusted source "${sourceName}"`);
                        return false;
                    }

                    if (!title || title.length < 20 || !article.url) {
                        console.log(`[NewsAPI] SKIP: too short or no URL`);
                        return false;
                    }
                    if (title.includes('[Removed]')) {
                        console.log(`[NewsAPI] SKIP: [Removed]`);
                        return false;
                    }

                    // Check if title is just the source name
                    const titleLower = title.toLowerCase();
                    const sourceNameLower = sourceName?.toLowerCase() || '';
                    if (sourceNameLower && (titleLower === sourceNameLower || titleLower.includes(sourceNameLower))) {
                        console.log(`[NewsAPI] SKIP: matches source`);
                        return false;
                    }

                    // Check if title looks like a domain
                    if (/\.(com|org|net|io|co|uk|de|fr|news|tech|ie|in)$/i.test(title)) {
                        console.log(`[NewsAPI] SKIP: looks like domain`);
                        return false;
                    }

                    // Must have at least 4 words
                    if (title.split(/\s+/).length < 4) {
                        console.log(`[NewsAPI] SKIP: too few words`);
                        return false;
                    }

                    console.log(`[NewsAPI] ACCEPTED: "${title.substring(0, 50)}..." from trusted source "${sourceName}"`);
                    return true;
                });

                console.log(`[NewsAPI] ${validArticles.length} valid articles after filtering`);

                const newsapiArticles = validArticles.map((article: any) => ({
                    id: this.generateId(article.url),
                    title: article.title,
                    description: article.description,
                    content: article.content,
                    url: article.url,
                    source: article.source.name,
                    sourceId: article.source.id || article.source.name.toLowerCase().replace(/\s+/g, '-'),
                    publishedAt: article.publishedAt,
                    category,
                    ticker: this.getTickerForCategory(category),
                    provider: this.name,
                    imageUrl: article.urlToImage
                }));

                allArticles.push(...newsapiArticles);

                // Respect free tier (small delay)
                await new Promise(r => setTimeout(r, 500));
            } catch (error) {
                console.error(`[NewsAPI] Fetch failed for ${category}:`, error);
            }
        }

        return allArticles;
    }

    private getTickerForCategory(category: ArticleCategory): string {
        const map: Record<ArticleCategory, string> = {
            ai_compute_infra: "NVDA",
            fintech_regtech: "PYPL",
            rpa_enterprise_ai: "PATH",
            semiconductor: "TSM",
            cybersecurity: "CRWD",
            geopolitics: "GEO"
        };
        return map[category] || "MARKET";
    }

    private getQueryForCategory(category: ArticleCategory): string {
        // More specific queries to get relevant tech/business news
        // Using quotes for exact phrases and combining terms for relevance
        const map: Record<ArticleCategory, string> = {
            ai_compute_infra: '("artificial intelligence" OR "machine learning" OR "GPU" OR "data center") AND (NVIDIA OR AMD OR Google OR Microsoft OR OpenAI OR Anthropic)',
            fintech_regtech: '("fintech" OR "digital payments" OR "banking technology" OR "cryptocurrency") AND (regulation OR startup OR investment)',
            rpa_enterprise_ai: '("enterprise software" OR "automation" OR "SaaS") AND (Salesforce OR ServiceNow OR Workday OR SAP)',
            semiconductor: '("semiconductor" OR "chip" OR "foundry") AND (TSMC OR Intel OR Samsung OR ASML OR shortage)',
            cybersecurity: '("cybersecurity" OR "data breach" OR "ransomware" OR "vulnerability") AND (attack OR hack OR threat)',
            geopolitics: '("trade war" OR "sanctions" OR "export controls") AND (China OR Taiwan OR technology)'
        };
        return map[category] || category;
    }
}
