# Hindsight Validator: Backtesting Sentiment Predictions

**Document:** Technical specification for the Hindsight Validator (Phase 1)
**Status:** Implemented (2026-02-14)
**Philosophy:** "Does our sentiment actually predict market moves?" - answering this with data is the difference between a dashboard and an intelligence platform.

---

## Overview

The Hindsight Validator is a backtesting system that correlates our pipeline's daily sentiment scores against actual next-day S&P 500 (SPY) market returns. It proves whether the platform's signals have real predictive value.

### Why This Matters

Every data science interviewer will ask: "Does your sentiment actually predict anything?" Before this feature, the answer was "we don't know." Now it's answered with statistical evidence: direction accuracy, Pearson correlation, and Spearman rank correlation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HINDSIGHT VALIDATOR                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  SENTIMENT   │    │  MARKET DATA │    │  CORRELATION  │  │
│  │  HISTORY     │───▶│  FETCHER     │───▶│  ENGINE       │  │
│  │  (SQLite)    │    │  (Finnhub)   │    │  (Stats)      │  │
│  └──────────────┘    └──────────────┘    └───────────────┘  │
│        │                   │                     │           │
│        ▼                   ▼                     ▼           │
│  enriched_articles    market_data          backtest_results  │
│  table (existing)     table (new)          table (new)       │
│                                                               │
│  FLOW: Sentiment history → Market data → Align → Correlate  │
└─────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `server/intelligence/validation/market-data.ts` | Finnhub API client with rate limiting + aggressive SQLite caching |
| `server/intelligence/validation/correlation.ts` | Pearson & Spearman correlation, direction accuracy, time alignment |
| `server/intelligence/validation/backtest.ts` | Orchestrator: sentiment → market → align → correlate → cache |
| `client/src/components/intelligence/HindsightValidator.tsx` | Dashboard: scatter chart, accuracy gauge, correlation stats |

---

## Backend Modules

### 1. Market Data Fetcher (`market-data.ts`)

Fetches historical daily SPY candle data from the Finnhub free API.

**Key design decisions:**
- **Rate limiting:** 1.1 seconds between API calls (well under Finnhub's 60/min free tier)
- **Aggressive caching:** Historical data doesn't change. Only fetches dates not already in SQLite.
- **Graceful degradation:** If no `FINNHUB_API_KEY` environment variable is set, returns cached data only. Never crashes the pipeline.

```
Environment variable: FINNHUB_API_KEY
API endpoint: https://finnhub.io/api/v1/stock/candle
Symbol: SPY (S&P 500 ETF)
Resolution: D (daily candles)
```

**Data flow:**
1. Check `FINNHUB_API_KEY` in environment
2. Query existing cached dates from SQLite `market_data` table
3. Fetch candle data from Finnhub for missing dates
4. Parse: timestamp → date, close price → % change from previous day
5. Save new data points to SQLite
6. Return full dataset (cached + new)

### 2. Correlation Engine (`correlation.ts`)

Zero-dependency statistical engine implementing two correlation coefficients.

**Pearson Correlation (r = -1 to +1):**
- Measures linear relationship between sentiment scores and market returns
- Formula: `r = Σ(xi - x̄)(yi - ȳ) / √[Σ(xi - x̄)² × Σ(yi - ȳ)²]`
- Sensitive to outliers

**Spearman Rank Correlation (ρ = -1 to +1):**
- Converts values to ranks first, then computes Pearson on ranks
- More robust to outliers than Pearson
- Handles ties by averaging ranks

**Direction Accuracy:**
- For each day: did positive sentiment predict positive return (and vice versa)?
- Reported as percentage: "62% of market moves predicted correctly"

**Time Alignment (Academic Standard):**
- Sentiment on date D → market return on date D+1 (next trading day)
- Weekend sentiment → Monday's return
- This follows the methodology in published financial sentiment research

**Correlation Interpretation:**
| Range | Interpretation |
|-------|---------------|
| ±0.7 to ±1.0 | Strong correlation |
| ±0.4 to ±0.7 | Moderate correlation |
| ±0.2 to ±0.4 | Weak correlation |
| 0 to ±0.2 | No meaningful correlation |

### 3. Backtest Orchestrator (`backtest.ts`)

Coordinates the full validation pipeline.

**Flow:**
1. Get sentiment history from `enriched_articles` table (aggregated daily scores)
2. Get market data from Finnhub (or cache)
3. Build date → value lookup maps
4. Align sentiment dates with next-day market returns
5. Enrich with GPR scores (GPR spike → market drop correlation)
6. Compute Pearson, Spearman, and direction accuracy
7. Cache results in `backtest_results` SQLite table
8. Return `ValidationResult`

**Minimum data requirements:**
- At least 5 days of sentiment data
- At least 5 days of market data
- At least 3 aligned data points after time alignment
- Below these thresholds → returns empty result with explanation message

---

## SQLite Schema

```sql
-- Market price data (Finnhub cache)
CREATE TABLE IF NOT EXISTS market_data (
  date TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  close REAL,
  change_pct REAL,
  volume INTEGER,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Backtest results cache
CREATE TABLE IF NOT EXISTS backtest_results (
  id TEXT PRIMARY KEY,
  period_start TEXT,
  period_end TEXT,
  sentiment_accuracy REAL,
  pearson_correlation REAL,
  spearman_correlation REAL,
  sample_size INTEGER,
  data_points TEXT,         -- JSON array of BacktestDataPoint[]
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intelligence/backtest` | GET | Returns the latest cached backtest result |
| `/api/intelligence/backtest/run?days=30` | GET | Triggers a fresh backtest over N days |
| `/api/intelligence/market-data?days=30` | GET | Returns cached market data |

---

## Frontend Component (`HindsightValidator.tsx`)

### Layout
1. **Header** with "Run Backtest" button (shows spinner while running)
2. **Metric cards** (3-column grid):
   - Direction Accuracy (e.g., "62%")
   - Pearson Correlation (e.g., "+0.34" with interpretation)
   - Sample Size (e.g., "24 trading days analyzed")
3. **Scatter plot** (Recharts `ScatterChart`):
   - X-axis: Our sentiment score
   - Y-axis: Next-day market return %
   - Green dots: Correct prediction
   - Red dots: Wrong prediction
   - Reference lines at x=0 and y=0
4. **Additional stats** (2-column grid):
   - Spearman correlation with interpretation
   - Analysis period and last run date
5. **Methodology note** explaining the approach

### Empty State
When no backtest data exists, shows an informative message explaining that:
- A Finnhub API key is needed for market data
- The user should click "Run Backtest" to start

---

## Research References

- LLM Sentiment + DRL achieved 26% annualized return, 1.2 Sharpe ratio ([arxiv](https://arxiv.org/html/2507.09739v1))
- Financial sentiment from news headlines shows statistically significant correlation with next-day returns ([Springer](https://link.springer.com/article/10.1007/s10791-025-09573-7))
- Studies using FinBERT, VADER, TextBlob on 1.86M headlines confirm predictive power ([MDPI](https://www.mdpi.com/1911-8074/18/8/412))

---

## Patterns Used

- **Singleton export:** `export const hindsightValidator = new HindsightValidator()`
- **Logging prefix:** `[Backtest]`, `[MarketData]`, `[Correlation]`
- **Graceful fallback:** API failure → cached data, insufficient data → empty result with message
- **No external stats deps:** Pearson and Spearman implemented from scratch
