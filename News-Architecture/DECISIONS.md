# Market Intelligence Platform - Design Decisions

## Architecture Decisions

### Local-first NLP (FinBERT via transformers.js)
**Why**: Cost, latency, privacy. No API keys needed for core sentiment.
**Tradeoff**: Lower accuracy than GPT-4 but fast and predictable.

### SQLite over Postgres
**Why**: Single-user portfolio project. Zero infrastructure overhead.
**Tradeoff**: No concurrent writes, but not needed for this use case.

### Greedy single-pass clustering
**Why**: Implementation simplicity in JS. HDBSCAN would be better but harder to implement.
**Tradeoff**: Less accurate cluster boundaries, but good enough for ~100 articles/day.

### Finnhub over Yahoo Finance
**Why**: Reliable free-tier API with proper documentation.
**Tradeoff**: Rate limited (60 calls/min on free tier).

### Hash-based idempotence
**Why**: Prevents duplicate API calls. SHA-256 of input → cache lookup before any API call.
**Tradeoff**: Cache invalidation is manual (content must change to trigger new call).

### Grid search for weight optimization
**Why**: Deterministic, no local minima for small parameter space (~100 combos).
**Tradeoff**: Doesn't scale well, but 4 parameters × 4 options each is fine.

### Rule-based "Today's Signal"
**Why**: Speed, determinism, testability. Complements Gemini's probabilistic executive summary.
**Tradeoff**: Less nuanced than LLM-generated signals.

### AND-based narrative matching
**Why**: OR-based matching (entity OR keyword) produced too many false positives.
**Fix**: Require entity overlap >= 2 AND keyword overlap >= 2, plus category match and sentiment consistency.

### Thread lifecycle management
**Why**: Threads accumulated indefinitely, creating noise.
**Fix**: 14-day max age, 5-day inactive = resolved. Resolved threads shown separately in UI.

## Technology Stack

| Component | Choice | Rationale |
|---|---|---|
| Backend | Express + TypeScript | Existing portfolio stack |
| Database | SQLite (better-sqlite3) | Zero config, embedded |
| NLP | FinBERT (transformers.js) | Local, fast, free |
| AI Summary | Gemini Pro | Best free-tier LLM |
| Market Data | Finnhub API | Reliable, documented |
| Charts | Recharts | React-native, lightweight |
| Icons | Lucide React | Clean, consistent |
| Email | Resend | Simple API |
