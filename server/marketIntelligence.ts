/**
 * Market Intelligence - Multi-Agent Analysis System
 *
 * Agent 1 (Reader): Summarizes daily news
 * Agent 2 (Analyst): Detects cross-category trends
 * Agent 3 (Strategist): Scores opportunities and risks
 */

import { callGemini, parseGeminiJSON } from "./geminiPool";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  analyzeHeadline,
  analyzeCategoryNews,
  generateLocalBriefing,
  detectTrendingTopics,
  runPhase1Analysis,
  type Phase1Result
} from "./sentimentService";

// Types for the analysis pipeline
export interface NewsArticle {
  ticker: string;
  headline: string;
  url: string;
  source: string;
  category: string;
}

export interface EnrichedArticle extends NewsArticle {
  sentiment_score: number; // -1 to 1
  impact_score: number; // 0-100
  key_entities: string[];
  trend_direction: "bullish" | "bearish" | "neutral";
}

export interface TrendReport {
  trends: Array<{
    name: string;
    sectors: string[];
    momentum: "accelerating" | "stable" | "decelerating";
    analysis: string;
    confidence: number;
  }>;
  crossCategoryInsights: string;
}

export interface StrategistReport {
  opportunities: Array<{
    category: string;
    score: number;
    insight: string;
    tickers: string[];
    timeHorizon: "short" | "medium" | "long";
  }>;
  risks: Array<{
    factor: string;
    severity: "low" | "medium" | "high" | "critical";
    affectedSectors: string[];
    mitigation: string;
  }>;
  marketSentiment: {
    overall: number; // -100 to 100
    byCategory: Record<string, number>;
  };
}

export interface DailyAnalysis {
  date: string;
  briefing: string;
  trendReport: TrendReport;
  strategistReport: StrategistReport;
  enrichedArticles: EnrichedArticle[];
}

// Category mapping for cleaner display
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  ai_compute_infra: "AI & Compute Infrastructure",
  fintech_regtech: "FinTech & Payments",
  rpa_enterprise_ai: "Enterprise AI & Automation",
  semi_supply_chain: "Semiconductor Supply Chain",
  cybersecurity: "Cybersecurity",
  geopolitics: "Geopolitics",
  macro_finance: "Macro Finance",
};

// ============================================
// API OPTIMIZATION: Caching & Rate Limiting
// ============================================

// In-memory cache for analysis results (24-hour TTL)
const analysisCache = new Map<string, { data: DailyAnalysis; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting with exponential backoff
let consecutiveFailures = 0;
let lastApiCallTime = 0;
const MIN_DELAY_MS = 2000; // Minimum 2 seconds between API calls
const MAX_BACKOFF_MS = 60000; // Maximum 1 minute backoff

function getBackoffDelay(): number {
  if (consecutiveFailures === 0) return MIN_DELAY_MS;
  const backoff = Math.min(MIN_DELAY_MS * Math.pow(2, consecutiveFailures), MAX_BACKOFF_MS);
  console.log(`[Rate Limit] Backoff delay: ${backoff}ms after ${consecutiveFailures} failures`);
  return backoff;
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;
  const requiredDelay = getBackoffDelay();

  if (timeSinceLastCall < requiredDelay) {
    const waitTime = requiredDelay - timeSinceLastCall;
    console.log(`[Rate Limit] Waiting ${waitTime}ms before next API call...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastApiCallTime = Date.now();
}

function recordApiSuccess(): void {
  consecutiveFailures = 0;
}

function recordApiFailure(): void {
  consecutiveFailures++;
  console.warn(`[Rate Limit] API failure #${consecutiveFailures}`);
}

// ============================================
// LOW-IMPACT ARTICLE FILTERING
// ============================================

// Patterns for articles that don't need AI analysis
const LOW_IMPACT_PATTERNS = [
  /^\d+\.\d+\.\d+$/,                    // Version numbers like "2.5.19"
  /added to PyPI/i,                      // PyPI package additions
  /pypi\.org/i,                          // PyPI links in source
  /uipath \d+/i,                         // UiPath version releases
  /wyrmx-cli/i,                          // CLI tool releases
  /agent-framework/i,                    // Framework releases
  /\$\d+.*replies\)/i,                   // Slickdeals posts
  /NBA.*All-Star/i,                      // Sports news
  /LeBron/i,                             // Sports news
  /Luka Doncic/i,                        // Sports news
  /Peso Pluma/i,                         // Entertainment
  /Tour.*\d{4}/i,                        // Concert tours
  /Clearance Sale/i,                     // Sales/deals
  /Free Spins/i,                         // Gambling
  /Sportsbook Promos/i,                  // Sports betting
];

function isLowImpactArticle(headline: string, source: string): boolean {
  // Check if headline matches any low-impact pattern
  for (const pattern of LOW_IMPACT_PATTERNS) {
    if (pattern.test(headline) || pattern.test(source)) {
      return true;
    }
  }
  return false;
}

function filterHighImpactArticles(articles: NewsArticle[]): { highImpact: NewsArticle[]; lowImpact: NewsArticle[] } {
  const highImpact: NewsArticle[] = [];
  const lowImpact: NewsArticle[] = [];

  for (const article of articles) {
    if (isLowImpactArticle(article.headline, article.source)) {
      lowImpact.push(article);
    } else {
      highImpact.push(article);
    }
  }

  console.log(`[Filter] High-impact: ${highImpact.length}, Low-impact (skipped): ${lowImpact.length}`);
  return { highImpact, lowImpact };
}

// Check if we have cached analysis for a date
function getCachedAnalysis(date: string): DailyAnalysis | null {
  const cached = analysisCache.get(date);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    analysisCache.delete(date);
    return null;
  }

  console.log(`[Cache] Using cached analysis for ${date} (age: ${Math.round(age / 60000)}min)`);
  return cached.data;
}

function cacheAnalysis(date: string, analysis: DailyAnalysis): void {
  analysisCache.set(date, { data: analysis, timestamp: Date.now() });
  console.log(`[Cache] Cached analysis for ${date}`);
}

/**
 * AGENT 1: The Reader
 * Analyzes individual articles and extracts structured data
 */
async function runReaderAgent(articles: NewsArticle[]): Promise<EnrichedArticle[]> {
  if (articles.length === 0) return [];

  console.log(`[Reader Agent] Analyzing ${articles.length} articles...`);

  // Larger batches = fewer API calls
  const batchSize = 15;
  const enrichedArticles: EnrichedArticle[] = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);

    const prompt = `You are a financial news analyst. Analyze these headlines and extract structured data.

For each headline, determine:
1. sentiment_score: -1.0 (very bearish) to 1.0 (very bullish)
2. impact_score: 0-100 (how market-moving is this news)
3. key_entities: company names, people, products mentioned
4. trend_direction: "bullish", "bearish", or "neutral"

Headlines to analyze:
${batch.map((a, idx) => `${idx + 1}. [${a.ticker}] ${a.headline}`).join("\n")}

Respond with a JSON array matching this structure:
[
  {
    "index": 1,
    "sentiment_score": 0.5,
    "impact_score": 75,
    "key_entities": ["NVIDIA", "Jensen Huang", "H100"],
    "trend_direction": "bullish"
  }
]

Be objective and data-driven. High impact scores (>70) should be reserved for major announcements, earnings surprises, or regulatory changes.`;

    try {
      // Wait for rate limit before making API call
      await waitForRateLimit();

      const response = await callGemini(prompt, {
        agent: "reader",
        temperature: 0.3,
        maxOutputTokens: 1500,
      });

      // Record successful API call
      recordApiSuccess();

      const parsed = parseGeminiJSON<Array<{
        index: number;
        sentiment_score: number;
        impact_score: number;
        key_entities: string[];
        trend_direction: "bullish" | "bearish" | "neutral";
      }>>(response);

      if (parsed) {
        batch.forEach((article, idx) => {
          const analysis = parsed.find(p => p.index === idx + 1);
          enrichedArticles.push({
            ...article,
            sentiment_score: analysis?.sentiment_score ?? 0,
            impact_score: analysis?.impact_score ?? 50,
            key_entities: analysis?.key_entities ?? [],
            trend_direction: analysis?.trend_direction ?? "neutral",
          });
        });
      } else {
        // Fallback: use LOCAL sentiment analysis (no AI needed)
        console.log(`[Reader Agent] Using local sentiment analysis for batch`);
        batch.forEach(article => {
          const localSentiment = analyzeHeadline(article.headline);
          enrichedArticles.push({
            ...article,
            sentiment_score: localSentiment.normalizedScore,
            impact_score: localSentiment.confidence,
            key_entities: [],
            trend_direction: localSentiment.sentiment === "positive" ? "bullish" :
              localSentiment.sentiment === "negative" ? "bearish" : "neutral",
          });
        });
      }
    } catch (error: any) {
      console.error(`[Reader Agent] Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);

      // Record API failure for backoff calculation
      recordApiFailure();

      // Use LOCAL sentiment analysis on error (always works!)
      console.log(`[Reader Agent] Falling back to local sentiment analysis`);
      batch.forEach(article => {
        const localSentiment = analyzeHeadline(article.headline);
        enrichedArticles.push({
          ...article,
          sentiment_score: localSentiment.normalizedScore,
          impact_score: localSentiment.confidence,
          key_entities: [],
          trend_direction: localSentiment.sentiment === "positive" ? "bullish" :
            localSentiment.sentiment === "negative" ? "bearish" : "neutral",
        });
      });

      // If we're hitting rate limits, stop making more calls
      if (error.message?.includes("429") || error.message?.includes("quota")) {
        console.warn("[Reader Agent] Rate limit detected, stopping further API calls for this batch");
        // Add remaining articles with defaults
        for (let j = i + batchSize; j < articles.length; j++) {
          enrichedArticles.push({
            ...articles[j],
            sentiment_score: 0,
            impact_score: 50,
            key_entities: [],
            trend_direction: "neutral",
          });
        }
        break;
      }
    }
  }

  console.log(`[Reader Agent] Enriched ${enrichedArticles.length} articles`);
  return enrichedArticles;
}

/**
 * AGENT 2: The Analyst
 * Detects cross-category trends and patterns
 */
async function runAnalystAgent(
  enrichedArticles: EnrichedArticle[],
  briefing: string
): Promise<TrendReport> {
  console.log(`[Analyst Agent] Analyzing trends across ${enrichedArticles.length} articles...`);

  // Group articles by category for the prompt
  const byCategory: Record<string, EnrichedArticle[]> = {};
  enrichedArticles.forEach(article => {
    if (!byCategory[article.category]) {
      byCategory[article.category] = [];
    }
    byCategory[article.category].push(article);
  });

  // Calculate average sentiment per category
  const categorySentiments: Record<string, { avg: number; count: number }> = {};
  Object.entries(byCategory).forEach(([cat, articles]) => {
    const sum = articles.reduce((acc, a) => acc + a.sentiment_score, 0);
    categorySentiments[cat] = {
      avg: articles.length > 0 ? sum / articles.length : 0,
      count: articles.length,
    };
  });

  const prompt = `You are a cross-market analyst specializing in tech, finance, and geopolitics. Your job is to identify interconnected trends across sectors.

Today's briefing summary:
${briefing}

Sector data:
${Object.entries(byCategory).map(([cat, articles]) => {
    const displayName = CATEGORY_DISPLAY_NAMES[cat] || cat;
    const sentiment = categorySentiments[cat];
    const topHeadlines = articles.slice(0, 3).map(a => `  - ${a.headline}`).join("\n");
    return `${displayName} (Sentiment: ${(sentiment.avg * 100).toFixed(0)}%, ${sentiment.count} articles):
${topHeadlines}`;
  }).join("\n\n")}

Identify 3-5 interconnected macro trends. Look for:
- Cause-and-effect chains across sectors (e.g., "AI chip demand → Taiwan tensions → Supply chain risk")
- Contradictions or tensions between sectors
- Emerging themes that span multiple categories

Respond with JSON:
{
  "trends": [
    {
      "name": "AI Infrastructure Arms Race",
      "sectors": ["ai_compute_infra", "semi_supply_chain"],
      "momentum": "accelerating",
      "analysis": "Your detailed analysis here (2-3 sentences)",
      "confidence": 85
    }
  ],
  "crossCategoryInsights": "A paragraph synthesizing the overall market picture"
}`;

  try {
    const response = await callGemini(prompt, {
      agent: "analyst",
      temperature: 0.6,
      maxOutputTokens: 2000,
    });

    const parsed = parseGeminiJSON<TrendReport>(response);

    if (parsed && parsed.trends) {
      console.log(`[Analyst Agent] Identified ${parsed.trends.length} trends`);
      return parsed;
    }
  } catch (error: any) {
    console.error(`[Analyst Agent] Failed:`, error.message);
  }

  // Fallback report
  return {
    trends: [{
      name: "Market Activity",
      sectors: Object.keys(byCategory),
      momentum: "stable",
      analysis: "Analysis temporarily unavailable. Review individual category headlines for insights.",
      confidence: 50,
    }],
    crossCategoryInsights: briefing || "Cross-category analysis temporarily unavailable.",
  };
}

/**
 * AGENT 3: The Strategist
 * Scores opportunities and identifies risks
 */
async function runStrategistAgent(
  enrichedArticles: EnrichedArticle[],
  trendReport: TrendReport
): Promise<StrategistReport> {
  console.log(`[Strategist Agent] Generating investment insights...`);

  // Group by category and calculate metrics
  const byCategory: Record<string, EnrichedArticle[]> = {};
  enrichedArticles.forEach(article => {
    if (!byCategory[article.category]) {
      byCategory[article.category] = [];
    }
    byCategory[article.category].push(article);
  });

  const categoryMetrics = Object.entries(byCategory).map(([cat, articles]) => {
    const avgSentiment = articles.reduce((acc, a) => acc + a.sentiment_score, 0) / articles.length;
    const avgImpact = articles.reduce((acc, a) => acc + a.impact_score, 0) / articles.length;
    const bullishCount = articles.filter(a => a.trend_direction === "bullish").length;
    const bearishCount = articles.filter(a => a.trend_direction === "bearish").length;
    const topTickers = Array.from(new Set(articles.map(a => a.ticker))).slice(0, 5);

    return {
      category: cat,
      displayName: CATEGORY_DISPLAY_NAMES[cat] || cat,
      avgSentiment,
      avgImpact,
      bullishCount,
      bearishCount,
      topTickers,
      articleCount: articles.length,
    };
  });

  const prompt = `You are an investment strategist. Based on today's market analysis, provide actionable insights.

Trend Analysis:
${trendReport.trends.map(t => `- ${t.name} (${t.momentum}): ${t.analysis}`).join("\n")}

Category Metrics:
${categoryMetrics.map(m =>
    `${m.displayName}: Sentiment ${(m.avgSentiment * 100).toFixed(0)}%, Impact ${m.avgImpact.toFixed(0)}, Bullish/Bearish ${m.bullishCount}/${m.bearishCount}, Tickers: ${m.topTickers.join(", ")}`
  ).join("\n")}

Cross-category insights: ${trendReport.crossCategoryInsights}

Provide your analysis as JSON:
{
  "opportunities": [
    {
      "category": "ai_compute_infra",
      "score": 85,
      "insight": "Specific actionable insight (2-3 sentences)",
      "tickers": ["NVDA", "AMD"],
      "timeHorizon": "medium"
    }
  ],
  "risks": [
    {
      "factor": "Specific risk factor",
      "severity": "high",
      "affectedSectors": ["semi_supply_chain", "ai_compute_infra"],
      "mitigation": "How to hedge or position"
    }
  ],
  "marketSentiment": {
    "overall": 25,
    "byCategory": {
      "ai_compute_infra": 60,
      "fintech_regtech": 10
    }
  }
}

Guidelines:
- Score opportunities 0-100 based on risk/reward
- Be specific about tickers and time horizons
- Risk severity: low (<20% impact), medium (20-50%), high (50-80%), critical (>80%)
- Overall sentiment ranges from -100 (extreme fear) to +100 (extreme greed)`;

  try {
    const response = await callGemini(prompt, {
      agent: "strategist",
      temperature: 0.5,
      maxOutputTokens: 2000,
    });

    const parsed = parseGeminiJSON<StrategistReport>(response);

    if (parsed && parsed.opportunities) {
      console.log(`[Strategist Agent] Generated ${parsed.opportunities.length} opportunities, ${parsed.risks?.length || 0} risks`);
      return parsed;
    }
  } catch (error: any) {
    console.error(`[Strategist Agent] Failed:`, error.message);
  }

  // Fallback report
  const overallSentiment = categoryMetrics.reduce((acc, m) => acc + m.avgSentiment, 0) / categoryMetrics.length;
  const byCategorySentiment: Record<string, number> = {};
  categoryMetrics.forEach(m => {
    byCategorySentiment[m.category] = Math.round(m.avgSentiment * 100);
  });

  return {
    opportunities: [],
    risks: [],
    marketSentiment: {
      overall: Math.round(overallSentiment * 100),
      byCategory: byCategorySentiment,
    },
  };
}

/**
 * Generate the daily briefing (existing functionality, enhanced)
 */
async function generateDailyBriefing(
  articles: NewsArticle[],
  date: string
): Promise<string> {
  if (articles.length === 0) {
    return `Market intelligence briefing for ${date}. No significant news to report today.`;
  }

  // Group by category
  const byCategory: Record<string, NewsArticle[]> = {};
  articles.forEach(article => {
    if (!byCategory[article.category]) {
      byCategory[article.category] = [];
    }
    byCategory[article.category].push(article);
  });

  const headlinesSummary = Object.entries(byCategory)
    .map(([cat, arts]) => {
      const displayName = CATEGORY_DISPLAY_NAMES[cat] || cat;
      return `${displayName}:\n${arts.slice(0, 3).map(a => `  - ${a.ticker}: ${a.headline}`).join("\n")}`;
    })
    .join("\n\n");

  const prompt = `You are a sharp, experienced Wall Street tech analyst writing your morning briefing. Your readers are sophisticated investors who track AI infrastructure, semiconductors, fintech, enterprise software, and cybersecurity.

Today is ${date}. Based on today's headlines below, write a compelling 2-3 paragraph analysis (250-350 words) that:

1. Opens with the day's most significant market-moving story and why it matters
2. Draws connections between seemingly unrelated news items to reveal sector trends
3. Provides specific price targets, market cap impacts, or competitive implications where relevant
4. Names specific companies, products, and executives - no vague references
5. Ends with a forward-looking statement about what to watch this week
6. Sounds like a seasoned analyst who's seen market cycles, not an AI summary

AVOID: Generic phrases like "exciting developments", "significant progress", "continue to monitor", or "stay tuned". Be direct and opinionated.

TODAY'S HEADLINES:
${headlinesSummary}

Write your analysis now. No headers, no bullet points, just sharp analytical prose that a portfolio manager would actually want to read.`;

  try {
    const response = await callGemini(prompt, {
      agent: "reader",
      temperature: 0.8,
      maxOutputTokens: 800,
    });
    return response;
  } catch (error: any) {
    console.error(`[Briefing] Failed:`, error.message);
    return `Market intelligence briefing for ${date}. Check the detailed analysis below for today's key developments.`;
  }
}

/**
 * Store analysis results in Supabase
 */
async function storeAnalysisInSupabase(
  date: string,
  analysis: DailyAnalysis
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    console.log("[Storage] Supabase not configured, skipping storage");
    return;
  }

  try {
    // Store enriched articles
    if (analysis.enrichedArticles.length > 0) {
      const articlesToInsert = analysis.enrichedArticles.map(a => ({
        date,
        category: a.category,
        ticker: a.ticker,
        headline: a.headline,
        url: a.url,
        source: a.source,
        sentiment_score: a.sentiment_score,
        impact_score: a.impact_score,
        key_entities: a.key_entities,
        trend_direction: a.trend_direction,
      }));

      const { error: articlesError } = await supabase
        .from("news_articles")
        .upsert(articlesToInsert, { onConflict: "id" });

      if (articlesError) {
        if (articlesError.message.includes("does not exist") || articlesError.code === "42P01") {
          console.warn("[Storage] news_articles table doesn't exist - run SQL setup to enable storage");
        } else {
          console.error("[Storage] Failed to store articles:", articlesError.message);
        }
      } else {
        console.log(`[Storage] Stored ${articlesToInsert.length} articles`);
      }
    }

    // Store daily analysis
    const { error: analysisError } = await supabase
      .from("daily_analysis")
      .upsert({
        date,
        briefing: analysis.briefing,
        trend_report: analysis.trendReport,
        opportunities: analysis.strategistReport.opportunities,
        risk_factors: analysis.strategistReport.risks,
        market_sentiment: analysis.strategistReport.marketSentiment,
      }, { onConflict: "date" });

    if (analysisError) {
      if (analysisError.message.includes("does not exist") || analysisError.code === "42P01") {
        console.warn("[Storage] daily_analysis table doesn't exist - run SQL setup to enable storage");
      } else {
        console.error("[Storage] Failed to store daily analysis:", analysisError.message);
      }
    } else {
      console.log(`[Storage] Stored daily analysis for ${date}`);
    }

    // Store sentiment history
    const categoryGroups: Record<string, EnrichedArticle[]> = {};
    analysis.enrichedArticles.forEach(a => {
      if (!categoryGroups[a.category]) categoryGroups[a.category] = [];
      categoryGroups[a.category].push(a);
    });

    const sentimentRecords = Object.entries(categoryGroups).map(([category, articles]) => {
      const avgSentiment = articles.reduce((acc, a) => acc + a.sentiment_score, 0) / articles.length;
      const topEntities = Array.from(new Set(articles.flatMap(a => a.key_entities))).slice(0, 5);

      // Determine momentum based on sentiment direction
      let momentum: "accelerating" | "stable" | "decelerating" = "stable";
      const bullishCount = articles.filter(a => a.trend_direction === "bullish").length;
      const bearishCount = articles.filter(a => a.trend_direction === "bearish").length;
      if (bullishCount > bearishCount * 1.5) momentum = "accelerating";
      else if (bearishCount > bullishCount * 1.5) momentum = "decelerating";

      return {
        date,
        category,
        avg_sentiment: avgSentiment,
        article_count: articles.length,
        top_topics: topEntities,
        trend_momentum: momentum,
      };
    });

    if (sentimentRecords.length > 0) {
      const { error: sentimentError } = await supabase
        .from("sentiment_history")
        .upsert(sentimentRecords, { onConflict: "date,category" });

      if (sentimentError) {
        if (sentimentError.message.includes("does not exist") || sentimentError.code === "42P01") {
          console.warn("[Storage] sentiment_history table doesn't exist - run SQL setup to enable storage");
        } else {
          console.error("[Storage] Failed to store sentiment history:", sentimentError.message);
        }
      } else {
        console.log(`[Storage] Stored sentiment history for ${sentimentRecords.length} categories`);
      }
    }
  } catch (error: any) {
    console.error("[Storage] Error storing analysis:", error.message);
  }
}

/**
 * Main entry point: Run full analysis pipeline
 */
export async function runMarketIntelligence(
  rawArticles: Array<{ ticker: string; headline: string; url: string; source: string }>,
  categories: Record<string, Array<{ ticker: string; headline: string; url: string; source: string }>>,
  date: string
): Promise<DailyAnalysis> {
  console.log(`\n========================================`);
  console.log(`[Market Intelligence] Starting TWO-PHASE analysis for ${date}`);
  console.log(`========================================\n`);

  // Check cache first - reuse analysis from the last 24 hours
  const cachedAnalysis = getCachedAnalysis(date);
  if (cachedAnalysis) {
    console.log(`[Market Intelligence] Using cached analysis for ${date}`);
    return cachedAnalysis;
  }

  // Flatten articles with category info
  const allArticles: NewsArticle[] = [];
  Object.entries(categories).forEach(([category, articles]) => {
    articles.forEach(a => {
      allArticles.push({ ...a, category });
    });
  });

  console.log(`[Market Intelligence] Total articles received: ${allArticles.length}`);

  // ============================================
  // PHASE 1: LOCAL SENTIMENT ANALYSIS (Always runs, no API needed)
  // ============================================
  console.log(`\n--- PHASE 1: Local Sentiment Analysis (No API) ---`);

  // Run Phase 1 - this ALWAYS succeeds
  const phase1Result = runPhase1Analysis(categories, date);

  console.log(`[Phase 1] Baseline sentiment: ${phase1Result.overallSentiment}`);
  console.log(`[Phase 1] Trending topics: ${phase1Result.trendingTopics.slice(0, 3).map(t => t.topic).join(", ")}`);

  // Filter out low-impact articles to reduce API calls
  const { highImpact, lowImpact } = filterHighImpactArticles(allArticles);
  console.log(`[Market Intelligence] High-impact: ${highImpact.length}, Low-impact: ${lowImpact.length}`);

  // ============================================
  // PHASE 2: AI ENHANCEMENT (Uses Gemini to improve Phase 1)
  // ============================================
  console.log(`\n--- PHASE 2: AI Enhancement (Gemini API) ---`);

  let briefing: string;
  let enrichedArticles: EnrichedArticle[];
  let trendReport: TrendReport;
  let strategistReport: StrategistReport;
  let aiEnhanced = false;

  try {
    // Step 2.1: Generate AI briefing (pass Phase 1 context)
    console.log(`\n[Phase 2.1] Generating AI-enhanced briefing...`);
    briefing = await generateDailyBriefing(highImpact, date);

    // Step 2.2: Run Reader Agent with local sentiment as baseline
    console.log(`\n[Phase 2.2] Running Reader Agent (AI enhancement)...`);
    const enrichedHighImpact = await runReaderAgent(highImpact);

    // Add low-impact articles with LOCAL sentiment values
    const enrichedLowImpact: EnrichedArticle[] = lowImpact.map(article => {
      const localSentiment = analyzeHeadline(article.headline);
      return {
        ...article,
        sentiment_score: localSentiment.normalizedScore,
        impact_score: 20,
        key_entities: [],
        trend_direction: localSentiment.sentiment === "positive" ? "bullish" as const :
          localSentiment.sentiment === "negative" ? "bearish" as const : "neutral" as const,
      };
    });

    enrichedArticles = [...enrichedHighImpact, ...enrichedLowImpact];

    // Step 2.3: Run Analyst Agent
    console.log(`\n[Phase 2.3] Running Analyst Agent...`);
    await waitForRateLimit();
    trendReport = await runAnalystAgent(enrichedHighImpact, briefing);

    // Step 2.4: Run Strategist Agent
    console.log(`\n[Phase 2.4] Running Strategist Agent...`);
    await waitForRateLimit();
    strategistReport = await runStrategistAgent(enrichedHighImpact, trendReport);

    aiEnhanced = true;
    console.log(`\n[Phase 2] AI enhancement complete!`);

  } catch (error: any) {
    // PHASE 2 FAILED - Use Phase 1 results instead
    console.warn(`\n[Phase 2] AI enhancement failed: ${error.message}`);
    console.log(`[Phase 2] Falling back to Phase 1 local analysis results`);

    // Use Phase 1 briefing
    briefing = phase1Result.briefing;

    // Build enriched articles from Phase 1 sentiment
    enrichedArticles = allArticles.map(article => {
      const localSentiment = analyzeHeadline(article.headline);
      return {
        ...article,
        sentiment_score: localSentiment.normalizedScore,
        impact_score: localSentiment.confidence,
        key_entities: [],
        trend_direction: localSentiment.sentiment === "positive" ? "bullish" as const :
          localSentiment.sentiment === "negative" ? "bearish" as const : "neutral" as const,
      };
    });

    // Build trend report from Phase 1
    trendReport = {
      trends: Object.entries(phase1Result.categorySentiments).map(([cat, data]) => ({
        name: CATEGORY_DISPLAY_NAMES[cat] || cat,
        sectors: [cat],
        momentum: data.momentum,
        analysis: `Local analysis: ${data.articleCount} articles with ${data.score > 0 ? "positive" : data.score < 0 ? "negative" : "neutral"} sentiment.`,
        confidence: 60,
      })),
      crossCategoryInsights: `Based on local sentiment analysis. Overall market sentiment: ${phase1Result.overallSentiment > 0 ? "positive" : phase1Result.overallSentiment < 0 ? "cautious" : "neutral"}.`,
    };

    // Build strategist report from Phase 1
    strategistReport = {
      opportunities: Object.entries(phase1Result.categorySentiments)
        .filter(([_, data]) => data.score > 20)
        .map(([cat, data]) => ({
          category: cat,
          score: Math.min(100, 50 + data.score),
          insight: `Positive sentiment detected in ${data.articleCount} articles.`,
          tickers: [],
          timeHorizon: "short" as const,
        })),
      risks: Object.entries(phase1Result.categorySentiments)
        .filter(([_, data]) => data.score < -20)
        .map(([cat, data]) => ({
          factor: `Negative sentiment in ${CATEGORY_DISPLAY_NAMES[cat] || cat}`,
          severity: data.score < -50 ? "high" as const : "medium" as const,
          affectedSectors: [cat],
          mitigation: "Monitor headlines for developing risks.",
        })),
      marketSentiment: {
        overall: phase1Result.overallSentiment,
        byCategory: Object.fromEntries(
          Object.entries(phase1Result.categorySentiments).map(([cat, data]) => [cat, data.score])
        ),
      },
    };
  }

  // Log enhancement status
  console.log(`\n[Market Intelligence] Analysis mode: ${aiEnhanced ? "AI Enhanced ✨" : "Local Baseline 📊"}`);

  // All analysis steps have been completed in the Phase 2 try/catch above

  // Compile final analysis
  const analysis: DailyAnalysis = {
    date,
    briefing,
    trendReport,
    strategistReport,
    enrichedArticles,
  };

  // Cache the analysis for 24 hours
  cacheAnalysis(date, analysis);

  // Step 5: Store in Supabase
  console.log(`\n--- Step 5: Storing Results ---`);
  await storeAnalysisInSupabase(date, analysis);

  console.log(`\n========================================`);
  console.log(`[Market Intelligence] Analysis complete for ${date}`);
  console.log(`  - Briefing: ${briefing.length} chars`);
  console.log(`  - Trends: ${trendReport.trends.length}`);
  console.log(`  - Opportunities: ${strategistReport.opportunities.length}`);
  console.log(`  - Risks: ${strategistReport.risks.length}`);
  console.log(`  - Overall Sentiment: ${strategistReport.marketSentiment.overall}`);
  console.log(`========================================\n`);

  return analysis;
}

/**
 * Get historical analysis from Supabase
 */
export async function getHistoricalAnalysis(days: number = 7): Promise<Array<{
  date: string;
  briefing: string;
  trendReport: TrendReport | null;
  strategistReport: StrategistReport | null;
}>> {
  if (!isSupabaseConfigured() || !supabase) {
    console.log("[Storage] Supabase not configured");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("daily_analysis")
      .select("*")
      .order("date", { ascending: false })
      .limit(days);

    if (error) {
      // Check if it's a "table doesn't exist" error
      if (error.message.includes("does not exist") || error.code === "42P01" || error.code === "PGRST116") {
        console.log("[Storage] daily_analysis table doesn't exist yet - run the SQL setup");
        return [];
      }
      console.error("[Storage] Failed to fetch historical analysis:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      date: row.date,
      briefing: row.briefing || "",
      trendReport: row.trend_report ? (typeof row.trend_report === 'string' ? JSON.parse(row.trend_report) : row.trend_report) : null,
      strategistReport: row.opportunities ? {
        opportunities: row.opportunities,
        risks: row.risk_factors || [],
        marketSentiment: row.market_sentiment || { overall: 0, byCategory: {} },
      } : null,
    }));
  } catch (error: any) {
    console.error("[Storage] Error fetching historical analysis:", error.message);
    return [];
  }
}

/**
 * Get sentiment history for charts
 */
export async function getSentimentHistory(days: number = 30): Promise<Array<{
  date: string;
  category: string;
  avg_sentiment: number;
  article_count: number;
  trend_momentum: string;
}>> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("sentiment_history")
      .select("*")
      .order("date", { ascending: false })
      .limit(days * 6); // ~6 categories per day

    if (error) {
      // Check if it's a "table doesn't exist" error
      if (error.message.includes("does not exist") || error.code === "42P01" || error.code === "PGRST116") {
        console.log("[Storage] sentiment_history table doesn't exist yet - run the SQL setup");
        return [];
      }
      console.error("[Storage] Failed to fetch sentiment history:", error.message);
      return [];
    }

    return data || [];
  } catch (error: any) {
    console.error("[Storage] Error fetching sentiment history:", error.message);
    return [];
  }
}
