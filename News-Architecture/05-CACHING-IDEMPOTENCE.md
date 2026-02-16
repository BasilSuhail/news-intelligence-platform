# Caching & Idempotence Strategy

**Document:** API safety and caching mechanisms
**Version:** 1.0
**Goal:** Never waste an API call on duplicate work

---

## The Problem: API Fatigue

### Cost Analysis

| API | Cost | Daily Limit | Waste Scenario |
|-----|------|-------------|----------------|
| Gemini | ~$0.001/1K tokens | Rate limited | Re-analyzing same clusters |
| NewsAPI | Free tier | 100/day/key | Re-fetching same articles |
| FinBERT | Free (local) | N/A | Re-processing same headlines |

### Waste Scenarios

1. **Re-run on same data:** User refreshes, pipeline runs again
2. **Partial failures:** Pipeline crashes, restarts from beginning
3. **Duplicate content:** Same story from multiple sources
4. **Time-based re-runs:** Scheduled jobs on unchanged data

---

## Solution: Hash-Based Idempotence

### Core Principle

```
BEFORE any expensive operation:
1. Generate deterministic hash of input data
2. Check if we've already processed this exact input
3. If YES → Return cached result
4. If NO → Proceed, then cache result with hash
```

### Hash Generation

```typescript
import * as crypto from 'crypto';

function generateHash(data: unknown): string {
  // Sort keys for deterministic serialization
  const serialized = JSON.stringify(data, Object.keys(data as object).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}
```

---

## Cache Layers

### Layer 1: Article Deduplication

**When:** During ingestion
**Key:** URL hash
**Purpose:** Don't store duplicate articles

```typescript
interface ArticleCache {
  // Key: hash of URL
  // Value: article ID if exists
  [urlHash: string]: string | undefined;
}

function isDuplicateArticle(url: string): boolean {
  const hash = generateHash(url);
  return articleCache.has(hash);
}
```

### Layer 2: Sentiment Cache

**When:** During enrichment
**Key:** Hash of headline text
**Purpose:** Don't re-analyze identical headlines

```typescript
interface SentimentCacheEntry {
  headline: string;
  score: number;
  confidence: number;
  cachedAt: string;
}

// Cache lookup before FinBERT call
function getCachedSentiment(headline: string): SentimentScore | null {
  const hash = generateHash(headline.toLowerCase().trim());
  const cached = sentimentCache.get(hash);

  if (cached && !isExpired(cached.cachedAt, 7 * 24 * 60 * 60 * 1000)) {
    return cached;
  }
  return null;
}
```

### Layer 3: Cluster Cache

**When:** After clustering
**Key:** Hash of article IDs in cluster
**Purpose:** Don't re-cluster unchanged article sets

```typescript
interface ClusterCacheEntry {
  articleIds: string[];
  clusters: ArticleCluster[];
  method: string;
  cachedAt: string;
}

function getCachedClusters(articleIds: string[]): ClusteringResult | null {
  const sortedIds = [...articleIds].sort();
  const hash = generateHash(sortedIds);
  return clusterCache.get(hash);
}
```

### Layer 4: Briefing Cache (CRITICAL)

**When:** Before Gemini API call
**Key:** Hash of top clusters data
**Purpose:** Never call Gemini twice for same input

```typescript
interface BriefingCacheEntry {
  inputHash: string;
  briefing: DailyBriefing;
  generatedAt: string;
  expiresAt: string;
}

async function checkBeforeGeminiCall(
  topClusters: ArticleCluster[]
): Promise<{ shouldCall: boolean; cached?: DailyBriefing }> {

  // Extract only the data that affects the output
  const relevantData = topClusters.map(c => ({
    topic: c.topic,
    articleCount: c.articleCount,
    sentiment: c.aggregateSentiment,
    keywords: c.keywords.slice(0, 5),
  }));

  const inputHash = generateHash(relevantData);

  // Check cache
  const cached = briefingCache.getByHash(inputHash);
  if (cached && !isExpired(cached.expiresAt)) {
    console.log(`✅ Cache HIT: Briefing found for hash ${inputHash}`);
    return { shouldCall: false, cached: cached.briefing };
  }

  console.log(`❌ Cache MISS: No briefing for hash ${inputHash}`);
  return { shouldCall: true };
}
```

---

## Cache Storage

### In-Memory Cache

```typescript
class InMemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    // LRU eviction
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      hash: key,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  getByHash(hash: string): T | null {
    for (const entry of this.cache.values()) {
      if (entry.hash === hash && Date.now() <= entry.expiresAt) {
        return entry.data;
      }
    }
    return null;
  }
}
```

### Persistent Cache (File-Based)

For data that should survive restarts:

```typescript
class PersistentCache<T> extends InMemoryCache<T> {
  private filePath: string;

  constructor(name: string, maxSize?: number, ttlMs?: number) {
    super(maxSize, ttlMs);
    const cacheDir = process.env.NEWS_FEED_DIR || './news-data';
    this.filePath = `${cacheDir}/${name}_cache.json`;
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const entries = JSON.parse(data);
      for (const [key, entry] of Object.entries(entries)) {
        if (entry.expiresAt > Date.now()) {
          this.cache.set(key, entry);
        }
      }
      console.log(`[Cache] Loaded ${this.cache.size} entries from ${this.filePath}`);
    } catch {
      console.log(`[Cache] No existing cache file, starting fresh`);
    }
  }

  async save(): Promise<void> {
    const entries = Object.fromEntries(this.cache);
    await fs.writeFile(this.filePath, JSON.stringify(entries, null, 2));
  }
}
```

---

## TTL Configuration

| Cache Type | TTL | Rationale |
|------------|-----|-----------|
| Article dedup | 30 days | Articles don't change |
| Sentiment | 7 days | Headlines are static |
| Clusters | 6 hours | Clusters evolve with new articles |
| Briefings | 24 hours | Daily analysis is date-specific |
| GPR data | 24 hours | Calculated once per day |

---

## Idempotence Flow

### Full Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    IDEMPOTENT PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INGESTION                                                       │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────┐            │
│  │ Fetch   │───▶│ URL Hash?    │───▶│ Skip if     │            │
│  │ Article │    │ In cache?    │    │ duplicate   │            │
│  └─────────┘    └──────────────┘    └─────────────┘            │
│                        │ NO                                      │
│                        ▼                                         │
│  ENRICHMENT           Store & Continue                          │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────┐            │
│  │ Analyze │───▶│ Headline     │───▶│ Return      │            │
│  │ Article │    │ in cache?    │    │ cached score│            │
│  └─────────┘    └──────────────┘    └─────────────┘            │
│                        │ NO                                      │
│                        ▼                                         │
│                   Run FinBERT, Cache Result                     │
│                                                                  │
│  CLUSTERING                                                      │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────┐            │
│  │ Cluster │───▶│ Article set  │───▶│ Return      │            │
│  │ Articles│    │ hash match?  │    │ cached      │            │
│  └─────────┘    └──────────────┘    └─────────────┘            │
│                        │ NO                                      │
│                        ▼                                         │
│                   Run Clustering, Cache Result                  │
│                                                                  │
│  SYNTHESIS                                                       │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────┐            │
│  │ Generate│───▶│ Cluster data │───▶│ Return      │            │
│  │ Briefing│    │ hash match?  │    │ cached      │            │
│  └─────────┘    └──────────────┘    └─────────────┘            │
│                        │ NO                                      │
│                        ▼                                         │
│               ⚠️ CALL GEMINI API ⚠️                             │
│               Cache Result with Hash                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Call Logging

Track all API calls for monitoring:

```typescript
interface APICallLog {
  timestamp: string;
  api: 'gemini' | 'newsapi' | 'rss';
  endpoint: string;
  inputHash: string;
  cacheHit: boolean;
  responseTime: number;
  success: boolean;
  error?: string;
}

const apiCallLog: APICallLog[] = [];

function logAPICall(call: APICallLog): void {
  apiCallLog.push(call);

  // Persist to file for analysis
  const logFile = `${process.env.NEWS_FEED_DIR}/api_calls.log`;
  fs.appendFile(logFile, JSON.stringify(call) + '\n');

  // Alert on high miss rate
  const recentCalls = apiCallLog.slice(-100);
  const missRate = recentCalls.filter(c => !c.cacheHit).length / recentCalls.length;
  if (missRate > 0.5) {
    console.warn(`⚠️ High cache miss rate: ${(missRate * 100).toFixed(1)}%`);
  }
}
```

---

## Cache Warming

Pre-populate cache on startup:

```typescript
async function warmCaches(): Promise<void> {
  console.log('[Cache] Warming caches...');

  // Load persistent caches from disk
  await briefingCache.load();
  await clusterCache.load();

  // Pre-compute today's date key
  const today = new Date().toISOString().split('T')[0];

  // Check if we have today's data
  const todayBriefing = briefingCache.get(today);
  if (todayBriefing) {
    console.log(`[Cache] Today's briefing already cached`);
  } else {
    console.log(`[Cache] No briefing for today, will generate on first request`);
  }

  console.log('[Cache] Warming complete');
}
```

---

## Cache Invalidation

### Manual Invalidation

```typescript
// Force refresh for a specific date
async function invalidateBriefing(date: string): Promise<void> {
  briefingCache.delete(date);
  console.log(`[Cache] Invalidated briefing for ${date}`);
}

// Clear all caches
async function clearAllCaches(): Promise<void> {
  briefingCache.clear();
  clusterCache.clear();
  sentimentCache.clear();
  await saveAllCaches();
  console.log('[Cache] All caches cleared');
}
```

### Automatic Invalidation

```typescript
// Prune expired entries periodically
setInterval(() => {
  const pruned = {
    briefings: briefingCache.prune(),
    clusters: clusterCache.prune(),
    sentiments: sentimentCache.prune(),
  };
  console.log(`[Cache] Pruned expired entries:`, pruned);
}, 60 * 60 * 1000); // Every hour
```

---

## Metrics & Monitoring

### Cache Statistics

```typescript
interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  oldestEntry: string;
  newestEntry: string;
  apiCallsSaved: number;
  estimatedSavings: string; // e.g., "$0.05"
}

function getCacheStats(): CacheStats {
  const totalRequests = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: totalRequests > 0 ? cacheHits / totalRequests : 0,
    size: briefingCache.size + clusterCache.size + sentimentCache.size,
    oldestEntry: getOldestEntry(),
    newestEntry: getNewestEntry(),
    apiCallsSaved: cacheHits,
    estimatedSavings: `$${(cacheHits * 0.001).toFixed(2)}`,
  };
}
```

### Dashboard Endpoint

```typescript
// GET /api/admin/cache/stats
app.get('/api/admin/cache/stats', (req, res) => {
  res.json({
    briefingCache: briefingCache.getStats(),
    clusterCache: clusterCache.getStats(),
    sentimentCache: sentimentCache.getStats(),
    overall: getCacheStats(),
  });
});
```

---

## Best Practices

### DO

1. ✅ Hash inputs BEFORE expensive operations
2. ✅ Use deterministic serialization (sorted keys)
3. ✅ Set appropriate TTLs per cache type
4. ✅ Log cache hits/misses for monitoring
5. ✅ Persist critical caches to disk
6. ✅ Warm caches on startup

### DON'T

1. ❌ Cache mutable data (use immutable snapshots)
2. ❌ Set TTLs too long (stale data)
3. ❌ Set TTLs too short (defeat purpose)
4. ❌ Forget to invalidate on data changes
5. ❌ Cache errors (may mask transient failures)

---

## Error Handling

### Cache Failures

```typescript
async function safeCacheGet<T>(
  cache: Cache<T>,
  key: string,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    const cached = cache.get(key);
    if (cached) return cached;
  } catch (err) {
    console.warn(`[Cache] Read failed for ${key}:`, err);
    // Continue to fallback
  }

  const result = await fallback();

  try {
    cache.set(key, result);
  } catch (err) {
    console.warn(`[Cache] Write failed for ${key}:`, err);
    // Don't fail the operation, just log
  }

  return result;
}
```
