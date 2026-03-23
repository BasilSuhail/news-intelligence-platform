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
 * Calibrated so a typical news day lands in 30-50 (Stable/Elevated),
 * genuine crises push 70+, and only concurrent multi-front escalation hits 90+.
 */
export class GPRCalculator {
    // Pruned keyword dictionary — removed false-positive-prone words
    // ("attack", "defense", "conflict", "battle", "combat", "weapon",
    //  "threat", "protest", "condemn", "hostile", "denounce", "adversary")
    // and eliminated cross-category duplicates.
    private static readonly KEYWORDS = {
        military: ['war', 'warfare', 'troops', 'army', 'missile', 'nuclear', 'invasion', 'airstrike', 'bombing', 'casualties', 'drone strike', 'escalation', 'military deployment', 'arms race'],
        economic: ['sanctions', 'embargo', 'tariff', 'trade war', 'blacklist', 'export ban', 'economic warfare', 'blockade', 'currency manipulation', 'capital controls', 'asset freeze', 'trade restrictions'],
        political: ['coup', 'overthrow', 'regime change', 'civil unrest', 'riot', 'martial law', 'emergency powers', 'political crisis', 'assassination', 'uprising'],
        security: ['terrorism', 'terrorist', 'extremist', 'hostage', 'kidnapping', 'insurgent', 'militia', 'radicalization'],
        diplomatic: ['diplomatic crisis', 'expel diplomats', 'recall ambassador', 'break relations', 'ultimatum', 'retaliate', 'provocation', 'confrontation', 'standoff', 'brinkmanship'],
        regional: ['taiwan strait', 'south china sea', 'north korea', 'ukraine war', 'crimea', 'gaza', 'west bank', 'iran nuclear', 'yemen', 'kashmir']
    };

    private static readonly WEIGHTS: Record<string, number> = {
        'nuclear': 3.0, 'invasion': 3.0, 'missile': 2.5, 'airstrike': 2.5,
        'sanctions': 2.0, 'military deployment': 2.0, 'coup': 2.0, 'terrorism': 2.0, 'war': 2.0,
        'tariff': 1.5, 'trade war': 1.5, 'diplomatic crisis': 1.5, 'embargo': 1.5,
        'escalation': 1.5, 'martial law': 1.5, 'assassination': 1.5
    };

    // Max weighted score any single article can contribute (prevents outlier inflation)
    private static readonly MAX_ARTICLE_SCORE = 4;

    /**
     * Calculate GPR for a specific day.
     *
     * Uses a two-signal blend:
     *   intensity  — log-dampened average keyword weight per article (caps runaway scores)
     *   breadth    — fraction of articles that contain any geopolitical keyword
     *
     * Calibration targets (with pruned keywords):
     *   Quiet day  → 20-35   Stable Market
     *   Normal     → 35-55   Elevated Risk (low end)
     *   Heated     → 55-70   Elevated Risk (high end)
     *   Crisis     → 70-85   Extreme Anxiety
     *   Multi-front→ 85-100  Extreme Anxiety (peak)
     */
    public calculateDaily(articles: EnrichedArticle[], date: string): GPRDataPoint {
        const keywordCounts: Record<string, number> = {};
        let cappedWeightedTotal = 0;
        let articlesWithMatches = 0;

        for (const article of articles) {
            const text = `${article.title} ${article.description || ''}`.toLowerCase();
            let articleScore = 0;
            let matched = false;

            for (const [_category, keywords] of Object.entries(GPRCalculator.KEYWORDS)) {
                for (const word of keywords) {
                    const regex = new RegExp(`\\b${word}\\b`, 'gi');
                    const matches = (text.match(regex) || []).length;

                    if (matches > 0) {
                        keywordCounts[word] = (keywordCounts[word] || 0) + matches;
                        const weight = GPRCalculator.WEIGHTS[word] || 1.0;
                        articleScore += matches * weight;
                        matched = true;
                    }
                }
            }

            // Cap per-article contribution to prevent a single article from dominating
            cappedWeightedTotal += Math.min(articleScore, GPRCalculator.MAX_ARTICLE_SCORE);
            if (matched) articlesWithMatches++;
        }

        // Two-signal scoring with logarithmic dampening
        const avgIntensity = articles.length > 0 ? cappedWeightedTotal / articles.length : 0;
        const breadthRatio = articles.length > 0 ? articlesWithMatches / articles.length : 0;

        // log1p(x*8)*22: 0.3→27, 0.6→37, 1.2→49, 2.5→63, 4.0→72
        // breadth*20:    0.2→4,  0.35→7, 0.5→10, 0.7→14, 0.9→18
        const intensityComponent = Math.log1p(avgIntensity * 8) * 22;
        const breadthComponent = breadthRatio * 20;

        const score = Math.min(100, Math.round(intensityComponent + breadthComponent));

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
