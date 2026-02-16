# Geopolitical Risk Index (GPR)

**Document:** Implementation specification for the GPR metric
**Version:** 1.0
**Reference:** Caldara and Iacoviello GPR Index methodology

---

## Overview

The Geopolitical Risk Index is a hand-coded metric that visualizes global anxiety levels based on news coverage of geopolitical events.

### What It Measures
- Frequency of "fear keywords" in news headlines
- Trends in geopolitical tension over time
- Correlation between news sentiment and global risk

### Why It Matters
- Leading indicator for market volatility
- Quantifies "risk-off" sentiment
- Objective measure vs. subjective feelings

---

## The GPR Formula

```
GPR_daily = (Σ keyword_matches / total_articles) × 100 × normalization_factor
```

### Components

1. **Keyword Matches:** Count of articles containing fear keywords
2. **Total Articles:** All articles processed that day
3. **Normalization Factor:** Scaling to 0-100 range based on historical data

---

## Fear Keyword Dictionary

### Category: Military Conflict
```typescript
const MILITARY_KEYWORDS = [
  'war', 'warfare', 'military', 'troops', 'army', 'navy',
  'missile', 'nuclear', 'invasion', 'attack', 'airstrike',
  'bombing', 'casualties', 'combat', 'conflict', 'battle',
  'defense', 'weapon', 'drone strike', 'escalation'
];
```

### Category: Economic Warfare
```typescript
const ECONOMIC_KEYWORDS = [
  'sanctions', 'embargo', 'tariff', 'trade war', 'blacklist',
  'export ban', 'import duty', 'economic warfare', 'blockade',
  'currency manipulation', 'capital controls', 'asset freeze',
  'trade restrictions', 'retaliatory tariffs'
];
```

### Category: Political Instability
```typescript
const POLITICAL_KEYWORDS = [
  'coup', 'overthrow', 'regime change', 'civil unrest',
  'protest', 'riot', 'martial law', 'emergency powers',
  'authoritarian', 'dictatorship', 'political crisis',
  'impeachment', 'assassination', 'uprising'
];
```

### Category: Terrorism & Security
```typescript
const SECURITY_KEYWORDS = [
  'terrorism', 'terrorist', 'extremist', 'attack',
  'bombing', 'hostage', 'kidnapping', 'assassination',
  'insurgent', 'militia', 'radicalization', 'threat'
];
```

### Category: Diplomatic Tensions
```typescript
const DIPLOMATIC_KEYWORDS = [
  'diplomatic crisis', 'expel diplomats', 'recall ambassador',
  'break relations', 'condemn', 'ultimatum', 'denounce',
  'retaliate', 'provocation', 'hostile', 'adversary',
  'confrontation', 'standoff', 'brinkmanship'
];
```

### Category: Regional Hotspots
```typescript
const REGIONAL_KEYWORDS = [
  'taiwan strait', 'south china sea', 'north korea',
  'ukraine', 'crimea', 'gaza', 'west bank', 'iran nuclear',
  'syria', 'yemen', 'kashmir', 'arctic dispute'
];
```

---

## Keyword Weighting

Not all keywords carry equal weight. A "nuclear" mention is more significant than a "protest."

### Weight Tiers

| Tier | Weight | Keywords |
|------|--------|----------|
| Critical (3.0) | nuclear, invasion, war declaration, missile strike |
| High (2.0) | sanctions, military deployment, coup, terrorism |
| Medium (1.5) | tariff, trade war, diplomatic crisis, protests |
| Standard (1.0) | All other fear keywords |

### Weighted Formula

```
GPR_daily = Σ(keyword_count × keyword_weight) / total_articles × 100
```

---

## Implementation

### Data Structure

```typescript
interface GPRKeyword {
  term: string;
  category: 'military' | 'economic' | 'political' | 'security' | 'diplomatic' | 'regional';
  weight: number;
  aliases: string[];  // Alternative spellings/phrases
}

interface GPRDataPoint {
  date: string;
  score: number;                          // 0-100
  keywordCounts: Record<string, number>;  // { 'sanctions': 5, 'tariff': 3 }
  topKeywords: string[];                  // Top 5 keywords for the day
  articleCount: number;                   // Total articles analyzed
  matchedArticles: number;                // Articles with at least 1 keyword
}

interface GPRIndex {
  current: number;                        // Today's GPR score
  trend: 'rising' | 'falling' | 'stable';
  percentChange7d: number;                // 7-day change
  percentChange30d: number;               // 30-day change
  history: GPRDataPoint[];                // Historical data
  alerts: GPRAlert[];                     // Significant changes
}

interface GPRAlert {
  date: string;
  type: 'spike' | 'drop' | 'sustained_high';
  message: string;
  score: number;
}
```

### Calculation Logic

```typescript
function calculateDailyGPR(articles: EnrichedArticle[]): GPRDataPoint {
  const keywordCounts: Record<string, number> = {};
  let totalWeight = 0;
  let matchedArticles = 0;

  for (const article of articles) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    let articleMatched = false;

    for (const keyword of ALL_GPR_KEYWORDS) {
      const matches = countMatches(text, keyword.term, keyword.aliases);
      if (matches > 0) {
        keywordCounts[keyword.term] = (keywordCounts[keyword.term] || 0) + matches;
        totalWeight += matches * keyword.weight;
        articleMatched = true;
      }
    }

    if (articleMatched) matchedArticles++;
  }

  // Normalize to 0-100 scale
  // Baseline: ~5% of articles typically have fear keywords
  const rawScore = (totalWeight / articles.length) * 100;
  const normalizedScore = Math.min(100, rawScore * NORMALIZATION_FACTOR);

  return {
    date: new Date().toISOString().split('T')[0],
    score: Math.round(normalizedScore),
    keywordCounts,
    topKeywords: getTopKeywords(keywordCounts, 5),
    articleCount: articles.length,
    matchedArticles
  };
}
```

---

## Trend Analysis

### 7-Day Moving Average

```typescript
function calculate7DayTrend(history: GPRDataPoint[]): {
  average: number;
  trend: 'rising' | 'falling' | 'stable';
  percentChange: number;
} {
  const recent7 = history.slice(-7);
  const previous7 = history.slice(-14, -7);

  const recentAvg = recent7.reduce((sum, d) => sum + d.score, 0) / recent7.length;
  const previousAvg = previous7.reduce((sum, d) => sum + d.score, 0) / previous7.length;

  const percentChange = ((recentAvg - previousAvg) / previousAvg) * 100;

  let trend: 'rising' | 'falling' | 'stable';
  if (percentChange > 10) trend = 'rising';
  else if (percentChange < -10) trend = 'falling';
  else trend = 'stable';

  return { average: recentAvg, trend, percentChange };
}
```

### Alert Thresholds

| Condition | Alert Type | Threshold |
|-----------|------------|-----------|
| Single day spike | spike | Score > 70 AND previous day < 50 |
| Rapid drop | drop | Score drops > 30% in 24 hours |
| Sustained high | sustained_high | 7-day average > 60 |

---

## Visualization Specification

### Line Chart: GPR Over Time

```
Y-Axis: GPR Score (0-100)
X-Axis: Date (last 30 days default)
Colors:
  - Score 0-30: Green (Low Risk)
  - Score 30-50: Yellow (Moderate Risk)
  - Score 50-70: Orange (Elevated Risk)
  - Score 70-100: Red (High Risk)

Features:
  - 7-day moving average line (dashed)
  - Click on point to see keywords for that day
  - Hover for exact values
```

### Risk Gauge

```
┌─────────────────────────────────────┐
│         GEOPOLITICAL RISK           │
│                                     │
│    ┌───────────────────────┐       │
│    │         62            │       │
│    │      ELEVATED         │       │
│    └───────────────────────┘       │
│                                     │
│  LOW ─────────────●───────── HIGH  │
│   0     25     50    75    100     │
│                                     │
│  ▲ +8% vs last week                │
│  Top: sanctions, tariff, military   │
└─────────────────────────────────────┘
```

### Keyword Cloud

Display top 10 keywords sized by frequency:
- Larger text = more mentions
- Color = keyword category
- Click to filter articles by keyword

---

## Historical Calibration

### Baseline Establishment

To normalize the GPR score, we need historical baselines:

1. **Calm Period Baseline:** GPR during stable times (~20-30)
2. **Crisis Period Reference:** GPR during known crises (~70-90)
3. **Average Expected:** Normal news cycle (~35-45)

### Example Historical Events

| Event | Expected GPR | Keywords |
|-------|--------------|----------|
| Russia-Ukraine (Feb 2022) | 85-95 | invasion, war, sanctions, nuclear |
| US-China Trade War (2019) | 60-70 | tariff, trade war, sanctions |
| COVID Market Crash (Mar 2020) | 50-60 | crisis, emergency, shutdown |
| Normal News Day | 25-35 | scattered mentions |

### Normalization Factor

```typescript
// Calibrated so that:
// - Typical day = 30-40 GPR
// - Minor tension = 50-60 GPR
// - Major crisis = 70-90 GPR
const NORMALIZATION_FACTOR = 2.5;
```

---

## API Endpoints

```typescript
// Get current GPR with history
GET /api/gpr
Response: {
  current: number,
  trend: string,
  percentChange7d: number,
  history: GPRDataPoint[]  // Last 30 days
}

// Get GPR for specific date range
GET /api/gpr/history?from=2024-01-01&to=2024-01-31
Response: {
  dataPoints: GPRDataPoint[]
}

// Get keyword breakdown for a date
GET /api/gpr/:date/keywords
Response: {
  date: string,
  keywordCounts: Record<string, number>,
  articles: Article[]  // Articles that matched
}
```

---

## Integration with Other Metrics

### GPR + Sentiment Correlation

```
When GPR High + Sentiment Negative = Strong Risk-Off Signal
When GPR High + Sentiment Positive = Market may be pricing in resolution
When GPR Low + Sentiment Negative = Non-geopolitical concerns
```

### GPR in Daily Briefing

Include GPR summary in the executive briefing:
```
"Geopolitical Risk Index: 58 (Elevated, +12% week-over-week)
Key drivers: Ongoing sanctions discussions, Taiwan Strait activity
Implication: Expect continued volatility in defense and energy sectors"
```

---

## Limitations & Disclaimers

1. **Keyword-based limitations:** Sarcasm, context, and negation not fully captured
2. **Source bias:** GPR reflects media coverage, not actual risk
3. **Lag indicator:** News reports after events occur
4. **English-only:** Currently only analyzes English-language sources
5. **Not financial advice:** GPR is informational only

---

## Future Enhancements

1. **NLP Improvements**
   - Use NER to identify countries/actors
   - Sentiment-aware keyword detection
   - Context window analysis

2. **Multi-language Support**
   - Translate non-English headlines
   - Add international news sources

3. **Predictive Features**
   - Correlation with VIX
   - Lead/lag analysis with market movements

4. **Sub-indices**
   - Regional GPR (Asia, Europe, Middle East)
   - Category GPR (Military, Economic, Political)
