import fs from "fs/promises";
import path from "path";
import { pipeline } from "./intelligence/core/pipeline";
import { storage } from "./intelligence/core/storage";
import { DailyAnalysis } from "./intelligence/core/types";

// ============================================
// Legacy Wrapper for newsService.ts
// ============================================

const newsFeedDir = process.env.NEWS_FEED_DIR || process.cwd();
const newsFeedPath = path.join(newsFeedDir, "news_feed.json");

/**
 * Runs the full intelligence pipeline and returns the result.
 * Maintains compatibility with existing refresh logic.
 */
export async function refreshNewsFeed(): Promise<{
  success: boolean;
  message: string;
  fetchedDates: string[];
}> {
  console.log("[NewsService] Starting modular pipeline refresh...");

  try {
    const analysis = await pipeline.run();

    // Maintain news_feed.json for backward compatibility with frontend parts 
    // that haven't been migrated yet to the new API.
    await updateLegacyFeed(analysis);

    return {
      success: true,
      message: `Synced ${analysis.metadata.articlesProcessed} articles across ${analysis.metadata.clustersFound} topics.`,
      fetchedDates: [analysis.date]
    };
  } catch (error: any) {
    console.error("[NewsService] Pipeline refresh failed:", error);
    return {
      success: false,
      message: error.message,
      fetchedDates: []
    };
  }
}

/**
 * Updates the legacy news_feed.json file to keep old UI working
 * VERSION: 2026-01-24-v4 (trusted source validation + better diagnostics)
 */
async function updateLegacyFeed(analysis: DailyAnalysis) {
  console.log("[NewsService] updateLegacyFeed VERSION 2026-01-24-v4");
  console.log(`[NewsService] Processing ${analysis.enrichedArticles.length} enriched articles`);

  // Log category breakdown before filtering
  const categoryKeys = ['ai_compute_infra', 'fintech_regtech', 'rpa_enterprise_ai', 'semiconductor', 'cybersecurity', 'geopolitics'];
  console.log("[NewsService] Articles by category BEFORE filter:");
  for (const cat of categoryKeys) {
    const count = analysis.enrichedArticles.filter(a => a.category === cat).length;
    console.log(`  - ${cat}: ${count}`);
  }

  try {
    let feed: any[] = [];
    try {
      const content = await fs.readFile(newsFeedPath, "utf-8");
      feed = JSON.parse(content);
    } catch {
      feed = [];
    }

    // Helper to map article to legacy format with fallbacks
    const mapArticle = (a: any) => ({
      ticker: a.ticker,
      headline: a.title || a.description?.slice(0, 100) || 'Article from ' + a.source,
      url: a.url,
      source: a.source
    });

    // STRICT Filter - reject any article that looks like a source/domain name
    const isValidArticle = (a: any) => {
      const title = a.title?.trim();
      const source = a.source?.trim();

      // Must have title with substantial length (at least 20 chars for a real headline)
      if (!title || title.length < 20) {
        return false;
      }

      // Reject [Removed] articles
      if (title.includes('[Removed]')) {
        return false;
      }

      const titleLower = title.toLowerCase();
      const sourceLower = source?.toLowerCase() || '';

      // Reject if title equals or contains source name
      if (sourceLower && (titleLower === sourceLower || titleLower.includes(sourceLower))) {
        return false;
      }

      // Reject if title looks like a domain (any .com, .org, .net, etc.)
      if (/\.(com|org|net|io|co|uk|de|fr|news|tech|ie|in)$/i.test(title)) {
        return false;
      }

      // Reject if title is too short to be a real headline
      if (title.split(/\s+/).length < 3) {
        return false;
      }

      return true;
    };

    // Filter and collect valid articles for each category
    const validByCategory: Record<string, any[]> = {};
    for (const cat of categoryKeys) {
      const catArticles = analysis.enrichedArticles.filter(a => a.category === cat);
      const valid = catArticles.filter(isValidArticle);
      validByCategory[cat] = valid.slice(0, 5);
    }

    // Log AFTER filtering counts
    console.log("[NewsService] Articles by category AFTER filter:");
    let totalValid = 0;
    for (const cat of categoryKeys) {
      console.log(`  - ${cat}: ${validByCategory[cat].length}`);
      totalValid += validByCategory[cat].length;
    }
    console.log(`[NewsService] Total valid articles: ${totalValid}`);

    // Convert new analysis format to old NewsDay format
    const legacyDay = {
      date: analysis.date,
      content: {
        briefing: analysis.briefing.executiveSummary,
        ai_compute_infra: validByCategory['ai_compute_infra'].map(mapArticle),
        fintech_regtech: validByCategory['fintech_regtech'].map(mapArticle),
        rpa_enterprise_ai: validByCategory['rpa_enterprise_ai'].map(mapArticle),
        semi_supply_chain: validByCategory['semiconductor'].map(mapArticle),
        cybersecurity: validByCategory['cybersecurity'].map(mapArticle),
        geopolitics: validByCategory['geopolitics'].map(mapArticle),
      }
    };

    // Log sample headlines for debugging
    console.log("[NewsService] Sample headlines being saved:");
    for (const cat of categoryKeys) {
      const articles = validByCategory[cat];
      if (articles.length > 0) {
        console.log(`  ${cat}: "${articles[0].title?.substring(0, 60)}..."`);
      }
    }

    // Upsert by date
    const index = feed.findIndex(d => d.date === analysis.date);
    if (index !== -1) feed[index] = legacyDay;
    else feed.unshift(legacyDay);

    await fs.writeFile(newsFeedPath, JSON.stringify(feed.slice(0, 365), null, 2));
    console.log(`[NewsService] Legacy feed updated for ${analysis.date}`);
  } catch (error) {
    console.error("[NewsService] Failed to update legacy feed:", error);
  }
}

/**
 * Backward compatibility exports
 */
export async function getLatestMarketIntelligence() {
  const date = new Date().toISOString().split('T')[0];
  const briefing = storage.getBriefing(date);
  return {
    analysis: briefing,
    sentimentHistory: [] // To be implemented via storage lookup
  };
}

export async function getMarketTerminalData(days: number = 7) {
  // Logic to pull from storage
  return {
    analyses: [],
    sentimentHistory: [],
    categoryNames: {
      ai_compute_infra: "AI Compute & Infra",
      fintech_regtech: "FinTech & RegTech",
      rpa_enterprise_ai: "RPA & Enterprise AI",
      semiconductor: "Semiconductor Supply Chain",
      cybersecurity: "Cybersecurity",
      geopolitics: "Geopolitics",
    }
  };
}

// These are still used by routes.ts but will be migrated to intelligence routes
export async function getHistoricalAnalysis(days: number) { return []; }
export async function getSentimentHistory(days: number) { return []; }
