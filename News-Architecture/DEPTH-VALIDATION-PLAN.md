# Market Intelligence Platform: Depth & Validation Plan

**Purpose:** Concrete, copy-paste-ready instructions for Claude Code
**Philosophy:** Stop adding features. Make existing features provably good.
**Author:** External review based on all 18 architecture docs + implementation log

---

## What This Plan Does NOT Do

- ❌ Add new features
- ❌ Create new pipeline stages
- ❌ Add new npm dependencies (unless strictly needed)

## What This Plan DOES

- ✅ Makes the Hindsight Validator actually tune your Impact Score weights
- ✅ Adds a weekly accuracy scorecard visible on the live site
- ✅ Fixes Narrative Threading so it doesn't create garbage threads
- ✅ Adds a "Today's Signal" component that answers "so what?"
- ✅ Consolidates 18 docs into 3 useful ones
- ✅ Adds pipeline health monitoring so you know when things break silently
- ✅ Makes the dashboard tell a story instead of showing disconnected widgets

---

## TASK 1: Impact Score Weight Optimizer (The Big One)

**Why:** Your Impact Score formula uses hardcoded weights (0.4, 0.3, 0.2, 0.1) that were guessed. You already have the Hindsight Validator with Pearson/Spearman correlation. USE IT to find the best weights.

**What to build:** A grid search that tests different weight combinations and finds which one best correlates with next-day market returns.

### File: `server/intelligence/validation/weight-optimizer.ts`

```
PURPOSE:
- Take the last 30-60 days of enriched articles + market data
- For each weight combination (grid search), recalculate daily aggregate impact scores
- Correlate each combination's daily scores against next-day SPY returns
- Return the combination with highest Pearson correlation
- Store the winning weights in SQLite for the pipeline to use

GRID SEARCH SPACE (keep it small, ~100 combos):
- sentiment_weight: [0.2, 0.3, 0.4, 0.5]
- cluster_weight:   [0.15, 0.2, 0.3, 0.4]
- source_weight:    [0.1, 0.15, 0.2, 0.25]
- recency_weight:   [0.05, 0.1, 0.15, 0.2]
- Constraint: all weights must sum to 1.0 (skip combos that don't)

ALGORITHM:
1. Get all enriched_articles for the last N days from SQLite
2. Get market_data for same period (already cached from Finnhub)
3. For each valid weight combination:
   a. Recalculate impact score for every article using these weights
   b. Aggregate daily: average impact-weighted sentiment per day
   c. Align with next-day market returns (same logic as correlation.ts)
   d. Compute Pearson correlation
4. Rank all combinations by |Pearson correlation|
5. Return top 5 combinations with their correlations
6. Save best weights to a new SQLite table: optimized_weights

SCHEMA:
CREATE TABLE IF NOT EXISTS optimized_weights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sentiment_weight REAL NOT NULL,
  cluster_weight REAL NOT NULL,
  source_weight REAL NOT NULL,
  recency_weight REAL NOT NULL,
  pearson_correlation REAL NOT NULL,
  spearman_correlation REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

LOGGING: [WeightOptimizer] prefix
PATTERN: Singleton export, same as other modules
FALLBACK: If insufficient data (<14 days), return default weights with a message
```

### File: `server/intelligence/enrichment/impact.ts` (MODIFY)

```
CHANGE:
- Instead of hardcoded weights { sentiment: 0.4, cluster: 0.3, source: 0.2, recency: 0.1 }
- On startup, check optimized_weights table for most recent entry
- If found and less than 7 days old, use those weights
- If not found, use defaults
- Log which weights are being used: "[Impact] Using optimized weights (r=0.34)" or "[Impact] Using default weights (no optimization data)"
```

### API Endpoint

```
GET /api/intelligence/optimize-weights?days=30
- Triggers the grid search
- Returns top 5 weight combinations with correlations
- Expensive operation, should be rate-limited (max once per day)

GET /api/intelligence/current-weights
- Returns the currently active weights (optimized or default)
- Include the correlation that justified them
```

### Frontend: Add to HindsightValidator.tsx (MODIFY)

```
ADD to the existing HindsightValidator component:
- A new section below the scatter plot: "Weight Optimization"
- Show current weights in a simple table
- "Optimize Weights" button that calls /api/intelligence/optimize-weights
- Show results: "Best weights found: sentiment=0.3, cluster=0.4, source=0.2, recency=0.1 (r=0.41)"
- Show comparison: "Default weights correlation: 0.34 → Optimized: 0.41 (+20%)"
```

### References
- Grid search for hyperparameter optimization: standard ML practice
  - https://scikit-learn.org/stable/modules/grid_search.html (concept, not the library)
- The FinDPO paper shows sentiment weight optimization improving Sharpe from 1.2 to 2.0
  - https://arxiv.org/abs/2507.18417
- Sentiment indicator weight optimization for trading strategies
  - https://journals.sagepub.com/doi/10.1177/21582440251369559

---

## TASK 2: Weekly Accuracy Scorecard (Public Accountability)

**Why:** This is what separates your project from every other sentiment dashboard. Nobody else publicly shows their prediction accuracy. Even 55% is impressive if you're transparent about it.

### File: `server/intelligence/validation/scorecard.ts`

```
PURPOSE:
Generate a weekly accuracy report that summarizes:
- How many high-impact stories we flagged
- Direction accuracy (did positive sentiment predict positive returns?)
- GPR spike accuracy (did GPR spikes precede drawdowns?)
- Best/worst performing category

LOGIC:
1. Every Sunday night (or on-demand), calculate for the past 7 days:
   a. Total articles processed
   b. Total clusters formed
   c. Direction accuracy from backtest data (already in backtest_results)
   d. Count of anomaly alerts triggered vs actual significant moves
   e. GPR correlation for the week
2. Store in SQLite table: weekly_scorecards

SCHEMA:
CREATE TABLE IF NOT EXISTS weekly_scorecards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  articles_processed INTEGER,
  clusters_formed INTEGER,
  direction_accuracy REAL,          -- % correct direction predictions
  pearson_correlation REAL,
  high_impact_stories INTEGER,      -- stories with impact > 70
  gpr_avg REAL,
  anomalies_detected INTEGER,
  best_category TEXT,               -- category with highest accuracy
  worst_category TEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start)
);

API:
GET /api/intelligence/scorecard           -- latest scorecard
GET /api/intelligence/scorecard/history   -- all scorecards (for trend)
```

### File: `client/src/components/intelligence/WeeklyScorecard.tsx` (NEW)

```
DESIGN:
- Small, compact card that sits at the TOP of the MarketTerminal page
- Always visible (not collapsible)
- Shows: "Week of Feb 10-16: Predicted 63% of market moves correctly | 142 articles | 18 clusters | GPR avg: 45"
- If accuracy > 60%: green accent
- If accuracy 50-60%: yellow accent  
- If accuracy < 50%: red accent (honest about it!)
- Click to expand: shows category breakdown, best/worst predictions
- Link to full Hindsight Validator for details

IMPORTANT: This component should be ABOVE the executive summary.
It's the first thing visitors see. It says "we measure ourselves."
```

### Integration in MarketTerminal.tsx (MODIFY)

```
Add <WeeklyScorecard /> as the first component rendered, before the executive summary.
Fetch from /api/intelligence/scorecard on mount.
If no scorecard exists yet, show a muted message: "Accuracy tracking begins after 7 days of data collection."
```

---

## TASK 3: Fix Narrative Threading

**Why:** Current matching logic (2+ shared entities OR 3+ shared keywords) creates false threads. "Tesla" appears in EV articles, Musk articles, and energy articles — those aren't the same story.

### File: `server/intelligence/clustering/narrative.ts` (MODIFY)

```
CURRENT PROBLEM:
- Entity overlap alone is too loose
- "Tesla" + "China" matches trade war articles AND Tesla Shanghai factory articles
- No semantic similarity check between cluster topics

FIXES:

1. REQUIRE BOTH entity overlap AND keyword overlap (change OR to AND):
   - Old: entityOverlap >= 2 OR keywordOverlap >= 3
   - New: entityOverlap >= 2 AND keywordOverlap >= 2
   
2. ADD category match requirement:
   - Clusters must share at least 1 category to be linked
   - A geopolitics cluster should not thread with a semiconductor cluster
     just because both mention "China"

3. ADD sentiment direction consistency check:
   - If cluster A has sentiment +0.5 and cluster B has sentiment -0.7,
     they're probably different stories about the same entity
   - Only link if sentiment is in the same direction (both positive or both negative)
     OR if tracking escalation (sentiment shifting negative is a valid thread)
   - Threshold: allow linking if sentiment difference < 0.8 on the -1 to 1 scale

4. ADD a minimum thread quality score:
   - threadScore = (entityOverlap * 3) + (keywordOverlap * 2) + (categoryMatch * 2)
   - Only create thread if threadScore >= 10 (currently no minimum)

5. LIMIT thread duration:
   - Max thread age: 14 days (currently 7 days lookback but no max)
   - If a thread hasn't had a new cluster in 5 days, mark it as "resolved"

6. ADD thread title improvement:
   - Current: "Developing: keyword1, keyword2, keyword3" (useless)
   - New: Use the MOST RECENT cluster's topic as the thread title
   - Append " (X days developing)" suffix
   - Example: "Semiconductor Export Controls (7 days developing)"

IMPLEMENTATION:
- Modify the buildThreads() method
- Update the matching logic in the inner loop
- Add a 'status' field to NarrativeThread: 'active' | 'resolved'
- Update the SQLite schema to include status column:
  ALTER TABLE narrative_threads ADD COLUMN status TEXT DEFAULT 'active';
- Update the API to filter by status (default: active only)
```

### File: `client/src/components/intelligence/NarrativeTimeline.tsx` (MODIFY)

```
CHANGES:
- Show resolved threads in a collapsed "Recent Resolved" section (grayed out)
- Active threads get the escalation indicator
- Add article count per thread: "12 articles across 4 days"
- If no active threads, show "No developing stories detected" (current behavior is fine)
```

---

## TASK 4: "Today's Signal" Component

**Why:** The dashboard shows data but doesn't answer "what should I pay attention to?" This single component synthesizes ALL signals into one actionable statement.

### File: `server/intelligence/synthesis/signal.ts` (NEW)

```
PURPOSE:
Generate ONE sentence that combines:
- Highest impact cluster
- GPR level and trend
- Any anomaly alerts
- Entity with biggest sentiment shift

LOGIC (rule-based, no LLM needed):

function generateTodaySignal(briefing, gprData, anomalies, entityData):

  // 1. Start with the most impactful story
  topCluster = briefing.topClusters[0]
  signal = ""
  
  // 2. Check for anomaly alerts (highest priority signal)
  if anomalies.length > 0:
    anomaly = anomalies[0]
    signal = `Unusual ${anomaly.category} coverage (${anomaly.message})`
    
  // 3. Check for GPR spike
  else if gprData.current > 60 AND gprData.trend === 'rising':
    signal = `Geopolitical risk elevated at ${gprData.current} and rising`
    
  // 4. Default to top cluster
  else:
    sentiment = topCluster.aggregateSentiment > 0 ? 'positive' : 'negative'
    signal = `${topCluster.topic} driving ${sentiment} sentiment across ${topCluster.articleCount} sources`

  // 5. Add action implication
  if gprData.current > 60:
    signal += " — monitor risk-sensitive positions"
  else if topCluster.aggregateSentiment > 0.5:
    signal += " — momentum signals positive"
  else if topCluster.aggregateSentiment < -0.5:
    signal += " — defensive positioning may be warranted"
  else:
    signal += " — mixed signals, no strong directional bias"

  return {
    signal: signal,
    confidence: determineConfidence(anomalies, gprData, topCluster),
    generatedAt: new Date().toISOString()
  }

CONFIDENCE LEVELS:
- 'high': anomaly detected + GPR spike + strong sentiment (multiple confirming signals)
- 'medium': any 2 of the above
- 'low': only 1 signal or mixed signals

API:
GET /api/intelligence/signal
- Returns { signal: string, confidence: 'high'|'medium'|'low', generatedAt: string }
- Should be fast (all data already cached from pipeline run)
```

### File: `client/src/components/intelligence/TodaySignal.tsx` (NEW)

```
DESIGN:
- Full-width banner at the top of the dashboard (below WeeklyScorecard, above Executive Summary)
- Single sentence in large text (18-20px)
- Left border color indicates confidence:
  - High: red/orange border (pay attention)
  - Medium: yellow border
  - Low: gray border (business as usual)
- Small "Confidence: High" badge
- Subtle pulse animation if confidence is 'high'
- No expand/collapse — just the signal sentence and confidence

EXAMPLE RENDERS:
"Unusual AI & Compute coverage (3.2x normal) with negative sentiment shift — monitor risk-sensitive positions"
[Red left border] [Confidence: High]

"Federal Reserve policy driving negative sentiment across 14 sources — defensive positioning may be warranted"  
[Yellow left border] [Confidence: Medium]

"Markets showing mixed signals across categories — no strong directional bias"
[Gray left border] [Confidence: Low]
```

---

## TASK 5: Pipeline Health Monitor

**Why:** You have 11 features wrapped in try/catch blocks. If entity tracking silently fails for 2 weeks, you'd never know. Add observability.

### File: `server/intelligence/core/health.ts` (NEW)

```
PURPOSE:
Track the success/failure of each pipeline step on every run.

SCHEMA:
CREATE TABLE IF NOT EXISTS pipeline_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  step TEXT NOT NULL,              -- 'ingestion' | 'enrichment' | 'clustering' | 'synthesis' | 'gpr' | 'entity_tracking' | 'anomaly' | 'narrative'
  status TEXT NOT NULL,            -- 'success' | 'failure' | 'skipped'
  duration_ms INTEGER,
  article_count INTEGER,           -- how many articles this step processed
  error_message TEXT,
  metadata TEXT,                   -- JSON: any step-specific metrics
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_health_date ON pipeline_health(date);

CLASS: PipelineHealthMonitor
  - startStep(stepName): records start time
  - endStep(stepName, status, metadata?): records end time, calculates duration, saves to SQLite
  - getHealth(days=7): returns health summary per step
  - getFailures(days=7): returns only failures

API:
GET /api/intelligence/health
Returns:
{
  "lastRun": "2026-02-20T08:00:00Z",
  "steps": {
    "ingestion": { "status": "success", "duration_ms": 12400, "articles": 87 },
    "enrichment": { "status": "success", "duration_ms": 3200, "articles": 87 },
    "clustering": { "status": "success", "duration_ms": 1800, "clusters": 8 },
    "synthesis": { "status": "success", "duration_ms": 4500 },
    "gpr": { "status": "success", "duration_ms": 45 },
    "entity_tracking": { "status": "failure", "error": "NER model not loaded" },
    "anomaly": { "status": "success", "duration_ms": 12 },
    "narrative": { "status": "success", "duration_ms": 230 }
  },
  "failureRate7d": 0.03,  // 3% of steps failed in last 7 days
  "avgDuration": 22185     // ms for full pipeline
}
```

### Integration in `server/intelligence/core/pipeline.ts` (MODIFY)

```
CHANGE:
- Import PipelineHealthMonitor
- Wrap each existing try/catch block with health.startStep() and health.endStep()
- This is additive — don't change any existing logic, just add timing/tracking

EXAMPLE:
// Before:
try {
    entityTracker.trackEntities(enrichedArticles, date);
} catch (err) {
    console.error('[Pipeline] Entity tracking failed (non-fatal):', err.message);
    errors.push(`Entity tracking: ${err.message}`);
}

// After:
health.startStep('entity_tracking');
try {
    entityTracker.trackEntities(enrichedArticles, date);
    health.endStep('entity_tracking', 'success', { entities: enrichedArticles.length });
} catch (err) {
    console.error('[Pipeline] Entity tracking failed (non-fatal):', err.message);
    errors.push(`Entity tracking: ${err.message}`);
    health.endStep('entity_tracking', 'failure', { error: err.message });
}
```

### Frontend: Small health indicator (OPTIONAL)

```
Add a tiny status dot in the MarketTerminal header:
- Green dot: all steps succeeded on last run
- Yellow dot: some steps failed
- Red dot: critical steps (ingestion, enrichment, clustering) failed
- Hover/click: shows the health breakdown

This is optional but useful. If skipped, the API endpoint alone is valuable.
```

---

## TASK 6: Consolidate Documentation

**Why:** 18 docs is unmanageable. Consolidate into 3.

### File: `News-Architecture/ARCHITECTURE.md` (NEW — replaces docs 00, 01, 02, 05)

```
CONTENT:
1. Architecture Overview (from 00-MASTER-PLAN)
   - Pipeline diagram
   - Four-layer overview
   - Directory structure
2. Data Flow (from 02-PIPELINE-ARCHITECTURE)
   - Provider interface
   - Article schemas (Raw → Enriched → Cluster → Briefing)
   - Storage architecture (SQLite schema)
   - Error handling table
3. Caching Strategy (from 05-CACHING-IDEMPOTENCE)
   - Hash-based idempotence (brief, not 5 pages)
   - TTL configuration table
   - Cache layers summary

TARGET LENGTH: ~400 lines (currently these 4 docs are ~1200 lines combined)
CUT: Remove all code examples that duplicate the actual source code.
Keep only the schemas, interfaces, and diagrams.
```

### File: `News-Architecture/FEATURES.md` (NEW — replaces docs 03, 04, 06, 09, 10, 12-18)

```
CONTENT:
For each feature, ONE section with:
- What it does (2-3 sentences)
- Key files
- API endpoints
- Current status (working / partially working / needs improvement)

FEATURES TO DOCUMENT:
1. Impact Score Algorithm (from 03) — note that weights are now optimizable
2. Geopolitical Risk Index (from 04)
3. Evaluation Hooks / Feedback (from 06)
4. Hindsight Validator (from 12)
5. Entity Sentiment Tracker (from 13)
6. Anomaly Detection & Confidence (from 14)
7. Semantic Embeddings (from 15)
8. GDELT Provider (from 16)
9. Narrative Threading (from 17) — note the fixes from Task 3
10. Export & Sharing (from 18)
11. Weekly Scorecard (new from Task 2)
12. Today's Signal (new from Task 4)
13. Pipeline Health Monitor (new from Task 5)

TARGET LENGTH: ~300 lines. Each feature gets ~20 lines max.
```

### File: `News-Architecture/DECISIONS.md` (NEW — this is the interview doc)

```
CONTENT:
A log of key technical decisions and WHY they were made.

DECISIONS TO DOCUMENT:

1. Why local-first (FinBERT via transformers.js instead of OpenAI API)?
   - Cost: $0 vs ~$50/month at scale
   - Latency: 16ms local vs 200-500ms API
   - Privacy: No data leaves the server
   - Trade-off: Slightly lower accuracy than GPT-4, but 90%+ is sufficient

2. Why SQLite instead of Postgres?
   - Single-user portfolio project, no concurrent writes needed
   - Zero infrastructure (no database server to maintain)
   - better-sqlite3 is synchronous = simpler code
   - Trade-off: Can't scale to multiple users without migration

3. Why greedy single-pass clustering instead of HDBSCAN?
   - HDBSCAN requires Python or complex JS port
   - Cosine similarity + threshold gives ~80% of the quality
   - Fallback to TF-IDF if embeddings fail
   - Trade-off: May miss some clusters that density-based would find

4. Why Finnhub over Yahoo Finance for backtesting?
   - Yahoo Finance API is unofficial and breaks frequently
   - Finnhub free tier: 60 calls/min (generous)
   - Official npm package and REST API
   - Trade-off: Only covers US markets (SPY)

5. Why hash-based idempotence instead of time-based caching?
   - Time-based: stale data if news changes, wasted calls if news doesn't
   - Hash-based: only calls API when input actually changes
   - Saves ~70% of Gemini API calls in practice

6. Why semantic embeddings over TF-IDF for clustering?
   - TF-IDF misses synonyms ("oil prices" ≠ "energy sector")
   - all-MiniLM-L6-v2 is only 80MB quantized
   - Already had @xenova/transformers installed for BERT sentiment
   - Research: BERT embeddings achieve near-perfect clustering scores
     (https://www.sciencedirect.com/science/article/pii/S2666307424000482)

7. Why validate with Pearson AND Spearman correlation?
   - Pearson measures linear relationship (sensitive to outliers)
   - Spearman measures rank relationship (robust to outliers)
   - Financial data has fat tails → Spearman often more reliable
   - Reporting both is academic best practice

8. Why grid search for weight optimization instead of gradient descent?
   - Only 4 weights with ~100 valid combinations
   - Grid search is exhaustive and deterministic
   - No risk of local minima
   - Trade-off: Wouldn't scale if we had 20+ parameters

9. Why rule-based "Today's Signal" instead of LLM-generated?
   - Deterministic: same inputs always produce same output
   - Fast: no API call needed
   - Testable: can unit test signal generation
   - The executive summary already uses Gemini for free-form analysis

10. Why 3 data sources (NewsAPI + RSS + GDELT)?
    - NewsAPI: Best for US breaking news, but limited free tier
    - RSS: Reliable tech sources, unlimited
    - GDELT: Global coverage, 100+ languages, free
    - Cross-source confidence scoring requires diverse sources

TARGET LENGTH: ~200 lines. Each decision gets 8-12 lines.
```

### Delete or Archive Old Docs

```
MOVE these to News-Architecture/archive/:
- 00-MASTER-PLAN.md
- 01-CURRENT-STATE-ANALYSIS.md
- 02-PIPELINE-ARCHITECTURE.md
- 03-IMPACT-SCORE-ALGORITHM.md
- 04-GEOPOLITICAL-RISK-INDEX.md
- 05-CACHING-IDEMPOTENCE.md
- 06-EVALUATION-HOOKS.md
- 07-FRONTEND-DASHBOARD.md
- 08-IMPLEMENTATION-ROADMAP.md
- 09-VISUALIZATION-IMPROVEMENTS.md
- 10-ANALYST-RECOMMENDATIONS.md
- 11-NEXT-PHASE-ROADMAP.md
- 12-HINDSIGHT-VALIDATOR.md
- 13-ENTITY-SENTIMENT-TRACKER.md
- 14-ANOMALY-CONFIDENCE.md
- 15-SEMANTIC-EMBEDDINGS.md
- 16-GDELT-PROVIDER.md
- 17-NARRATIVE-THREADING.md
- 18-EXPORT-SHARING.md

Keep IMPLEMENTATION-LOG.md in the root (update it with new tasks).
```

---

## TASK 7: Dashboard Layout Reorder

**Why:** The current layout buries the most important information. Reorder for progressive disclosure.

### File: `client/src/pages/MarketTerminal.tsx` (MODIFY) or wherever the main dashboard layout lives

```
NEW COMPONENT ORDER (top to bottom):

1. <WeeklyScorecard />              ← NEW (Task 2) — "We predicted 63% of moves this week"
2. <TodaySignal />                  ← NEW (Task 4) — One sentence: what matters today
3. <AnomalyBanner />                ← EXISTING (move to position 3, was wherever)
4. Executive Summary                ← EXISTING (Gemini briefing)
5. Key Metrics Row (GPR + Sentiment + Top Impact) ← EXISTING
6. <IntelligenceDashboard />        ← EXISTING (pie chart, bar chart, topics)
7. <EntityTimeline />               ← EXISTING (entity cards + sparklines)
8. <NarrativeTimeline />            ← EXISTING (developing stories)
9. <HindsightValidator />           ← EXISTING (scatter plot, now with weight optimizer)
10. <ExportBriefing />              ← EXISTING (PDF/Email buttons)

REMOVE FROM DEFAULT VIEW (move to a separate /market-terminal/advanced route or tab):
- Nothing for now. But if the page feels too long, collapse sections 7-9 behind
  an "Advanced Analytics" expand button.

The key insight: the top 3 components (Scorecard, Signal, Anomaly) should load
instantly and give the user everything they need in 5 seconds. Everything below
is for drilling deeper.
```

---

## EXECUTION ORDER

```
Task 1: Weight Optimizer        ← Most technical depth, biggest interview impact
Task 5: Pipeline Health         ← Quick win, adds observability
Task 3: Fix Narrative Threading ← Quick fix, removes a broken feature's bad output
Task 4: Today's Signal          ← Quick frontend win, high visual impact
Task 2: Weekly Scorecard        ← Depends on backtest data accumulating
Task 7: Dashboard Reorder       ← Do after Tasks 2+4 create the new components  
Task 6: Consolidate Docs        ← Do last, after all code changes are stable
```

---

## FEATURES TO CONSIDER REMOVING

If after implementing the above, the dashboard still feels cluttered:

1. **CausalFlowGraph / CausalIntelligence** — Already replaced by IntelligenceDashboard. Delete the legacy files entirely. They're dead code.

2. **Export to Email** — Unless you actually use this, the Resend integration adds complexity for little portfolio value. Keep PDF export, cut email.

3. **Feedback System** — Nice in theory, but in a portfolio project only YOU use it. Consider simplifying to just thumbs up/down (no correction modals, no export to HuggingFace). The full system is over-engineered for a single-user tool.

---

## WHAT TO TELL INTERVIEWERS AFTER THIS

**Before:**
> "I built a news aggregation platform with sentiment analysis, clustering, and a GPR index."

**After:**
> "I built an intelligence platform that processes 100+ sources daily, clusters by semantic similarity, and backtests its own predictions. I used grid search to optimize the impact scoring weights — improving prediction correlation from 0.34 to 0.41. Our weekly scorecard shows 62% direction accuracy against S&P 500 returns, publicly visible on the live site. The system has full pipeline health monitoring and I can tell you exactly which components succeed or fail on every run."

That answer demonstrates: ML engineering, statistical validation, self-criticism, observability, and product thinking.

---

## REFERENCE LINKS

### For Weight Optimization
- Grid search concept: https://scikit-learn.org/stable/modules/grid_search.html
- FinDPO weight optimization for trading: https://arxiv.org/abs/2507.18417
- Sentiment weight optimization study: https://journals.sagepub.com/doi/10.1177/21582440251369559

### For Backtesting Methodology
- LLM Sentiment + DRL backtesting: https://arxiv.org/html/2507.09739v1
- Sentiment in trading implementation guide: https://medium.com/funny-ai-quant/sentiment-analysis-in-trading-an-in-depth-guide-to-implementation-b212a1df8391
- Financial forecasting deep learning review: https://www.sciencedirect.com/science/article/pii/S1059056025008822

### For Semantic Clustering
- BERT embeddings clustering paper: https://www.sciencedirect.com/science/article/pii/S2666307424000482
- Transformers.js (already installed): https://huggingface.co/docs/transformers.js/en/index
- all-MiniLM-L6-v2 model: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2

### For Pipeline Monitoring
- Node.js observability patterns: structured logging + health endpoints is standard practice
- No external dependency needed — just SQLite + timestamps
