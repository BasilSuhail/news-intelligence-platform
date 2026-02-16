import {
    EnrichedArticle,
    GPRDataPoint,
    GPRIndex
} from '../core/types';
import { storage } from '../core/storage';

/**
 * Market Intelligence - GPR Index Calculator
 * 
 * Quantifies global geopolitical anxiety based on news keyword frequency.
 * Implements weighted scoring per category.
 */
export class GPRCalculator {
    // Extensive Keyword Dictionary from Specification
    private static readonly KEYWORDS = {
        military: ['war', 'warfare', 'military', 'troops', 'army', 'missile', 'nuclear', 'invasion', 'attack', 'airstrike', 'bombing', 'casualties', 'combat', 'conflict', 'battle', 'defense', 'weapon', 'drone strike', 'escalation'],
        economic: ['sanctions', 'embargo', 'tariff', 'trade war', 'blacklist', 'export ban', 'import duty', 'economic warfare', 'blockade', 'currency manipulation', 'capital controls', 'asset freeze', 'trade restrictions', 'retaliatory'],
        political: ['coup', 'overthrow', 'regime change', 'civil unrest', 'protest', 'riot', 'martial law', 'emergency powers', 'authoritarian', 'dictatorship', 'political crisis', 'impeachment', 'assassination', 'uprising'],
        security: ['terrorism', 'terrorist', 'extremist', 'attack', 'bombing', 'hostage', 'kidnapping', 'assassination', 'insurgent', 'militia', 'radicalization', 'threat'],
        diplomatic: ['diplomatic crisis', 'expel diplomats', 'recall ambassador', 'break relations', 'condemn', 'ultimatum', 'denounce', 'retaliate', 'provocation', 'hostile', 'adversary', 'confrontation', 'standoff', 'brinkmanship'],
        regional: ['taiwan strait', 'south china sea', 'north korea', 'ukraine', 'crimea', 'gaza', 'west bank', 'iran nuclear', 'syria', 'yemen', 'kashmir', 'arctic dispute']
    };

    private static readonly WEIGHTS: Record<string, number> = {
        'nuclear': 3.0, 'invasion': 3.0, 'missile strike': 3.0,
        'sanctions': 2.0, 'military deployment': 2.0, 'coup': 2.0, 'terrorism': 2.0,
        'tariff': 1.5, 'trade war': 1.5, 'diplomatic crisis': 1.5, 'protests': 1.5
    };

    private static readonly NORMALIZATION_FACTOR = 2.5;

    /**
     * Calculate GPR for a specific day
     */
    public calculateDaily(articles: EnrichedArticle[], date: string): GPRDataPoint {
        const keywordCounts: Record<string, number> = {};
        let totalWeightedMatches = 0;
        let articlesWithMatches = 0;

        for (const article of articles) {
            const text = `${article.title} ${article.description || ''}`.toLowerCase();
            let matched = false;

            // Group all keywords for counting
            for (const [category, keywords] of Object.entries(GPRCalculator.KEYWORDS)) {
                for (const word of keywords) {
                    const regex = new RegExp(`\\b${word}\\b`, 'gi');
                    const matches = (text.match(regex) || []).length;

                    if (matches > 0) {
                        keywordCounts[word] = (keywordCounts[word] || 0) + matches;
                        const weight = GPRCalculator.WEIGHTS[word] || 1.0;
                        totalWeightedMatches += matches * weight;
                        matched = true;
                    }
                }
            }

            if (matched) articlesWithMatches++;
        }

        // Normalize score: (Weighted Matches / Total Articles) * 100 * Normalization
        const rawScore = articles.length > 0 ? (totalWeightedMatches / articles.length) * 100 : 0;
        const score = Math.min(100, Math.round(rawScore * GPRCalculator.NORMALIZATION_FACTOR));

        const topKeywords = Object.entries(keywordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);

        return {
            date,
            score,
            keywordCounts,
            topKeywords,
            articleCount: articles.length
        };
    }

    /**
     * Get historical index with trend analysis
     */
    public getIndex(history: GPRDataPoint[]): GPRIndex {
        const current = history.length > 0 ? history[history.length - 1].score : 0;

        // Calculate 7-day trend
        let trend: 'rising' | 'falling' | 'stable' = 'stable';
        let percentChange7d = 0;

        if (history.length >= 14) {
            const recent7 = history.slice(-7);
            const previous7 = history.slice(-14, -7);

            const recentAvg = recent7.reduce((s, h) => s + h.score, 0) / 7;
            const previousAvg = previous7.reduce((s, h) => s + h.score, 0) / 7;

            if (previousAvg > 0) {
                percentChange7d = ((recentAvg - previousAvg) / previousAvg) * 100;
                if (percentChange7d > 10) trend = 'rising';
                else if (percentChange7d < -10) trend = 'falling';
            }
        }

        return {
            current,
            trend,
            percentChange7d,
            history
        };
    }
}

export const gprCalculator = new GPRCalculator();
