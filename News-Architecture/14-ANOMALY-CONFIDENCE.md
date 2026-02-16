# Anomaly Detection & Cross-Source Confidence

**Document:** Technical specification for Volume Anomaly Detection (Phase 4B) and Cross-Source Confidence Scoring (Phase 4A)
**Status:** Implemented (2026-02-14)
**Philosophy:** Two "quick wins" that add meaningful intelligence with minimal code. Alert when something unusual is happening, and tell the user how trustworthy a story is.

---

## Part 1: Volume Anomaly Detection

### Overview

Detects unusual spikes in article volume per category using Z-score analysis against a 7-day rolling mean. When a topic has significantly more coverage than normal, it's flagged as an anomaly.

**Example alert:** "3.2x normal coverage on AI & Compute" - meaning there are 3.2 times more articles about AI today than the 7-day average.

### How It Works

```
Daily Pipeline Run
       │
       ▼
Count articles per category
       │
       ▼
Save to daily_volume table
       │
       ▼
For each category:
  ├── Get last 7 days of volume history
  ├── Calculate rolling mean and standard deviation
  ├── Compute Z-score: (today - mean) / stddev
  └── If Z-score > 2.0 → ANOMALY ALERT
       │
       ▼
Cache anomalies for API access
```

### Z-Score Explained (Plain English)

A Z-score measures how far today's value is from the "normal" average:
- **Z = 0:** Exactly average
- **Z = 1:** Slightly above average (not unusual)
- **Z = 2:** Significantly above average (anomaly threshold)
- **Z = 3:** Extremely above average (rare event)

We trigger alerts at Z > 2.0, meaning the category has more than 2 standard deviations above its 7-day mean. Statistically, this happens by chance only ~2.3% of the time.

### Files

| File | Purpose |
|------|---------|
| `server/intelligence/metrics/anomaly.ts` | Z-score detection engine |
| `client/src/components/intelligence/AnomalyBanner.tsx` | Amber alert banner on dashboard |

### Backend Module (`anomaly.ts`)

**`detectAnomalies(articles, date)`:**
1. Count articles per category from enriched articles
2. Save daily volume to `daily_volume` SQLite table
3. For each category with at least 3 days of history:
   - Calculate 7-day rolling mean and standard deviation
   - Compute Z-score
   - If Z > 2.0 → push to anomaly alerts array
4. Cache alerts for API access via `getAnomalies()`

**Safeguards:**
- Needs at least 3 days of history for meaningful detection
- Skips if standard deviation is 0 (avoids division by zero)
- Returns multiplier: "3.2x normal coverage"

**Category Labels:**
| Internal Key | Display Label |
|-------------|---------------|
| `ai_compute_infra` | AI & Compute |
| `fintech_regtech` | FinTech & RegTech |
| `rpa_enterprise_ai` | RPA & Enterprise AI |
| `semiconductor` | Semiconductors |
| `cybersecurity` | Cybersecurity |
| `geopolitics` | Geopolitics |

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS daily_volume (
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  article_count INTEGER NOT NULL,
  PRIMARY KEY(date, category)
);
```

### Pipeline Integration

Added as step 4c in `server/intelligence/core/pipeline.ts`:

```typescript
// 4c. Anomaly Detection (Phase 3B)
try {
    anomalyDetector.detectAnomalies(enrichedArticles, date);
} catch (err: any) {
    console.error('[Pipeline] Anomaly detection failed (non-fatal):', err.message);
}
```

### API Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intelligence/anomalies` | GET | Returns current anomaly alerts |

### Frontend Component (`AnomalyBanner.tsx`)

- Amber warning banner at top of dashboard (only shown when anomalies exist)
- Dismissible with X button (per session)
- Shows each anomaly message with Z-score
- Silently fails if API not available (non-critical feature)
- Uses `AlertTriangle` icon from lucide-react
- Amber/warning styling matching existing contrarian signal design

---

## Part 2: Cross-Source Confidence Scoring

### Overview

Scores each cluster by how many independent news sources report the same story. If 5 different outlets cover the same topic, it's more trustworthy than a story from a single source.

### Confidence Tiers

| Unique Sources | Tier | Score Range | Meaning |
|---------------|------|-------------|---------|
| 4+ sources | High | 60-100 | Multiple independent confirmations |
| 2-3 sources | Medium | 30-75 | Some corroboration |
| 1 source | Low | 20 | Single source, treat with caution |

### Score Formula

```
High:   score = min(100, 60 + uniqueSources × 10)
Medium: score = 30 + uniqueSources × 15
Low:    score = 20 (fixed)
```

### Files

| File | Purpose |
|------|---------|
| `server/intelligence/clustering/confidence.ts` | Scores clusters by unique source count |

### Backend Module (`confidence.ts`)

**`scoreCluster(cluster)`:**
1. Extract all `article.source` values from the cluster
2. Normalize (lowercase, trim) and deduplicate using a `Set`
3. Count unique sources
4. Assign tier and score based on thresholds
5. Return `ClusterConfidence` object

**`scoreClusters(clusters)`:**
- Iterates all clusters, scores each one
- Returns `Map<clusterId, ClusterConfidence>`
- Logs summary: "Results: 3 high, 5 medium, 2 low"

### Clustering Pipeline Integration

Added to `server/intelligence/clustering/pipeline.ts` after clusters are formed:

```typescript
// 2b. Score source confidence per cluster
confidenceScorer.scoreClusters(clusters);
```

One additive line. No existing clustering logic was modified.

---

## Shared Types (in `server/intelligence/core/types.ts`)

```typescript
export interface AnomalyAlert {
  category: string;
  currentVolume: number;
  rollingAvg7d: number;
  standardDev: number;
  zScore: number;
  isAnomaly: boolean;
  message: string;        // "3.2x normal coverage on AI & Compute"
  date: string;
}

export interface ClusterConfidence {
  uniqueSources: number;
  sourceList: string[];
  confidenceScore: number;  // 0-100
  tier: 'high' | 'medium' | 'low';
}
```

---

## Patterns Used

- **Singleton exports:** `export const anomalyDetector`, `export const confidenceScorer`
- **Logging prefixes:** `[Anomaly]`, `[Confidence]`
- **Non-fatal in pipeline:** Both wrapped in try/catch
- **Map iteration workaround:** Uses `Array.from(map.entries())` + indexed for loop
- **Cached results:** `anomalyDetector.getAnomalies()` returns last-run results without re-computation
