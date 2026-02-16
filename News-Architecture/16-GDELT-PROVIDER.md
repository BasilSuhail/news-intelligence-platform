# GDELT Provider: Global News at Scale

**Document:** Technical specification for GDELT Provider (Phase 4C)
**Status:** Implemented (2026-02-15)
**Philosophy:** Three independent data sources (NewsAPI + RSS + GDELT) = higher coverage, better confidence scoring, more diverse perspectives.

---

## Overview

GDELT (Global Database of Events, Language, and Tone) monitors news from virtually every country in 100+ languages, updating every 15 minutes. It's completely free with no rate limits.

### Data Source Comparison

| Feature | NewsAPI | RSS | GDELT |
|---------|---------|-----|-------|
| Coverage | US/UK focused | Curated feeds | Global, 100+ languages |
| Update frequency | Real-time | Varies by feed | Every 15 minutes |
| Rate limit | 100 requests/day (free) | None | None |
| Cost | Free tier limited | Free | Completely free |
| Best for | Breaking US news | Reliable tech sources | Global coverage |

---

## Files

| File | Purpose |
|------|---------|
| `server/intelligence/ingestion/providers/gdelt.provider.ts` | GDELT API client, extends BaseProvider |
| `server/intelligence/ingestion/collector.ts` | Updated: includes GDELT as third provider |

---

## Implementation

### GDELT API

```
Endpoint: https://api.gdeltproject.org/api/v2/doc/doc
Format: JSON (via format=json parameter)
Mode: ArtList (article listing)
Rate Limit: None (public API)
```

### Category Mapping

Each of our 6 categories maps to a GDELT search query:

| Category | GDELT Query |
|----------|-------------|
| `ai_compute_infra` | "artificial intelligence" OR "machine learning" OR "GPU" OR "data center" |
| `fintech_regtech` | "fintech" OR "digital banking" OR "cryptocurrency" OR "blockchain" |
| `rpa_enterprise_ai` | "enterprise software" OR "automation" OR "SaaS" |
| `semiconductor` | "semiconductor" OR "chip" OR "NVIDIA" OR "TSMC" OR "Intel" |
| `cybersecurity` | "cybersecurity" OR "data breach" OR "hacking" OR "ransomware" |
| `geopolitics` | "sanctions" OR "trade war" OR "NATO" OR "geopolitics" OR "military" |

All queries filtered to English (`sourcelang:eng`).

### Date Parsing

GDELT uses a proprietary date format: `YYYYMMDDHHmmss`
- Parsed into standard ISO 8601 strings
- Falls back to current time if format is invalid

### Source Formatting

Domain names are cleaned for display:
- `www.bbc.co.uk` → `BBC`
- `www.nytimes.com` → `Nytimes`
- Source tagged with `(GDELT)` suffix for cross-source confidence scoring

### Collector Integration

Added as third provider in `collector.ts`:
```typescript
this.providers = [
    new NewsAPIProvider(),
    new RSSProvider(),
    new GDELTProvider()    // NEW
];
```

The collector automatically deduplicates by URL across all providers.

---

## Patterns Used

- **Extends BaseProvider:** Same interface as NewsAPI and RSS providers
- **Singleton pattern:** Not needed (instantiated by collector)
- **Logging prefix:** `[GDELT]`
- **Polite fetching:** 500ms delay between category queries
- **15-second timeout:** `AbortSignal.timeout(15000)` prevents hanging
- **Max 25 articles per category per request** (GDELT API limit)
