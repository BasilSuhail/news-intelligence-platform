# Market Intelligence & Trend Platform - Master Plan

**Project:** Portfolio Market Intelligence Platform
**Status:** In Development
**Philosophy:** "Local-First Intelligence" - Use offline models for heavy lifting, LLMs only for high-value synthesis

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MARKET INTELLIGENCE PLATFORM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  INGESTION   │───▶│  ENRICHMENT  │───▶│  CLUSTERING  │───▶│ SYNTHESIS │ │
│  │    LAYER     │    │    LAYER     │    │    LAYER     │    │   LAYER   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘ │
│        │                   │                   │                   │        │
│        ▼                   ▼                   ▼                   ▼        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ • NewsAPI    │    │ • FinBERT    │    │ • BERTopic   │    │ • Gemini  │ │
│  │ • RSS Feeds  │    │ • Impact     │    │ • TF-IDF     │    │ • Caching │ │
│  │ • GDELT      │    │   Scoring    │    │ • K-Means    │    │ • Daily   │ │
│  │ • SEC (TBD)  │    │ • Geo Tags   │    │              │    │   Brief   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘ │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         STORAGE LAYER                                  │  │
│  │  SQLite (Primary) ←──▶ JSON Cache ←──▶ Supabase (Optional Backup)    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         FRONTEND DASHBOARD                             │  │
│  │  • Executive Summary  • Live Feed  • GPR Index  • Sentiment Charts    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase Breakdown

### Phase 1: Modular Pipeline Architecture
- Refactor monolithic `newsService.ts` into swappable components
- Create provider interfaces for data sources
- Build unified storage layer
- Implement dependency injection

### Phase 2: Impact Score Algorithm
```
Impact = (|Sentiment| × 0.4) + (ClusterSize × 0.3) + (SourceWeight × 0.2) + (Recency × 0.1)
```

### Phase 3: Feature Implementation
- **3A:** Geopolitical Risk Index (GPR) - Fear keyword tracking
- **3B:** Caching & Idempotence - Hash-based API call prevention
- **3C:** Evaluation Hooks - User feedback collection

### Phase 4: Frontend Dashboard
- Explainability features ("Why is this trending?")
- GPR visualization
- Sentiment charts
- Impact-sorted feed

---

## Reference Repositories

| Module | Repository | Purpose | Clone Location |
|--------|------------|---------|----------------|
| Sentiment | `ProsusAI/finBERT` | Local sentiment engine | `reference-repos/finBERT` |
| Clustering | `davidjosipovic/news-trend-analysis` | Topic grouping | `reference-repos/news-trend-analysis` |
| LLM Integration | `giftedunicorn/ai-news-bot` | Prompt engineering | `reference-repos/ai-news-bot` |
| Geopolitics | `akoyamp/geopolrisk-py` | GPR keyword lists | `reference-repos/geopolrisk-py` |
| Technicals | `Stock_Trend_Analyzer` | Trend logic | `reference-repos/Stock_Trend_Analyzer` |
| Technicals | `ai-market-trend-analysis` | Price overlay (optional) | `reference-repos/ai-market-trend-analysis` |

---

## Current State (Pre-Refactor)

### Existing Components
- **newsService.ts** (679 lines) - Monolithic news fetching
- **rssService.ts** - RSS feed integration
- **sentimentService.ts** - Basic local sentiment
- **marketIntelligence.ts** - Gemini-powered analysis

### Current Limitations
1. Monolithic service structure
2. No true clustering (just categories)
3. No impact scoring beyond sentiment
4. No geopolitical risk tracking
5. Reactive rate limiting
6. Frontend not wired to real data

---

## Target Directory Structure

```
server/
├── intelligence/
│   ├── core/
│   │   ├── pipeline.ts           # Main orchestration
│   │   ├── storage.ts            # Unified data layer
│   │   └── cache.ts              # Idempotent caching
│   ├── ingestion/
│   │   ├── providers/
│   │   │   ├── newsapi.provider.ts
│   │   │   ├── rss.provider.ts
│   │   │   └── gdelt.provider.ts
│   │   └── collector.ts          # Unified collector
│   ├── enrichment/
│   │   ├── sentiment.ts          # FinBERT + local
│   │   ├── impact.ts             # Impact scoring
│   │   └── geotags.ts            # Geopolitical tagging
│   ├── clustering/
│   │   ├── bertopic.ts           # Primary clustering
│   │   └── tfidf.ts              # Fallback clustering
│   ├── synthesis/
│   │   ├── gemini.ts             # LLM integration
│   │   └── briefing.ts           # Daily brief generation
│   └── metrics/
│       ├── gpr-index.ts          # Geopolitical Risk Index
│       └── evaluation.ts         # User feedback hooks
└── config/
    ├── categories.ts
    ├── sources.ts
    ├── keywords.ts               # GPR keywords
    └── sentiment-terms.ts
```

---

## Implementation Log

| Date | Phase | Action | Status |
|------|-------|--------|--------|
| 2026-01-24 | Setup | Created News-Architecture folder | ✅ |
| 2026-01-24 | Docs | Created Master Plan document | ✅ |
| 2026-01-24 | Phase 1 | Starting modular pipeline... | 🔄 |
