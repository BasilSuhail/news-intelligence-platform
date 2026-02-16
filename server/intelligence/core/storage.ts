/**
 * Market Intelligence Platform - SQLite Storage Layer
 *
 * Provides persistent storage for articles, clusters, and briefings.
 * Uses better-sqlite3 for high performance and zero-configuration.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {
  RawArticle,
  EnrichedArticle,
  ArticleCluster,
  DailyBriefing,
  GPRDataPoint,
  ArticleCategory,
  GPRIndex,
  MarketDataPoint,
  ValidationResult,
  EntitySentimentPoint,
  AnomalyAlert,
  NarrativeThread
} from './types';

class IntelligenceStorage {
  private db: Database.Database;
  private cacheDir: string;

  constructor() {
    // Use same directory as newsService.ts for consistency
    this.cacheDir = process.env.NEWS_FEED_DIR || process.cwd();
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const dbPath = path.join(this.cacheDir, 'intelligence.db');
    console.log(`[Storage] Database path: ${dbPath}`);
    this.db = new Database(dbPath);

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');

    this.initializeSchema();
    console.log(`[Storage] Database initialized successfully`);
  }

  /**
   * Initialize the SQLite schema
   */
  private initializeSchema() {
    this.db.exec(`
      -- Raw articles table
      CREATE TABLE IF NOT EXISTS raw_articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        content TEXT,
        url TEXT UNIQUE,
        source TEXT,
        source_id TEXT,
        published_at TEXT,
        category TEXT,
        ticker TEXT,
        provider TEXT,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Enriched articles table
      CREATE TABLE IF NOT EXISTS enriched_articles (
        id TEXT PRIMARY KEY,
        raw_article_id TEXT REFERENCES raw_articles(id) ON DELETE CASCADE,
        sentiment_score REAL,
        sentiment_label TEXT,
        sentiment_confidence REAL,
        sentiment_method TEXT,
        impact_score REAL,
        geo_tags TEXT, -- JSON array
        topics TEXT,   -- JSON array
        cluster_id TEXT,
        enriched_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Clusters table
      CREATE TABLE IF NOT EXISTS clusters (
        id TEXT PRIMARY KEY,
        date TEXT,
        topic TEXT,
        keywords TEXT, -- JSON array
        aggregate_sentiment REAL,
        aggregate_impact REAL,
        article_count INTEGER,
        categories TEXT, -- JSON array
        earliest_date TEXT,
        latest_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Daily briefings table
      CREATE TABLE IF NOT EXISTS daily_briefings (
        date TEXT PRIMARY KEY,
        executive_summary TEXT,
        cache_hash TEXT,
        source TEXT,
        gpr_index REAL,
        market_sentiment REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- GPR Index tracking
      CREATE TABLE IF NOT EXISTS gpr_history (
        date TEXT PRIMARY KEY,
        score REAL,
        keyword_counts TEXT, -- JSON object
        top_keywords TEXT,    -- JSON array
        article_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_raw_published ON raw_articles(published_at);
      CREATE INDEX IF NOT EXISTS idx_raw_category ON raw_articles(category);
      CREATE INDEX IF NOT EXISTS idx_enriched_impact ON enriched_articles(impact_score);
      CREATE INDEX IF NOT EXISTS idx_enriched_cluster ON enriched_articles(cluster_id);

      -- Market data for backtesting (Phase 1)
      CREATE TABLE IF NOT EXISTS market_data (
        date TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        close REAL,
        change_pct REAL,
        volume INTEGER,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Backtest results (Phase 1)
      CREATE TABLE IF NOT EXISTS backtest_results (
        id TEXT PRIMARY KEY,
        period_start TEXT,
        period_end TEXT,
        sentiment_accuracy REAL,
        pearson_correlation REAL,
        spearman_correlation REAL,
        sample_size INTEGER,
        data_points TEXT, -- JSON array of BacktestDataPoint
        calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Entity sentiment tracking (Phase 2)
      CREATE TABLE IF NOT EXISTS entity_sentiment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        date TEXT NOT NULL,
        avg_sentiment REAL NOT NULL,
        article_count INTEGER NOT NULL,
        UNIQUE(entity, date)
      );
      CREATE INDEX IF NOT EXISTS idx_entity_date ON entity_sentiment(entity, date);
      CREATE INDEX IF NOT EXISTS idx_entity_name ON entity_sentiment(entity);

      -- Daily volume tracking for anomaly detection (Phase 3B)
      CREATE TABLE IF NOT EXISTS daily_volume (
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        article_count INTEGER NOT NULL,
        PRIMARY KEY(date, category)
      );

      -- Narrative threads (Phase 5)
      CREATE TABLE IF NOT EXISTS narrative_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        cluster_ids TEXT NOT NULL,       -- JSON array
        sentiment_arc TEXT NOT NULL,     -- JSON array of numbers
        entities TEXT NOT NULL,          -- JSON array
        escalation TEXT NOT NULL,        -- 'rising' | 'stable' | 'declining'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_thread_lastseen ON narrative_threads(last_seen);
    `);

    // Run migrations for existing databases that might be missing columns
    this.runMigrations();
  }

  /**
   * Run schema migrations for existing databases
   * SQLite doesn't update tables with CREATE TABLE IF NOT EXISTS,
   * so we need to manually add missing columns
   */
  private runMigrations() {
    console.log('[Storage] Checking for schema migrations...');

    // Get existing columns in raw_articles
    const columns = this.db.prepare("PRAGMA table_info(raw_articles)").all() as any[];
    const columnNames = new Set(columns.map((c: any) => c.name));

    // Add missing columns to raw_articles
    const requiredColumns = [
      { name: 'ticker', type: 'TEXT' },
      { name: 'provider', type: 'TEXT' },
      { name: 'image_url', type: 'TEXT' },
      { name: 'source_id', type: 'TEXT' }
    ];

    for (const col of requiredColumns) {
      if (!columnNames.has(col.name)) {
        console.log(`[Storage] Adding missing column: raw_articles.${col.name}`);
        try {
          this.db.exec(`ALTER TABLE raw_articles ADD COLUMN ${col.name} ${col.type}`);
        } catch (e) {
          // Column might already exist, ignore error
          console.log(`[Storage] Column ${col.name} already exists or error:`, e);
        }
      }
    }

    console.log('[Storage] Schema migrations complete');
  }

  // ===========================================================================
  // ARTICLE OPERATIONS
  // ===========================================================================

  /**
   * Save raw articles in batch
   */
  saveRawArticles(articles: RawArticle[]): void {
    const upsert = this.db.prepare(`
      INSERT INTO raw_articles (
        id, title, description, content, url, source, source_id, 
        published_at, category, ticker, provider, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        content = excluded.content
    `);

    const transaction = this.db.transaction((items: RawArticle[]) => {
      for (const article of items) {
        upsert.run(
          article.id,
          article.title,
          article.description,
          article.content,
          article.url,
          article.source,
          article.sourceId,
          article.publishedAt,
          article.category,
          article.ticker,
          article.provider,
          article.imageUrl || null
        );
      }
    });

    transaction(articles);
  }

  /**
   * Save enriched articles
   */
  saveEnrichedArticles(articles: EnrichedArticle[]): void {
    const upsert = this.db.prepare(`
      INSERT INTO enriched_articles (
        id, raw_article_id, sentiment_score, sentiment_label, 
        sentiment_confidence, sentiment_method, impact_score, 
        geo_tags, topics, cluster_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sentiment_score = excluded.sentiment_score,
        sentiment_label = excluded.sentiment_label,
        impact_score = excluded.impact_score,
        cluster_id = excluded.cluster_id
    `);

    const transaction = this.db.transaction((items: EnrichedArticle[]) => {
      for (const article of items) {
        upsert.run(
          article.id,
          article.id, // Assuming same ID as raw for now or linked
          article.sentiment.score,
          article.sentiment.label,
          article.sentiment.confidence,
          article.sentiment.method,
          article.impactScore,
          JSON.stringify(article.geoTags),
          JSON.stringify(article.topics),
          article.clusterId || null
        );
      }
    });

    transaction(articles);
  }

  /**
   * Get recently published raw articles that haven't been enriched yet
   */
  getUnenrichedArticles(limit = 100): RawArticle[] {
    const rows = this.db.prepare(`
      SELECT r.* FROM raw_articles r
      LEFT JOIN enriched_articles e ON r.id = e.raw_article_id
      WHERE e.id IS NULL
      ORDER BY r.published_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      content: row.content,
      url: row.url,
      source: row.source,
      sourceId: row.source_id,
      publishedAt: row.published_at,
      category: row.category as ArticleCategory,
      ticker: row.ticker,
      provider: row.provider as any,
      imageUrl: row.image_url
    }));
  }

  // ===========================================================================
  // CLUSTER OPERATIONS
  // ===========================================================================

  saveClusters(clusters: ArticleCluster[]): void {
    const upsert = this.db.prepare(`
      INSERT INTO clusters (
        id, date, topic, keywords, aggregate_sentiment, 
        aggregate_impact, article_count, categories, 
        earliest_date, latest_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        topic = excluded.topic,
        aggregate_sentiment = excluded.aggregate_sentiment,
        aggregate_impact = excluded.aggregate_impact,
        article_count = excluded.article_count
    `);

    const transaction = this.db.transaction((items: ArticleCluster[]) => {
      for (const cluster of items) {
        upsert.run(
          cluster.id,
          cluster.dateRange.latest.split('T')[0],
          cluster.topic,
          JSON.stringify(cluster.keywords),
          cluster.aggregateSentiment,
          cluster.aggregateImpact,
          cluster.articleCount,
          JSON.stringify(cluster.categories),
          cluster.dateRange.earliest,
          cluster.dateRange.latest
        );
      }
    });

    transaction(clusters);
  }

  // ===========================================================================
  // BRIEFING OPERATIONS
  // ===========================================================================

  saveBriefing(briefing: DailyBriefing): void {
    console.log(`[Storage] Saving briefing for ${briefing.date} (source: ${briefing.source})`);
    try {
      this.db.prepare(`
        INSERT INTO daily_briefings (
          date, executive_summary, cache_hash, source, gpr_index, market_sentiment
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          executive_summary = excluded.executive_summary,
          cache_hash = excluded.cache_hash,
          source = excluded.source
      `).run(
        briefing.date,
        briefing.executiveSummary,
        briefing.cacheHash,
        briefing.source,
        briefing.gprIndex.current,
        briefing.marketSentiment.overall
      );
      console.log(`[Storage] Briefing saved successfully for ${briefing.date}`);
    } catch (error) {
      console.error(`[Storage] Failed to save briefing for ${briefing.date}:`, error);
      throw error;
    }
  }

  getBriefing(date: string): DailyBriefing | null {
    console.log(`[Storage] Getting briefing for ${date}`);
    const row = this.db.prepare('SELECT * FROM daily_briefings WHERE date = ?').get(date) as any;
    if (!row) {
      console.log(`[Storage] No briefing found for ${date}`);
      return null;
    }
    console.log(`[Storage] Found briefing for ${date}`);

    const gprIndex = this.getGPRIndex(date);

    return {
      date: row.date,
      executiveSummary: row.executive_summary,
      topClusters: this.getClustersByDate(date),
      gprIndex,
      marketSentiment: {
        overall: row.market_sentiment,
        byCategory: {},
        trend: row.market_sentiment > 10 ? 'bullish' : row.market_sentiment < -10 ? 'bearish' : 'neutral',
        confidence: 0.8
      },
      generatedAt: row.created_at,
      cacheHash: row.cache_hash,
      source: row.source as any
    };
  }

  /**
   * Get GPR history for a range
   */
  getGPRHistory(limit = 30): GPRDataPoint[] {
    const rows = this.db.prepare('SELECT * FROM gpr_history ORDER BY date DESC LIMIT ?').all(limit) as any[];
    return rows.map(row => ({
      date: row.date,
      score: row.score,
      keywordCounts: JSON.parse(row.keyword_counts),
      topKeywords: JSON.parse(row.top_keywords),
      articleCount: row.article_count
    }));
  }

  /**
   * Get clusters for a specific date
   */
  getClustersByDate(date: string): ArticleCluster[] {
    const rows = this.db.prepare('SELECT * FROM clusters WHERE date = ? ORDER BY aggregate_impact DESC').all(date) as any[];
    return rows.map(row => ({
      id: row.id,
      topic: row.topic,
      keywords: JSON.parse(row.keywords),
      articles: this.getEnrichedArticlesByCluster(row.id),
      aggregateSentiment: row.aggregate_sentiment,
      aggregateImpact: row.aggregate_impact,
      articleCount: row.article_count,
      categories: JSON.parse(row.categories),
      dateRange: {
        earliest: row.earliest_date,
        latest: row.latest_date
      }
    }));
  }

  /**
   * Get enriched articles for a cluster
   */
  getEnrichedArticlesByCluster(clusterId: string): EnrichedArticle[] {
    const rows = this.db.prepare(`
      SELECT e.*, r.* FROM enriched_articles e
      JOIN raw_articles r ON e.raw_article_id = r.id
      WHERE e.cluster_id = ?
      ORDER BY e.impact_score DESC
    `).all(clusterId) as any[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      content: row.content,
      url: row.url,
      source: row.source,
      sourceId: row.source_id,
      publishedAt: row.published_at,
      category: row.category as ArticleCategory,
      ticker: row.ticker,
      provider: row.provider as any,
      imageUrl: row.image_url,
      sentiment: {
        score: row.sentiment_score,
        normalizedScore: Math.round(row.sentiment_score * 100),
        confidence: row.sentiment_confidence,
        label: row.sentiment_label as any,
        method: row.sentiment_method as any
      },
      impactScore: row.impact_score,
      geoTags: JSON.parse(row.geo_tags),
      topics: JSON.parse(row.topics),
      clusterId: row.cluster_id
    }));
  }

  /**
   * Get GPR Index for a date
   */
  private getGPRIndex(date: string): GPRIndex {
    const history = this.getGPRHistory(14);
    const current = history.find(h => h.date === date);

    return {
      current: current?.score || 0,
      trend: 'stable',
      percentChange7d: 0,
      history: history
    };
  }

  /**
   * Save GPR history point
   */
  saveGPRPoint(point: GPRDataPoint): void {
    this.db.prepare(`
      INSERT INTO gpr_history (date, score, keyword_counts, top_keywords, article_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        score = excluded.score,
        keyword_counts = excluded.keyword_counts,
        top_keywords = excluded.top_keywords,
        article_count = excluded.article_count
    `).run(
      point.date,
      point.score,
      JSON.stringify(point.keywordCounts),
      JSON.stringify(point.topKeywords),
      point.articleCount
    );
  }

  // ===========================================================================
  // MARKET DATA OPERATIONS (Hindsight Validator - Phase 1)
  // ===========================================================================

  /**
   * Save market data points in batch
   */
  saveMarketData(points: MarketDataPoint[]): void {
    const upsert = this.db.prepare(`
      INSERT INTO market_data (date, symbol, close, change_pct, volume)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        close = excluded.close,
        change_pct = excluded.change_pct,
        volume = excluded.volume
    `);

    const transaction = this.db.transaction((items: MarketDataPoint[]) => {
      for (const point of items) {
        upsert.run(point.date, point.symbol, point.close, point.changePct, point.volume);
      }
    });

    transaction(points);
    console.log(`[Storage] Saved ${points.length} market data points`);
  }

  /**
   * Get market data for a date range
   */
  getMarketData(days = 30): MarketDataPoint[] {
    const rows = this.db.prepare(
      'SELECT * FROM market_data ORDER BY date DESC LIMIT ?'
    ).all(days) as any[];

    return rows.map(row => ({
      date: row.date,
      symbol: row.symbol,
      close: row.close,
      changePct: row.change_pct,
      volume: row.volume
    }));
  }

  /**
   * Get market data for specific dates
   */
  getMarketDataByDates(dates: string[]): MarketDataPoint[] {
    if (dates.length === 0) return [];
    const placeholders = dates.map(() => '?').join(',');
    const rows = this.db.prepare(
      `SELECT * FROM market_data WHERE date IN (${placeholders}) ORDER BY date ASC`
    ).all(...dates) as any[];

    return rows.map(row => ({
      date: row.date,
      symbol: row.symbol,
      close: row.close,
      changePct: row.change_pct,
      volume: row.volume
    }));
  }

  /**
   * Get dates that already have market data (to avoid re-fetching)
   */
  getExistingMarketDates(): Set<string> {
    const rows = this.db.prepare('SELECT date FROM market_data').all() as any[];
    return new Set(rows.map(r => r.date));
  }

  /**
   * Save backtest result
   */
  saveBacktestResult(result: ValidationResult): void {
    this.db.prepare(`
      INSERT INTO backtest_results (id, period_start, period_end, sentiment_accuracy,
        pearson_correlation, spearman_correlation, sample_size, data_points, calculated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sentiment_accuracy = excluded.sentiment_accuracy,
        pearson_correlation = excluded.pearson_correlation,
        spearman_correlation = excluded.spearman_correlation,
        sample_size = excluded.sample_size,
        data_points = excluded.data_points,
        calculated_at = excluded.calculated_at
    `).run(
      result.id,
      result.periodStart,
      result.periodEnd,
      result.sentimentAccuracy,
      result.pearsonCorrelation,
      result.spearmanCorrelation,
      result.sampleSize,
      JSON.stringify(result.dataPoints),
      result.calculatedAt
    );
    console.log(`[Storage] Saved backtest result: ${result.id}`);
  }

  /**
   * Get the most recent backtest result
   */
  getLatestBacktest(): ValidationResult | null {
    const row = this.db.prepare(
      'SELECT * FROM backtest_results ORDER BY calculated_at DESC LIMIT 1'
    ).get() as any;

    if (!row) return null;

    return {
      id: row.id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      sentimentAccuracy: row.sentiment_accuracy,
      pearsonCorrelation: row.pearson_correlation,
      spearmanCorrelation: row.spearman_correlation,
      gprCorrelation: 0, // Calculated on-the-fly
      sampleSize: row.sample_size,
      dataPoints: JSON.parse(row.data_points),
      calculatedAt: row.calculated_at
    };
  }

  /**
   * Get daily sentiment scores for backtesting (from briefings)
   */
  getSentimentHistory(days = 30): { date: string; sentiment: number }[] {
    const rows = this.db.prepare(
      'SELECT date, market_sentiment FROM daily_briefings ORDER BY date DESC LIMIT ?'
    ).all(days) as any[];

    return rows.map(row => ({
      date: row.date,
      sentiment: row.market_sentiment
    }));
  }

  // ===========================================================================
  // ENTITY SENTIMENT OPERATIONS (Phase 2)
  // ===========================================================================

  /**
   * Save entity sentiment data in batch
   */
  saveEntitySentiment(points: EntitySentimentPoint[]): void {
    const upsert = this.db.prepare(`
      INSERT INTO entity_sentiment (entity, entity_type, date, avg_sentiment, article_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entity, date) DO UPDATE SET
        avg_sentiment = excluded.avg_sentiment,
        article_count = excluded.article_count
    `);

    const transaction = this.db.transaction((items: EntitySentimentPoint[]) => {
      for (const point of items) {
        upsert.run(point.entity, point.entityType, point.date, point.avgSentiment, point.articleCount);
      }
    });

    transaction(points);
    console.log(`[Storage] Saved ${points.length} entity sentiment points`);
  }

  /**
   * Get sentiment timeline for a specific entity
   */
  getEntityTimeline(entity: string, days = 30): EntitySentimentPoint[] {
    const rows = this.db.prepare(`
      SELECT * FROM entity_sentiment
      WHERE entity = ?
      ORDER BY date DESC LIMIT ?
    `).all(entity, days) as any[];

    return rows.map(row => ({
      entity: row.entity,
      entityType: row.entity_type,
      date: row.date,
      avgSentiment: row.avg_sentiment,
      articleCount: row.article_count
    }));
  }

  /**
   * Get top entities by total mention count
   */
  getTopEntities(limit = 10): { entity: string; entityType: string; totalMentions: number; avgSentiment: number }[] {
    const rows = this.db.prepare(`
      SELECT entity, entity_type,
        SUM(article_count) as total_mentions,
        AVG(avg_sentiment) as overall_sentiment
      FROM entity_sentiment
      GROUP BY entity
      ORDER BY total_mentions DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => ({
      entity: row.entity,
      entityType: row.entity_type,
      totalMentions: row.total_mentions,
      avgSentiment: row.overall_sentiment
    }));
  }

  // ===========================================================================
  // DAILY VOLUME / ANOMALY OPERATIONS (Phase 3B)
  // ===========================================================================

  /**
   * Save daily article volume per category
   */
  saveDailyVolume(date: string, category: string, count: number): void {
    this.db.prepare(`
      INSERT INTO daily_volume (date, category, article_count)
      VALUES (?, ?, ?)
      ON CONFLICT(date, category) DO UPDATE SET
        article_count = excluded.article_count
    `).run(date, category, count);
  }

  /**
   * Get volume history for anomaly calculation
   */
  getVolumeHistory(category: string, days = 7): { date: string; count: number }[] {
    const rows = this.db.prepare(`
      SELECT date, article_count FROM daily_volume
      WHERE category = ?
      ORDER BY date DESC LIMIT ?
    `).all(category, days) as any[];

    return rows.map(row => ({
      date: row.date,
      count: row.article_count
    }));
  }

  /**
   * Get all categories with volume data for a specific date
   */
  getDailyVolumeByDate(date: string): { category: string; count: number }[] {
    const rows = this.db.prepare(
      'SELECT category, article_count FROM daily_volume WHERE date = ?'
    ).all(date) as any[];

    return rows.map(row => ({
      category: row.category,
      count: row.article_count
    }));
  }

  // ========================================
  // NARRATIVE THREADS (Phase 5)
  // ========================================

  /**
   * Save or update narrative threads
   */
  saveNarrativeThreads(threads: NarrativeThread[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO narrative_threads
      (id, title, first_seen, last_seen, duration_days, cluster_ids, sentiment_arc, entities, escalation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const thread of threads) {
        stmt.run(
          thread.id,
          thread.title,
          thread.firstSeen,
          thread.lastSeen,
          thread.durationDays,
          JSON.stringify(thread.clusterIds),
          JSON.stringify(thread.sentimentArc),
          JSON.stringify(thread.entities),
          thread.escalation
        );
      }
    });

    transaction();
    console.log(`[Storage] Saved ${threads.length} narrative threads`);
  }

  /**
   * Get narrative threads from the last N days
   */
  getNarrativeThreads(days = 14): NarrativeThread[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const rows = this.db.prepare(
      'SELECT * FROM narrative_threads WHERE last_seen >= ? ORDER BY last_seen DESC, duration_days DESC'
    ).all(cutoffStr) as any[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      durationDays: row.duration_days,
      clusterIds: JSON.parse(row.cluster_ids || '[]'),
      sentimentArc: JSON.parse(row.sentiment_arc || '[]'),
      entities: JSON.parse(row.entities || '[]'),
      escalation: row.escalation
    }));
  }
}

export const storage = new IntelligenceStorage();
