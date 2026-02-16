# Pipeline Architecture

**Document:** Technical specification for the modular pipeline
**Version:** 1.0

---

## Pipeline Overview

The Market Intelligence Platform processes news through four sequential layers:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  INGESTION  │───▶│ ENRICHMENT  │───▶│ CLUSTERING  │───▶│  SYNTHESIS  │
│    LAYER    │    │    LAYER    │    │    LAYER    │    │    LAYER    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
   Raw Articles    Enriched Articles    Clusters        Daily Briefing
```

---

## Layer 1: Ingestion Layer

### Purpose
Collect raw articles from multiple data sources into a standardized format.

### Data Providers

| Provider | Type | Rate Limit | Priority |
|----------|------|------------|----------|
| NewsAPI | REST API | 100/day per key (3 keys = 300) | Primary |
| RSS Feeds | XML/Atom | Unlimited | Secondary |
| GDELT | Bulk Export | Unlimited | Future |
| SEC Filings | EDGAR API | Rate limited | Future |

### Provider Interface

```typescript
interface DataProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  fetchArticles(options: FetchOptions): Promise<RawArticle[]>;
  getRateLimitStatus(): RateLimitStatus;
}
```

### Raw Article Schema

```typescript
interface RawArticle {
  id: string;              // Unique identifier (hash of URL)
  title: string;           // Headline
  description: string;     // Summary/snippet
  content: string | null;  // Full content if available
  url: string;             // Source URL
  source: string;          // e.g., "Reuters", "TechCrunch"
  sourceId: string;        // Provider's source ID
  publishedAt: string;     // ISO 8601 timestamp
  category: ArticleCategory;
  provider: DataProvider;  // Which provider fetched this
  imageUrl?: string;       // Thumbnail if available
}
```

### Ingestion Flow

```
1. Check rate limit status for each provider
2. Prioritize providers: RSS (free) → NewsAPI (limited)
3. Fetch articles for each category
4. Deduplicate by URL hash
5. Store in raw articles database
6. Log ingestion metrics
```

### Category Definitions

| Category | ID | Keywords/Queries |
|----------|----|--------------------|
| AI Compute & Infrastructure | `ai_compute_infra` | NVIDIA, AMD, Google AI, OpenAI, data center |
| FinTech & RegTech | `fintech_regtech` | Stripe, PayPal, cryptocurrency, SEC, banking |
| RPA & Enterprise AI | `rpa_enterprise_ai` | UiPath, Automation Anywhere, enterprise software |
| Semiconductor Supply Chain | `semiconductor` | TSMC, Intel, chip shortage, fab |
| Cybersecurity | `cybersecurity` | Breach, ransomware, zero-day, vulnerability |
| Geopolitics | `geopolitics` | Tariff, sanctions, trade war, NATO, China |

---

## Layer 2: Enrichment Layer (The "Local Brain")

### Purpose
Add intelligence to raw articles without API calls.

### Components

#### 2.1 Sentiment Analysis

**Primary: FinBERT (Local ML)**
```
Input: Article headline + description
Output: {
  score: -1 to 1,
  label: 'positive' | 'negative' | 'neutral',
  confidence: 0 to 1
}
```

**Fallback: Local Dictionary**
- 100+ financial/tech terms
- Weighted scoring
- No external dependencies

#### 2.2 Impact Scoring

See [03-IMPACT-SCORE-ALGORITHM.md](./03-IMPACT-SCORE-ALGORITHM.md) for full details.

```
Impact = (|Sentiment| × 0.4) + (ClusterSize × 0.3) + (SourceWeight × 0.2) + (Recency × 0.1)
```

#### 2.3 Geopolitical Tagging

Keyword-based extraction:
```typescript
const geoKeywords = {
  sanctions: ['sanction', 'embargo', 'blacklist'],
  trade_war: ['tariff', 'trade war', 'import duty'],
  conflict: ['war', 'invasion', 'military', 'missile'],
  diplomacy: ['summit', 'treaty', 'agreement', 'alliance'],
  // ... more categories
};
```

### Enriched Article Schema

```typescript
interface EnrichedArticle extends RawArticle {
  sentiment: {
    score: number;        // -1 to 1
    normalizedScore: number; // -100 to 100
    confidence: number;
    label: string;
    method: 'finbert' | 'local';
  };
  impactScore: number;    // 0 to 100
  geoTags: string[];      // e.g., ['sanctions', 'china']
  topics: string[];       // Extracted key topics
  clusterId?: string;     // Assigned in Layer 3
}
```

---

## Layer 3: Clustering Layer (The "Trend Engine")

### Purpose
Group similar articles to identify trending topics rather than individual news items.

### Methods

#### 3.1 Primary: BERTopic

```
Advantages:
- State-of-the-art topic modeling
- Semantic understanding
- Dynamic topic discovery

Requirements:
- Python runtime
- transformers library
- ~500MB model download

Process:
1. Generate embeddings for all headlines
2. Reduce dimensions with UMAP
3. Cluster with HDBSCAN
4. Extract topic keywords with c-TF-IDF
```

#### 3.2 Fallback: TF-IDF + K-Means

```
Advantages:
- Pure JavaScript/TypeScript
- No ML dependencies
- Fast execution

Process:
1. Tokenize headlines
2. Calculate TF-IDF vectors
3. Apply K-Means clustering
4. Extract top terms per cluster
```

#### 3.3 Minimum Viable: Keyword Clustering

```
Advantages:
- Simplest approach
- Zero dependencies
- Deterministic

Process:
1. Extract keywords from headlines
2. Group by shared keywords
3. Merge similar groups
```

### Cluster Schema

```typescript
interface ArticleCluster {
  id: string;
  topic: string;           // e.g., "NVIDIA Earnings Beat Expectations"
  keywords: string[];      // Top 5-10 keywords
  articles: EnrichedArticle[];
  aggregateSentiment: number;
  aggregateImpact: number;
  articleCount: number;
  categories: ArticleCategory[];
  dateRange: {
    earliest: string;
    latest: string;
  };
}
```

### Clustering Output

```typescript
interface ClusteringResult {
  clusters: ArticleCluster[];
  outliers: EnrichedArticle[];  // Articles that didn't fit
  method: 'bertopic' | 'tfidf-kmeans' | 'keyword';
  timestamp: string;
}
```

---

## Layer 4: Synthesis Layer (The "API Gatekeeper")

### Purpose
Generate human-readable insights from top clusters. **This is the ONLY layer that calls LLM APIs.**

### Idempotence Protocol

```
BEFORE calling Gemini:
1. Select top 3-5 clusters by impact score
2. Generate hash of cluster data
3. Check cache for existing analysis with same hash
4. IF cache hit → Return cached result
5. IF cache miss → Proceed with API call
```

See [05-CACHING-IDEMPOTENCE.md](./05-CACHING-IDEMPOTENCE.md) for full details.

### Gemini Integration

**Input to Gemini:**
```
Top Clusters (max 5):
- Cluster 1: "NVIDIA Earnings" (14 articles, sentiment: +0.7)
- Cluster 2: "Fed Rate Decision" (8 articles, sentiment: -0.3)
- ...

Request: Generate a 250-350 word executive summary for market professionals.
```

**Output:**
```typescript
interface DailyBriefing {
  date: string;
  executiveSummary: string;  // Gemini-generated
  topClusters: ArticleCluster[];
  gprIndex: GPRIndex;
  marketSentiment: MarketSentiment;
  generatedAt: string;
  cacheHash: string;
  source: 'gemini' | 'local-fallback';
}
```

### Fallback Strategy

If Gemini unavailable:
1. Generate template-based summary from cluster data
2. List top clusters with key metrics
3. Mark as `source: 'local-fallback'`

---

## Data Flow Diagram

```
                    ┌─────────────────────────────────────────────────────┐
                    │                   INGESTION                          │
                    │                                                      │
                    │  NewsAPI ──┐                                        │
                    │            ├──▶ Deduplication ──▶ Raw DB            │
                    │  RSS ──────┘                                        │
                    └─────────────────────────┬───────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────┐
                    │                   ENRICHMENT                         │
                    │                                                      │
                    │  Raw Article ──▶ FinBERT ──▶ Impact Score ──▶      │
                    │                             Geo Tags ──▶ Enriched DB│
                    └─────────────────────────┬───────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────┐
                    │                   CLUSTERING                         │
                    │                                                      │
                    │  Enriched Articles ──▶ BERTopic/TF-IDF ──▶         │
                    │                        Clusters + Outliers          │
                    └─────────────────────────┬───────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────┐
                    │                   SYNTHESIS                          │
                    │                                                      │
                    │  Top Clusters ──▶ Cache Check ──▶ Gemini? ──▶      │
                    │                                   Daily Briefing    │
                    └─────────────────────────────────────────────────────┘
```

---

## Storage Architecture

### Primary: SQLite

```sql
-- Raw articles table
CREATE TABLE raw_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE,
  source TEXT,
  published_at DATETIME,
  category TEXT,
  provider TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enriched articles table
CREATE TABLE enriched_articles (
  id TEXT PRIMARY KEY,
  raw_article_id TEXT REFERENCES raw_articles(id),
  sentiment_score REAL,
  sentiment_label TEXT,
  impact_score REAL,
  geo_tags TEXT,  -- JSON array
  topics TEXT,    -- JSON array
  cluster_id TEXT,
  enriched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clusters table
CREATE TABLE clusters (
  id TEXT PRIMARY KEY,
  date TEXT,
  topic TEXT,
  keywords TEXT,  -- JSON array
  aggregate_sentiment REAL,
  aggregate_impact REAL,
  article_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily briefings table
CREATE TABLE daily_briefings (
  date TEXT PRIMARY KEY,
  executive_summary TEXT,
  cache_hash TEXT,
  source TEXT,
  gpr_index REAL,
  market_sentiment REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Secondary: JSON Files (Backup/Docker)

```
news-data/
├── raw_articles.json
├── enriched_articles.json
├── clusters.json
├── briefings.json
├── gpr_history.json
└── cache/
    ├── briefing_cache.json
    └── sentiment_cache.json
```

---

## Error Handling

| Layer | Error Type | Handling |
|-------|------------|----------|
| Ingestion | API rate limit | Switch to next key, fallback to RSS |
| Ingestion | Network timeout | Retry with backoff, skip provider |
| Enrichment | FinBERT unavailable | Use local dictionary |
| Clustering | Not enough articles | Skip clustering, return raw list |
| Synthesis | Gemini unavailable | Use local template fallback |
| Storage | SQLite error | Fallback to JSON files |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Ingestion (100 articles) | < 30 seconds |
| Enrichment (per article) | < 100ms local, < 500ms FinBERT |
| Clustering (100 articles) | < 5 seconds |
| Synthesis (API call) | < 10 seconds |
| Full pipeline | < 2 minutes |
