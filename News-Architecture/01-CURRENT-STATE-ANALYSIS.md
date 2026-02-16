# Current State Analysis

**Date:** 2026-01-24
**Purpose:** Document existing architecture before refactoring

---

## Existing Services

### 1. newsService.ts (679 lines)
**Location:** `server/newsService.ts`

**Responsibilities (too many - violates SRP):**
- Multi-key NewsAPI management (3 keys with rotation)
- Rate limiting with 12-hour reset cycles
- Category-based news fetching (6 categories)
- 365-day retention policy
- RSS fallback integration
- Date deduplication
- Background sync

**Key Functions:**
- `getValidNewsApiKey()` - Key rotation logic
- `fetchNewsForCategory()` - Per-category fetching
- `refreshNewsFeed()` - Background sync orchestration
- `getNewsFeed()` - Read from storage

**Issues:**
- Monolithic structure
- Hard to test individual pieces
- No separation between fetching/storage/processing

---

### 2. rssService.ts
**Location:** `server/rssService.ts`

**Current RSS Sources:**
| Category | Feeds |
|----------|-------|
| AI | TechCrunch AI, Ars Technica, The Verge, SiliconANGLE |
| FinTech | PYMNTS, TechCrunch Fintech, CoinDesk |
| Enterprise AI | SiliconANGLE Cloud, ZDNet, TechCrunch Enterprise |
| Semiconductors | Wccftech, Tom's Hardware, AnandTech |
| Cybersecurity | Krebs on Security, The Hacker News, Help Net Security |
| Geopolitics | BBC World, Reuters, Foreign Policy |

**Features:**
- 10-second timeout per feed
- Custom User-Agent header
- Max 10 items per feed
- Parallel fetch per category

---

### 3. sentimentService.ts
**Location:** `server/sentimentService.ts`

**Current Capabilities:**
- Local sentiment scoring (-100 to 100 scale)
- 80+ custom financial/tech terms
- Confidence calculation
- Multi-headline aggregation
- Trending topic detection
- 7-day volatility calculation

**Limitation:** Only uses `sentiment` npm package, not FinBERT

---

### 4. marketIntelligence.ts
**Location:** `server/marketIntelligence.ts`

**Two-Phase Architecture:**
1. **Phase 1 (Local):** Always runs, no API needed
2. **Phase 2 (Gemini):** AI enhancement with 6 API keys

**AI Agents:**
- Reader Agent: Article enrichment
- Analyst Agent: Cross-category trends
- Strategist Agent: Opportunity scoring

**Caching:**
- 24-hour TTL in-memory cache
- Lost on server restart

---

## Data Flow (Current)

```
NewsAPI/RSS → newsService.ts → news_feed.json
                    ↓
            marketIntelligence.ts → Gemini API
                    ↓
            Daily Analysis → In-memory cache
                    ↓
            (Optional) Supabase backup
```

---

## Storage (Current)

### Local Files
- `news_feed.json` - 365 days of categorized articles
- `news_settings.json` - Visibility settings

### Supabase Tables (Optional)
- `news_articles` - Enriched article data
- `daily_analysis` - Briefings + reports
- `sentiment_history` - Category sentiment over time

---

## API Routes (Current)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/news` | GET | Full news feed |
| `/api/news/:date` | GET | Specific date |
| `/api/news/refresh` | POST | Trigger sync |
| `/api/market-terminal` | GET | 7+ days analyses |
| `/api/market-terminal/latest` | GET | Latest analysis |
| `/api/market-terminal/sentiment` | GET | 30+ days sentiment |
| `/api/market-terminal/history` | GET | Archive |

---

## Environment Variables

```env
# NewsAPI (3 keys)
NEWS_API_KEY=xxx
NEWS_API_KEY_2=xxx
NEWS_API_KEY_3=xxx

# Gemini (6 keys)
GEMINI_API_KEY_1=xxx
...
GEMINI_API_KEY_6=xxx

# Storage
NEWS_FEED_DIR=/app/news-data
SUPABASE_URL=xxx
SUPABASE_ANON_KEY=xxx
```

---

## What's Missing for Master Plan

| Feature | Current | Target |
|---------|---------|--------|
| Sentiment Engine | npm `sentiment` | FinBERT (local ML) |
| Clustering | None (just categories) | BERTopic/TF-IDF |
| Impact Scoring | Basic | Formula-based |
| GPR Index | None | Keyword tracking |
| Caching | In-memory (volatile) | Hash-based idempotent |
| User Feedback | None | Thumb up/down hooks |
| Explainability | None | "Why trending?" UI |
