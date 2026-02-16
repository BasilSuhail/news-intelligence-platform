import Sentiment from 'sentiment';
import { SentimentScore } from '../core/types';
import { sentimentCache } from '../core/cache';
import { bertSentimentEngine } from './bert-sentiment';

/**
 * Market Intelligence - Hybrid Sentiment Analysis Engine
 *
 * Implements a hybrid approach:
 * 1. BERT (Primary) - Local transformer model for high accuracy (~90%)
 * 2. Dictionary (Fallback) - Rule-based with financial terms (~65%)
 * 3. Caching Layer - Prevents re-analyzing same text
 */
export class SentimentEngine {
    private analyzer: Sentiment;
    private useBert: boolean = true; // Enable BERT by default
    private customTerms: Record<string, number> = {
        // Bullish / Positive
        "bullish": 4, "surge": 4, "soar": 4, "rally": 3, "rallying": 3,
        "breakthrough": 4, "innovation": 3, "outperform": 4, "beat": 3,
        "record-breaking": 3, "milestone": 3, "acquisition": 2, "profit": 3,
        "revenue beat": 4, "expansion": 2, "optimism": 3, "growth": 3,
        "partnership": 2, "upgrade": 3, "dividend": 2, "buyback": 3,

        // Bearish / Negative
        "bearish": -4, "crash": -5, "plunge": -4, "tumble": -4, "decline": -2,
        "layoff": -4, "layoffs": -4, "cut": -2, "cuts": -2, "slash": -3,
        "warning": -3, "risk": -2, "threat": -3, "crisis": -4, "bankruptcy": -5,
        "volatile": -2, "uncertainty": -3, "downturn": -4, "recession": -4,
        "sanctions": -3, "breach": -4, "hack": -4, "vulnerability": -3,
        "exploit": -3, "lawsuit": -3, "litigation": -2, "fine": -2,
        "shortage": -3, "inflation": -2, "stagflation": -4,

        // Tech specific
        "AI-driven": 2, "generative AI": 2, "LLM": 1, "GPU": 1,
        "chip shortage": -3, "semiconductor": 1, "foundry": 1
    };

    constructor() {
        this.analyzer = new Sentiment();
        this.analyzer.registerLanguage('en-market', {
            labels: this.customTerms
        });

        // Preload BERT model in background
        this.initBert();
    }

    /**
     * Initialize BERT model in background
     */
    private async initBert(): Promise<void> {
        try {
            await bertSentimentEngine.preload();
            console.log('[Sentiment] BERT model ready');
        } catch (error) {
            console.warn('[Sentiment] BERT unavailable, using dictionary fallback');
            this.useBert = false;
        }
    }

    /**
     * Analyze sentiment (async - uses BERT when available)
     */
    public async analyzeAsync(text: string): Promise<SentimentScore> {
        // 1. Check Cache
        const cached = sentimentCache.getSentiment(text);
        if (cached !== null) {
            return this.formatResult(cached, 'local');
        }

        // 2. Try BERT first
        if (this.useBert && bertSentimentEngine.isAvailable()) {
            try {
                const bertResult = await bertSentimentEngine.analyze(text);
                if (bertResult) {
                    const result: SentimentScore = {
                        score: bertResult.normalizedScore / 100,
                        normalizedScore: bertResult.normalizedScore,
                        confidence: bertResult.score,
                        label: bertResult.label,
                        method: 'finbert' // Using finbert as method name for compatibility
                    };

                    // Cache the result
                    sentimentCache.setSentiment(text, bertResult.normalizedScore);
                    return result;
                }
            } catch (error) {
                console.warn('[Sentiment] BERT failed, falling back to dictionary:', error);
            }
        }

        // 3. Fallback to dictionary
        return this.analyzeWithDictionary(text);
    }

    /**
     * Synchronous analyze (dictionary only - for backward compatibility)
     */
    public analyze(text: string): SentimentScore {
        // 1. Check Cache
        const cached = sentimentCache.getSentiment(text);
        if (cached !== null) {
            return this.formatResult(cached, 'local');
        }

        // 2. Use dictionary analysis
        return this.analyzeWithDictionary(text);
    }

    /**
     * Dictionary-based sentiment analysis
     */
    private analyzeWithDictionary(text: string): SentimentScore {
        const result = this.analyzer.analyze(text, { language: 'en-market' });

        // Normalize score to -100 to 100 range
        const normalizedScore = Math.max(-100, Math.min(100, Math.round(result.comparative * 20)));
        const score = normalizedScore / 100;

        let label: 'positive' | 'negative' | 'neutral';
        if (normalizedScore > 10) label = 'positive';
        else if (normalizedScore < -10) label = 'negative';
        else label = 'neutral';

        // Confidence based on word count and intensity
        const wordCount = text.split(/\s+/).length;
        const scoreMagnitude = Math.abs(result.score);
        const confidence = Math.min(0.95, (scoreMagnitude * 0.1) + (wordCount * 0.02));

        const finalResult: SentimentScore = {
            score,
            normalizedScore,
            confidence,
            label,
            method: 'local'
        };

        // Cache Result
        sentimentCache.setSentiment(text, normalizedScore);

        return finalResult;
    }

    private formatResult(normalizedScore: number, method: 'local' | 'finbert'): SentimentScore {
        let label: 'positive' | 'negative' | 'neutral';
        if (normalizedScore > 10) label = 'positive';
        else if (normalizedScore < -10) label = 'negative';
        else label = 'neutral';

        return {
            score: normalizedScore / 100,
            normalizedScore,
            confidence: 0.9,
            label,
            method
        };
    }

    /**
     * Get BERT status
     */
    public getBertStatus(): { available: boolean; status: any } {
        return {
            available: bertSentimentEngine.isAvailable(),
            status: bertSentimentEngine.getStatus()
        };
    }
}

export const sentimentEngine = new SentimentEngine();
