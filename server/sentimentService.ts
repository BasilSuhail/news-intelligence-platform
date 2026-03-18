/**
 * Local Sentiment Analysis Service
 * Rule-based sentiment analysis that works without any API
 * Uses the 'sentiment' npm package for reliable headline analysis
 */

import Sentiment from "sentiment";

const analyzer = new Sentiment();

// Custom terms for financial/tech news (boost positive/negative detection)
const customTerms: Record<string, number> = {
    // Positive financial terms
    "bullish": 3,
    "surge": 3,
    "soar": 3,
    "rally": 2,
    "gain": 2,
    "growth": 2,
    "breakthrough": 3,
    "innovation": 2,
    "upgrade": 2,
    "outperform": 3,
    "beat": 2,
    "record": 2,
    "milestone": 2,
    "partnership": 1,
    "deal": 1,
    "acquisition": 1,
    "launch": 1,
    "expansion": 2,
    "profit": 2,
    "revenue": 1,
    "boom": 3,

    // Negative financial terms
    "bearish": -3,
    "crash": -4,
    "plunge": -3,
    "tumble": -3,
    "decline": -2,
    "loss": -2,
    "layoff": -3,
    "layoffs": -3,
    "cut": -1,
    "cuts": -1,
    "slash": -2,
    "warning": -2,
    "risk": -1,
    "threat": -2,
    "crisis": -3,
    "bankruptcy": -4,
    "volatile": -2,
    "uncertainty": -2,
    "downturn": -3,
    "recession": -3,
    "sanctions": -2,
    "breach": -3,
    "hack": -3,
    "vulnerability": -2,
    "exploit": -2,
    "malware": -3,
    "attack": -2,

    // Tech-specific terms
    "AI": 1,
    "revolutionary": 2,
    "disruption": 1,
    "delay": -2,
    "shortage": -2,
    "supply chain": -1,
    "tariff": -1,
    "tariffs": -1,
    "ban": -2,
    "restrict": -1,
    "restriction": -1,
};

// Register custom terms
analyzer.registerLanguage("en", {
    labels: customTerms,
});

export interface SentimentResult {
    score: number;           // Raw score (-5 to 5 typically)
    comparative: number;     // Score / word count
    normalizedScore: number; // Normalized to -100 to 100
    sentiment: "positive" | "negative" | "neutral";
    confidence: number;      // 0-100 confidence level
}

/**
 * Analyze sentiment of a single headline
 */
export function analyzeHeadline(headline: string): SentimentResult {
    const result = analyzer.analyze(headline);

    // Normalize score to -100 to 100 range
    // Most headlines have scores between -10 and 10
    const normalizedScore = Math.max(-100, Math.min(100, result.comparative * 50));

    // Determine sentiment category
    let sentiment: "positive" | "negative" | "neutral";
    if (normalizedScore > 15) sentiment = "positive";
    else if (normalizedScore < -15) sentiment = "negative";
    else sentiment = "neutral";

    // Calculate confidence based on word count and score magnitude
    const wordCount = headline.split(/\s+/).length;
    const scoreMagnitude = Math.abs(result.score);
    const confidence = Math.min(100, Math.round(
        (scoreMagnitude * 10 + wordCount * 2)
    ));

    return {
        score: result.score,
        comparative: result.comparative,
        normalizedScore: Math.round(normalizedScore),
        sentiment,
        confidence: Math.min(100, confidence),
    };
}

/**
 * Analyze sentiment for multiple headlines and return aggregate
 */
export function analyzeMultipleHeadlines(headlines: string[]): {
    avgScore: number;
    avgNormalized: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    overallSentiment: "positive" | "negative" | "neutral";
    confidence: number;
} {
    if (headlines.length === 0) {
        return {
            avgScore: 0,
            avgNormalized: 0,
            positiveCount: 0,
            negativeCount: 0,
            neutralCount: 0,
            overallSentiment: "neutral",
            confidence: 0,
        };
    }

    const results = headlines.map(h => analyzeHeadline(h));

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const avgNormalized = results.reduce((sum, r) => sum + r.normalizedScore, 0) / results.length;

    const positiveCount = results.filter(r => r.sentiment === "positive").length;
    const negativeCount = results.filter(r => r.sentiment === "negative").length;
    const neutralCount = results.filter(r => r.sentiment === "neutral").length;

    let overallSentiment: "positive" | "negative" | "neutral";
    if (avgNormalized > 10) overallSentiment = "positive";
    else if (avgNormalized < -10) overallSentiment = "negative";
    else overallSentiment = "neutral";

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
        avgScore: Math.round(avgScore * 100) / 100,
        avgNormalized: Math.round(avgNormalized),
        positiveCount,
        negativeCount,
        neutralCount,
        overallSentiment,
        confidence: Math.round(avgConfidence),
    };
}

/**
 * Analyze news for a category (list of articles with headlines)
 */
export function analyzeCategoryNews(articles: Array<{ headline: string }>): {
    sentimentScore: number;  // -100 to 100
    momentum: "accelerating" | "stable" | "decelerating";
    analysis: string;
    articleCount: number;
} {
    const headlines = articles.map(a => a.headline);
    const result = analyzeMultipleHeadlines(headlines);

    // Determine momentum based on ratios
    let momentum: "accelerating" | "stable" | "decelerating";
    if (result.positiveCount > result.negativeCount * 1.5) {
        momentum = "accelerating";
    } else if (result.negativeCount > result.positiveCount * 1.5) {
        momentum = "decelerating";
    } else {
        momentum = "stable";
    }

    // Generate analysis summary
    let analysis: string;
    if (result.overallSentiment === "positive") {
        analysis = `Positive sentiment detected with ${result.positiveCount} bullish headlines. Market momentum appears favorable.`;
    } else if (result.overallSentiment === "negative") {
        analysis = `Cautionary sentiment with ${result.negativeCount} concerning headlines. Monitor for risk factors.`;
    } else {
        analysis = `Mixed signals with balanced positive and negative headlines. Market direction unclear.`;
    }

    return {
        sentimentScore: result.avgNormalized,
        momentum,
        analysis,
        articleCount: articles.length,
    };
}

/**
 * Detect trending topics from headlines
 */
export function detectTrendingTopics(headlines: string[]): Array<{
    topic: string;
    count: number;
    sentiment: number;
}> {
    const keywords: Record<string, { count: number; sentimentSum: number }> = {};

    // Important keywords to track
    const trackKeywords = [
        "AI", "GPU", "chip", "semiconductor", "NVIDIA", "AMD", "Intel", "TSMC",
        "OpenAI", "ChatGPT", "Gemini", "Microsoft", "Google", "Apple", "Meta",
        "Bitcoin", "crypto", "blockchain", "fintech", "payment",
        "cybersecurity", "hack", "breach", "ransomware",
        "tariff", "trade", "China", "Taiwan", "sanctions",
        "cloud", "data center", "enterprise", "automation",
    ];

    for (const headline of headlines) {
        const result = analyzeHeadline(headline);
        const lowerHeadline = headline.toLowerCase();

        for (const keyword of trackKeywords) {
            if (lowerHeadline.includes(keyword.toLowerCase())) {
                if (!keywords[keyword]) {
                    keywords[keyword] = { count: 0, sentimentSum: 0 };
                }
                keywords[keyword].count++;
                keywords[keyword].sentimentSum += result.normalizedScore;
            }
        }
    }

    // Convert to array and sort by count
    return Object.entries(keywords)
        .map(([topic, data]) => ({
            topic,
            count: data.count,
            sentiment: Math.round(data.sentimentSum / data.count),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}

/**
 * Generate a simple briefing from headlines (no AI needed)
 */
export function generateLocalBriefing(
    categoryData: Record<string, Array<{ headline: string; ticker?: string }>>,
    date: string
): string {
    const parts: string[] = [];
    const dateStr = new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    parts.push(`Market Intelligence Briefing for ${dateStr}.`);

    // Analyze each category
    let bullishCategories: string[] = [];
    let bearishCategories: string[] = [];

    for (const [category, articles] of Object.entries(categoryData)) {
        if (articles.length > 0) {
            const analysis = analyzeCategoryNews(articles);
            if (analysis.sentimentScore > 20) {
                bullishCategories.push(category.replace(/_/g, " "));
            } else if (analysis.sentimentScore < -20) {
                bearishCategories.push(category.replace(/_/g, " "));
            }
        }
    }

    if (bullishCategories.length > 0) {
        parts.push(`Positive momentum in ${bullishCategories.join(", ")}.`);
    }
    if (bearishCategories.length > 0) {
        parts.push(`Caution advised in ${bearishCategories.join(", ")}.`);
    }

    // Get trending topics
    const allHeadlines = Object.values(categoryData).flat().map(a => a.headline);
    const trending = detectTrendingTopics(allHeadlines);
    if (trending.length > 0) {
        const topTopics = trending.slice(0, 3).map(t => t.topic).join(", ");
        parts.push(`Key topics: ${topTopics}.`);
    }

    return parts.join(" ");
}

/**
 * Phase 1 Result Interface - baseline analysis before AI enhancement
 */
export interface Phase1Result {
    date: string;
    categorySentiments: Record<string, {
        score: number;       // -100 to 100
        momentum: "accelerating" | "stable" | "decelerating";
        articleCount: number;
        topHeadlines: string[];
    }>;
    overallSentiment: number;
    trendingTopics: Array<{ topic: string; count: number; sentiment: number }>;
    briefing: string;
    historicalContext?: {
        trend7d: "improving" | "stable" | "declining";
        avgSentiment7d: number;
        volatility: number;
    };
}

/**
 * Analyze historical sentiment trends from past news data
 */
export function analyzeHistoricalTrends(
    historicalNews: Array<{ date: string; headlines: string[] }>
): {
    trend7d: "improving" | "stable" | "declining";
    avgSentiment7d: number;
    volatility: number;
    sentimentByDay: Array<{ date: string; sentiment: number }>;
} {
    if (historicalNews.length === 0) {
        return {
            trend7d: "stable",
            avgSentiment7d: 0,
            volatility: 0,
            sentimentByDay: [],
        };
    }

    // Analyze each day's sentiment
    const sentimentByDay = historicalNews.map(day => {
        const result = analyzeMultipleHeadlines(day.headlines);
        return {
            date: day.date,
            sentiment: result.avgNormalized,
        };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate average
    const avgSentiment7d = sentimentByDay.reduce((sum, d) => sum + d.sentiment, 0) / sentimentByDay.length;

    // Calculate volatility (standard deviation)
    const variance = sentimentByDay.reduce((sum, d) => sum + Math.pow(d.sentiment - avgSentiment7d, 2), 0) / sentimentByDay.length;
    const volatility = Math.sqrt(variance);

    // Determine trend (compare first half vs second half)
    let trend7d: "improving" | "stable" | "declining" = "stable";
    if (sentimentByDay.length >= 4) {
        const midpoint = Math.floor(sentimentByDay.length / 2);
        const firstHalf = sentimentByDay.slice(0, midpoint);
        const secondHalf = sentimentByDay.slice(midpoint);

        const firstAvg = firstHalf.reduce((sum, d) => sum + d.sentiment, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d.sentiment, 0) / secondHalf.length;

        const diff = secondAvg - firstAvg;
        if (diff > 10) trend7d = "improving";
        else if (diff < -10) trend7d = "declining";
    }

    return { trend7d, avgSentiment7d: Math.round(avgSentiment7d), volatility: Math.round(volatility), sentimentByDay };
}

/**
 * Run Phase 1: Complete local sentiment analysis
 * This is the BASELINE that always runs before any AI enhancement
 */
export function runPhase1Analysis(
    categoryData: Record<string, Array<{ headline: string; ticker?: string; url?: string; source?: string }>>,
    date: string,
    historicalNews?: Array<{ date: string; headlines: string[] }>
): Phase1Result {
    console.log(`[Phase 1] Running local sentiment analysis for ${date}...`);

    // Analyze each category
    const categorySentiments: Phase1Result["categorySentiments"] = {};
    let totalScore = 0;
    let categoryCount = 0;

    for (const [category, articles] of Object.entries(categoryData)) {
        if (articles.length > 0) {
            const analysis = analyzeCategoryNews(articles);
            categorySentiments[category] = {
                score: analysis.sentimentScore,
                momentum: analysis.momentum,
                articleCount: articles.length,
                topHeadlines: articles.slice(0, 3).map(a => a.headline),
            };
            totalScore += analysis.sentimentScore;
            categoryCount++;
        }
    }

    const overallSentiment = categoryCount > 0 ? Math.round(totalScore / categoryCount) : 0;

    // Get trending topics
    const allHeadlines = Object.values(categoryData).flat().map(a => a.headline);
    const trendingTopics = detectTrendingTopics(allHeadlines);

    // Generate baseline briefing
    const briefing = generateLocalBriefing(categoryData, date);

    // Analyze historical context if available
    let historicalContext: Phase1Result["historicalContext"];
    if (historicalNews && historicalNews.length > 0) {
        const historical = analyzeHistoricalTrends(historicalNews);
        historicalContext = {
            trend7d: historical.trend7d,
            avgSentiment7d: historical.avgSentiment7d,
            volatility: historical.volatility,
        };
    }

    console.log(`[Phase 1] Complete. Overall sentiment: ${overallSentiment}, Categories: ${categoryCount}`);

    return {
        date,
        categorySentiments,
        overallSentiment,
        trendingTopics,
        briefing,
        historicalContext,
    };
}

