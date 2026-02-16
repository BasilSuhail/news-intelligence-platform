# Entity Sentiment Tracker: Bloomberg-Style Entity Timelines

**Document:** Technical specification for Entity Sentiment Timelines (Phase 3)
**Status:** Implemented (2026-02-14)
**Philosophy:** Track how sentiment around specific entities (companies, people, countries) evolves over time - the core Bloomberg Terminal news analytics feature.

---

## Overview

The Entity Sentiment Tracker aggregates sentiment per named entity per day using the NER data already extracted by the enrichment pipeline. It enables users to ask "What's the sentiment around Tesla this month?" and see a 30-day timeline.

### What This Enables

- **Before:** "100 articles analyzed today, overall sentiment is +12"
- **After:** "Tesla mentioned in 8 articles (avg +0.3), NVIDIA in 12 articles (avg -0.1), China in 15 articles (avg -0.4)"

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              ENTITY SENTIMENT TRACKER                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  NER Output           Aggregation          Visualization     │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ Article 1 │    │              │    │ Entity: Tesla     │  │
│  │ Tesla:+0.8│──▶│ Group by     │──▶│ ┌───────────────┐ │  │
│  │ Article 2 │    │ entity +     │    │ │ ~~~~~▲~~~~~/  │ │  │
│  │ Tesla:-0.2│──▶│ date →       │    │ │ 30-day chart  │ │  │
│  │ Article 3 │    │ average      │    │ └───────────────┘ │  │
│  │ Tesla:+0.5│──▶│ sentiment    │    │ Avg: +0.3         │  │
│  └──────────┘    └──────────────┘    └───────────────────┘  │
│                                                               │
│  Data source: article.entities (from NER enrichment)         │
│  Output: entity_sentiment SQLite table                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `server/intelligence/metrics/entity-tracker.ts` | Aggregates sentiment per entity per day from NER data |
| `client/src/components/intelligence/EntityTimeline.tsx` | Clickable entity cards with sparklines + expandable timeline |

---

## Backend Module (`entity-tracker.ts`)

### How It Works

Called from the main pipeline after enrichment completes. For each article with NER data:

1. **Extract entities** from `article.entities` (people, organizations, places, topics)
2. **Normalize names** (title case, filter noise, skip generic terms)
3. **Group by entity** using a `Map<string, { entityType, sentiments[] }>`
4. **Calculate average sentiment** per entity for the day
5. **Save to SQLite** `entity_sentiment` table

### Entity Normalization

The `normalizeEntity()` method filters noise:
- Skips names shorter than 2 characters
- Skips generic terms (days of week, months, pronouns)
- Applies title case for consistency ("NVIDIA" and "nvidia" → "Nvidia")

### Entity Types Tracked

| Type | Source | Examples |
|------|--------|----------|
| `person` | Compromise NER | "Elon Musk", "Janet Yellen" |
| `organization` | Compromise NER | "Tesla", "Federal Reserve" |
| `place` | Compromise NER | "China", "Wall Street" |
| `topic` | Compromise NER | "Artificial Intelligence", "Trade War" |

### Pipeline Integration

Added as step 4b in `server/intelligence/core/pipeline.ts` (after GPR calculation):

```typescript
// 4b. Entity Sentiment Tracking (Phase 2)
try {
    entityTracker.trackEntities(enrichedArticles, date);
} catch (err: any) {
    console.error('[Pipeline] Entity tracking failed (non-fatal):', err.message);
    errors.push(`Entity tracking: ${err.message}`);
}
```

Wrapped in try/catch - if entity tracking fails, the rest of the pipeline continues unaffected.

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS entity_sentiment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_type TEXT NOT NULL,      -- 'person' | 'organization' | 'place' | 'topic'
  date TEXT NOT NULL,
  avg_sentiment REAL NOT NULL,    -- Average sentiment across articles mentioning entity
  article_count INTEGER NOT NULL, -- How many articles mentioned this entity
  UNIQUE(entity, date)            -- One record per entity per day
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_entity_date ON entity_sentiment(entity, date);
CREATE INDEX IF NOT EXISTS idx_entity_name ON entity_sentiment(entity);
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intelligence/entity/:name?days=30` | GET | Sentiment timeline for a specific entity over N days |
| `/api/intelligence/entities/top?limit=10` | GET | Top entities ranked by total mention count |

### Response Examples

**GET /api/intelligence/entities/top?limit=5**
```json
[
  { "entity": "Tesla", "entityType": "organization", "totalMentions": 47, "avgSentiment": 0.12 },
  { "entity": "China", "entityType": "place", "totalMentions": 38, "avgSentiment": -0.31 },
  { "entity": "Nvidia", "entityType": "organization", "totalMentions": 35, "avgSentiment": 0.24 },
  { "entity": "Federal Reserve", "entityType": "organization", "totalMentions": 29, "avgSentiment": -0.08 },
  { "entity": "Elon Musk", "entityType": "person", "totalMentions": 22, "avgSentiment": 0.15 }
]
```

**GET /api/intelligence/entity/Tesla?days=7**
```json
[
  { "entity": "Tesla", "entityType": "organization", "date": "2026-02-08", "avgSentiment": 0.35, "articleCount": 8 },
  { "entity": "Tesla", "entityType": "organization", "date": "2026-02-09", "avgSentiment": -0.12, "articleCount": 5 },
  ...
]
```

---

## Frontend Component (`EntityTimeline.tsx`)

### Layout

1. **Header** with "Entity Sentiment Tracker" title
2. **Top entities grid** (responsive, up to 10 cards):
   - Entity name with type icon (Users/Building2/MapPin/Hash from lucide-react)
   - Total mention count
   - Average sentiment with color indicator (green/gray/red)
   - Mini sparkline (Recharts `LineChart`, 60px tall)
   - Clickable: expands to full timeline
3. **Expanded timeline** (when entity selected):
   - Full 30-day `LineChart` with date axis
   - Custom tooltip showing date, sentiment, and article count
   - Green reference line at y=0
   - Area fill: green above 0, red below

### Entity Type Icons

| Type | Icon | Color |
|------|------|-------|
| Person | `Users` | Blue |
| Organization | `Building2` | Purple |
| Place | `MapPin` | Emerald |
| Topic | `Hash` | Amber |

### Data Fetching

- On mount: fetches `/api/intelligence/entities/top?limit=10`
- On entity click: fetches `/api/intelligence/entity/:name?days=30`
- Pattern: `useState` + `useEffect` + `fetch()` (matches existing codebase)

---

## Patterns Used

- **Singleton export:** `export const entityTracker = new EntityTracker()`
- **Logging prefix:** `[EntityTracker]`
- **Non-fatal in pipeline:** Wrapped in try/catch, failure doesn't block other steps
- **Map iteration workaround:** Uses `Array.from(map.entries())` + indexed for loop (avoids TS2802 without `downlevelIteration`)
- **Noise filtering:** Entities with <2 characters or generic terms (days, months, pronouns) are skipped
