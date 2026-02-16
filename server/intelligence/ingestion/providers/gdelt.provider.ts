/**
 * GDELT Provider - Global news from the GDELT Project
 *
 * GDELT monitors news from virtually every country in 100+ languages,
 * updating every 15 minutes. It's completely free with no rate limits.
 *
 * API: https://api.gdeltproject.org/api/v2/doc/doc
 * Format: JSON (via jsonfmt parameter)
 * Coverage: Global, 100+ languages
 * Rate Limit: None (public API)
 */

import { BaseProvider } from './base.provider';
import {
  RawArticle,
  FetchOptions,
  ArticleCategory,
  DataProvider
} from '../../core/types';

const GDELT_API_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Map our categories to GDELT search terms
const CATEGORY_QUERIES: Record<string, { query: string; ticker: string }> = {
  ai_compute_infra: {
    query: '"artificial intelligence" OR "machine learning" OR "GPU" OR "data center" OR "cloud computing"',
    ticker: 'AI'
  },
  fintech_regtech: {
    query: '"fintech" OR "digital banking" OR "cryptocurrency" OR "blockchain" OR "financial regulation"',
    ticker: 'FIN'
  },
  rpa_enterprise_ai: {
    query: '"enterprise software" OR "automation" OR "SaaS" OR "digital transformation"',
    ticker: 'ENT'
  },
  semiconductor: {
    query: '"semiconductor" OR "chip" OR "NVIDIA" OR "TSMC" OR "Intel" OR "AMD"',
    ticker: 'SEMI'
  },
  cybersecurity: {
    query: '"cybersecurity" OR "data breach" OR "hacking" OR "ransomware" OR "cyber attack"',
    ticker: 'SEC'
  },
  geopolitics: {
    query: '"sanctions" OR "trade war" OR "NATO" OR "geopolitics" OR "military" OR "conflict"',
    ticker: 'GEO'
  }
};

interface GDELTArticle {
  url: string;
  url_mobile: string;
  title: string;
  seendate: string;
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

export class GDELTProvider extends BaseProvider {
  public name: DataProvider = 'gdelt';

  constructor() {
    super();
    this.remainingCalls = 999999; // GDELT has no rate limits
  }

  public async isAvailable(): Promise<boolean> {
    // GDELT is a public API, always available
    return true;
  }

  public async fetchArticles(options: FetchOptions): Promise<RawArticle[]> {
    const categories = options.categories || (Object.keys(CATEGORY_QUERIES) as ArticleCategory[]);
    const allArticles: RawArticle[] = [];
    const maxPerCategory = Math.ceil((options.maxArticles || 50) / categories.length);

    for (const category of categories) {
      const config = CATEGORY_QUERIES[category];
      if (!config) continue;

      try {
        const articles = await this.fetchCategory(category as ArticleCategory, config, maxPerCategory);
        allArticles.push(...articles);
        console.log(`[GDELT] ${category}: ${articles.length} articles`);

        // Small delay between categories to be polite
        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        console.warn(`[GDELT] Failed to fetch ${category}:`, error);
      }
    }

    console.log(`[GDELT] Total: ${allArticles.length} articles fetched`);
    return allArticles;
  }

  /**
   * Fetch articles for a single category from GDELT
   */
  private async fetchCategory(
    category: ArticleCategory,
    config: { query: string; ticker: string },
    maxResults: number
  ): Promise<RawArticle[]> {
    // Build GDELT API URL
    const params = new URLSearchParams({
      query: `${config.query} sourcelang:eng`,
      mode: 'ArtList',
      maxrecords: String(Math.min(maxResults, 25)), // GDELT max per request
      format: 'json',
      sort: 'DateDesc'
    });

    const url = `${GDELT_API_URL}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IntelligencePipeline/1.0)'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`GDELT API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.articles || !Array.isArray(data.articles)) {
      return [];
    }

    const articles: RawArticle[] = [];

    for (const item of data.articles as GDELTArticle[]) {
      // Validate article has required fields
      if (!item.title || !item.url || item.title.length < 20) continue;

      // Skip non-English articles that slipped through
      if (item.language && item.language !== 'English') continue;

      // Extract source name from domain
      const source = this.formatSource(item.domain);

      articles.push({
        id: this.generateId(item.url),
        title: item.title.trim(),
        description: null, // GDELT doesn't provide descriptions in ArtList mode
        content: null,
        url: item.url,
        source: `${source} (GDELT)`,
        sourceId: item.domain,
        publishedAt: this.parseGDELTDate(item.seendate),
        category,
        ticker: config.ticker,
        provider: this.name,
        imageUrl: item.socialimage || undefined
      });
    }

    return articles;
  }

  /**
   * Parse GDELT date format (YYYYMMDDHHmmss) to ISO string
   */
  private parseGDELTDate(seendate: string): string {
    if (!seendate || seendate.length < 8) {
      return new Date().toISOString();
    }

    try {
      const year = seendate.slice(0, 4);
      const month = seendate.slice(4, 6);
      const day = seendate.slice(6, 8);
      const hour = seendate.slice(8, 10) || '00';
      const min = seendate.slice(10, 12) || '00';
      const sec = seendate.slice(12, 14) || '00';

      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Format a domain into a readable source name
   * e.g., "bbc.co.uk" → "BBC", "nytimes.com" → "NY Times"
   */
  private formatSource(domain: string): string {
    if (!domain) return 'Unknown';

    // Remove common prefixes/suffixes
    const cleaned = domain
      .replace(/^www\./, '')
      .replace(/\.(com|org|net|co\.uk|io)$/, '');

    // Capitalize first letter of each word
    return cleaned
      .split(/[.\-_]/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
