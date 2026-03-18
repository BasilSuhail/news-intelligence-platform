/**
 * Supabase News Backup Module
 * 
 * Backs up pipeline results to Supabase as a cloud-persisted copy of the
 * local SQLite data.  Runs non-blocking after every pipeline execution.
 * 
 * Also provides a keep-alive ping to prevent the Supabase free-tier
 * from pausing after 1 week of inactivity.
 * 
 * ─────────────────────────────────────────────────────────────────────────
 * Matches the existing Supabase schema:
 *   - news_articles (headline, sentiment_score, impact_score, key_entities, trend_direction)
 *   - daily_analysis (briefing, overall_sentiment, trend_report, opportunities, risk_factors, market_sentiment)
 *   - sentiment_history (avg_sentiment, article_count, top_topics, trend_momentum)
 * ─────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseConfigured } from '../../supabase';
import { DailyAnalysis, EnrichedArticle } from './types';

const TAG = '[Supabase Backup]';

// ─────────────────────────────────────────────────────────────────────────
// Keep-alive: lightweight ping every 3 days to avoid free-tier pausing
// ─────────────────────────────────────────────────────────────────────────

const KEEP_ALIVE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

async function pingSupabase(): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    try {
        // A trivial query that touches the DB so Supabase counts it as activity
        const { error } = await supabase
            .from('daily_analysis')
            .select('date')
            .limit(1);

        if (error) {
            // Table might not exist yet — that's fine, the query still counts as activity
            console.log(`${TAG} Keep-alive ping sent (table may not exist yet: ${error.code})`);
        } else {
            console.log(`${TAG} Keep-alive ping successful`);
        }
    } catch (err: any) {
        console.warn(`${TAG} Keep-alive ping failed: ${err.message}`);
    }
}

/**
 * Start the keep-alive timer.  Safe to call multiple times — only one
 * timer will be active at any point.
 */
export function startKeepAlive(): void {
    if (keepAliveTimer) return;
    if (!isSupabaseConfigured()) {
        console.log(`${TAG} Supabase not configured — keep-alive disabled`);
        return;
    }

    console.log(`${TAG} Keep-alive started (every 3 days)`);

    // Ping immediately on start, then every 3 days
    pingSupabase();
    keepAliveTimer = setInterval(pingSupabase, KEEP_ALIVE_INTERVAL_MS);
}

export function stopKeepAlive(): void {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Backup: persist pipeline results to Supabase
// ─────────────────────────────────────────────────────────────────────────

/**
 * Back up a DailyAnalysis result to Supabase.
 * This function is designed to be **non-blocking** — failures are logged
 * but never propagated, so the local pipeline is unaffected.
 */
export async function backupToSupabase(analysis: DailyAnalysis): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
        console.log(`${TAG} Supabase not configured — skipping backup`);
        return;
    }

    const date = analysis.date;
    console.log(`${TAG} Starting backup for ${date}...`);

    try {
        // 1. Upsert enriched articles
        await backupArticles(date, analysis.enrichedArticles);

        // 2. Upsert daily analysis summary
        await backupDailyAnalysis(date, analysis);

        // 3. Upsert per-category sentiment history
        await backupSentimentHistory(date, analysis.enrichedArticles);

        console.log(`${TAG} Backup complete for ${date}`);
    } catch (err: any) {
        // Non-fatal — local SQLite is the source of truth
        console.error(`${TAG} Backup failed (non-fatal): ${err.message}`);
    }
}

// ── Individual table backups ────────────────────────────────────────────

/**
 * Matches existing schema:
 *   date, ticker, headline, url, source, category,
 *   sentiment_score, impact_score, key_entities, trend_direction
 */
async function backupArticles(date: string, articles: EnrichedArticle[]): Promise<void> {
    if (articles.length === 0) return;

    const rows = articles.map(a => ({
        date,
        ticker: a.ticker,
        headline: a.title,
        url: a.url,
        source: a.source,
        category: a.category,
        sentiment_score: a.sentiment ? (a.sentiment.normalizedScore / 100) : 0, // Convert -100..100 → -1..1
        impact_score: a.impactScore ?? 50,
        key_entities: a.entities
            ? [...a.entities.people, ...a.entities.organizations, ...a.entities.topics].slice(0, 10)
            : [],
        trend_direction: a.sentiment
            ? (a.sentiment.label === 'positive' ? 'bullish' : a.sentiment.label === 'negative' ? 'bearish' : 'neutral')
            : 'neutral',
    }));

    // Insert in batches to avoid payload size limits
    const BATCH_SIZE = 50;
    let totalStored = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase!
            .from('news_articles')
            .insert(batch);

        if (error) {
            if (isTableMissing(error)) {
                console.warn(`${TAG} news_articles table doesn't exist — run the SQL setup`);
                return;
            } else {
                // Some articles may already exist (duplicate URLs) — that's OK
                console.warn(`${TAG} Articles batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
            }
        } else {
            totalStored += batch.length;
        }
    }

    console.log(`${TAG} Stored ${totalStored} articles`);
}

/**
 * Matches existing schema:
 *   date, briefing, overall_sentiment, trend_report,
 *   opportunities, risk_factors, market_sentiment
 */
async function backupDailyAnalysis(date: string, analysis: DailyAnalysis): Promise<void> {
    const overallSentiment = analysis.briefing?.marketSentiment?.overall
        ? analysis.briefing.marketSentiment.overall / 100  // Convert -100..100 → -1..1
        : 0;

    const trendReport = {
        clusters: analysis.clusters?.clusters?.map(c => ({
            topic: c.topic,
            articleCount: c.articleCount,
            sentiment: c.aggregateSentiment,
            keywords: c.keywords?.slice(0, 5),
        })) ?? [],
        gpr: {
            current: analysis.gprIndex?.current ?? 0,
            trend: analysis.gprIndex?.trend ?? 'stable',
        },
    };

    const row = {
        date,
        briefing: analysis.briefing?.executiveSummary ?? '',
        overall_sentiment: overallSentiment,
        trend_report: trendReport,
        opportunities: analysis.opportunities ?? [],
        risk_factors: analysis.risks ?? [],
        market_sentiment: analysis.briefing?.marketSentiment ?? { overall: 0, byCategory: {}, trend: 'neutral', confidence: 0 },
    };

    const { error } = await supabase!
        .from('daily_analysis')
        .upsert(row, { onConflict: 'date' });

    if (error) {
        if (isTableMissing(error)) {
            console.warn(`${TAG} daily_analysis table doesn't exist — run the SQL setup`);
        } else {
            console.error(`${TAG} Failed to backup daily analysis: ${error.message}`);
        }
    } else {
        console.log(`${TAG} Stored daily analysis for ${date}`);
    }
}

/**
 * Matches existing schema:
 *   date, category, avg_sentiment, article_count, top_topics, trend_momentum
 */
async function backupSentimentHistory(date: string, articles: EnrichedArticle[]): Promise<void> {
    // Group by category
    const byCategory: Record<string, EnrichedArticle[]> = {};
    for (const a of articles) {
        if (!byCategory[a.category]) byCategory[a.category] = [];
        byCategory[a.category].push(a);
    }

    const rows = Object.entries(byCategory).map(([category, catArticles]) => {
        const avgSentiment = catArticles.reduce(
            (sum, a) => sum + (a.sentiment ? a.sentiment.normalizedScore / 100 : 0), // Convert to -1..1
            0
        ) / catArticles.length;

        // Extract top topics from entities
        const topTopics = Array.from(
            new Set(catArticles.flatMap(a => a.topics ?? []))
        ).slice(0, 5);

        // Determine momentum based on sentiment direction
        const positive = catArticles.filter(a => (a.sentiment?.normalizedScore ?? 0) > 10).length;
        const negative = catArticles.filter(a => (a.sentiment?.normalizedScore ?? 0) < -10).length;
        let momentum = 'stable';
        if (positive > negative * 1.5) momentum = 'accelerating';
        else if (negative > positive * 1.5) momentum = 'decelerating';

        return {
            date,
            category,
            avg_sentiment: avgSentiment,
            article_count: catArticles.length,
            top_topics: topTopics,
            trend_momentum: momentum,
        };
    });

    if (rows.length === 0) return;

    const { error } = await supabase!
        .from('sentiment_history')
        .upsert(rows, { onConflict: 'date,category' });

    if (error) {
        if (isTableMissing(error)) {
            console.warn(`${TAG} sentiment_history table doesn't exist — run the SQL setup`);
        } else {
            console.error(`${TAG} Failed to backup sentiment history: ${error.message}`);
        }
    } else {
        console.log(`${TAG} Stored sentiment history for ${rows.length} categories`);
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function isTableMissing(error: any): boolean {
    return (
        error.message?.includes('does not exist') ||
        error.code === '42P01' ||
        error.code === 'PGRST116'
    );
}
