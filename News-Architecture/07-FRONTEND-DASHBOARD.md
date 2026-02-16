# Frontend Dashboard Specification

**Document:** UI/UX design for the Market Intelligence Dashboard
**Version:** 1.0
**Philosophy:** Explainability First - "White Box vs Black Box"

---

## Design Principles

### 1. Explainability
Every AI-generated insight must answer: **"Why?"**
- Why is this trending?
- Why is the impact score high?
- Why is sentiment negative?

### 2. Progressive Disclosure
- **Level 1:** Executive summary (quick glance)
- **Level 2:** Key metrics and trends (1-minute read)
- **Level 3:** Full analysis and raw data (deep dive)

### 3. Action-Oriented
Every insight should suggest what the user might do with it.

---

## Page Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MARKET INTELLIGENCE DASHBOARD                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    EXECUTIVE SUMMARY                                │ │
│  │  [Gemini-generated daily briefing - 250-350 words]                 │ │
│  │                                                                     │ │
│  │  Generated: 2024-01-15 08:00 UTC  |  Source: AI Analysis           │ │
│  │                                        [👍 Helpful] [👎 Not useful] │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │   GPR INDEX         │  │  MARKET SENTIMENT   │  │  TOP IMPACT    │ │
│  │   ┌───────────┐    │  │  ┌───────────┐      │  │  ┌───────────┐  │ │
│  │   │    58     │    │  │  │   +24     │      │  │  │    87     │  │ │
│  │   │ ELEVATED  │    │  │  │  BULLISH  │      │  │  │ CRITICAL  │  │ │
│  │   └───────────┘    │  │  └───────────┘      │  │  └───────────┘  │ │
│  │   ▲ +8% vs 7d      │  │  ▲ +12 vs 7d        │  │  Fed Rate News  │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      TRENDING TOPICS                                │ │
│  │                                                                     │ │
│  │  [NVIDIA Earnings]  [Fed Rate Decision]  [China Sanctions]        │ │
│  │       14 articles        8 articles          12 articles           │ │
│  │       +0.72 sent.       -0.34 sent.         -0.67 sent.           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌───────────────────────────────┐  ┌────────────────────────────────┐ │
│  │    SENTIMENT TRENDS (7d)      │  │     GPR INDEX (30d)            │ │
│  │    [Line chart]               │  │     [Area chart]               │ │
│  └───────────────────────────────┘  └────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    LIVE FEED (by Impact)                           │ │
│  │                                                                     │ │
│  │  87 │ Fed signals rate pause amid inflation concerns      | 2h ago │ │
│  │  82 │ NVIDIA reports record Q4 earnings                   | 4h ago │ │
│  │  78 │ China announces retaliatory tariffs                 | 6h ago │ │
│  │  ...                                                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Executive Summary Card

```typescript
interface ExecutiveSummaryProps {
  briefing: string;
  generatedAt: string;
  source: 'gemini' | 'local-fallback';
  cacheHit: boolean;
}
```

**Features:**
- Markdown rendering for formatting
- "Generated at" timestamp
- Source indicator (AI vs fallback)
- Feedback buttons

**Styling:**
```css
.executive-summary {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-left: 4px solid #0f3460;
  padding: 24px;
  border-radius: 8px;
}
```

---

### 2. GPR Index Gauge

```typescript
interface GPRGaugeProps {
  current: number;           // 0-100
  trend: 'rising' | 'falling' | 'stable';
  percentChange7d: number;
  topKeywords: string[];
}
```

**Visual Design:**
```
        LOW        MODERATE      ELEVATED       HIGH
    ════════════════════════════════════════════════
    0         25         50    ●    75        100
                              58
                           ELEVATED
```

**Color Mapping:**
| Range | Color | Label |
|-------|-------|-------|
| 0-25 | Green (#22c55e) | Low |
| 25-50 | Yellow (#eab308) | Moderate |
| 50-75 | Orange (#f97316) | Elevated |
| 75-100 | Red (#ef4444) | High |

**Click Action:** Opens GPR detail modal with keyword breakdown

---

### 3. Market Sentiment Indicator

```typescript
interface SentimentIndicatorProps {
  overall: number;           // -100 to +100
  trend: 'bullish' | 'bearish' | 'neutral';
  change7d: number;
  byCategory: Record<ArticleCategory, number>;
}
```

**Visual Design:**
```
       BEARISH          NEUTRAL          BULLISH
    ════════════════════════════════════════════════
    -100       -50          0    ●    +50       +100
                                +24
                             BULLISH
```

**Hover Action:** Shows category breakdown tooltip

---

### 4. Trending Topics Section

```typescript
interface TrendingTopicProps {
  cluster: ArticleCluster;
  rank: number;
}
```

**Card Design:**
```
┌──────────────────────────────────────┐
│  #1  NVIDIA Earnings Beat            │
│                                      │
│  📰 14 articles  |  📈 +0.72 sent.  │
│  🏷️ AI, GPU, earnings, datacenter   │
│                                      │
│  "Why trending?"                     │
│  → 14 sources reported in 6 hours   │
│  → Sentiment strongly positive       │
│  → High source credibility (Reuters) │
│                                      │
│  [View Articles]  [📋 Details]      │
└──────────────────────────────────────┘
```

**Explainability Section (collapsed by default):**
Shows exactly WHY this topic is trending with raw data.

---

### 5. Sentiment Trends Chart

```typescript
interface SentimentChartProps {
  data: Array<{
    date: string;
    overall: number;
    byCategory: Record<ArticleCategory, number>;
  }>;
  dateRange: '7d' | '14d' | '30d';
}
```

**Chart Specs:**
- Type: Multi-line chart (Recharts)
- X-axis: Dates
- Y-axis: Sentiment (-100 to +100)
- Lines: One per category + overall
- Colors: Category-coded

```typescript
const CATEGORY_COLORS = {
  ai_compute_infra: '#8b5cf6',      // Purple
  fintech_regtech: '#06b6d4',       // Cyan
  semiconductor: '#f59e0b',          // Amber
  cybersecurity: '#ef4444',          // Red
  geopolitics: '#64748b',            // Slate
  rpa_enterprise_ai: '#22c55e',      // Green
};
```

---

### 6. GPR History Chart

```typescript
interface GPRChartProps {
  data: GPRDataPoint[];
  dateRange: '7d' | '30d' | '90d';
}
```

**Chart Specs:**
- Type: Area chart with gradient fill
- X-axis: Dates
- Y-axis: GPR Score (0-100)
- Color zones: Green → Yellow → Orange → Red
- Hover: Shows keyword breakdown for that day

---

### 7. Live Feed (Impact-Sorted)

```typescript
interface LiveFeedProps {
  articles: EnrichedArticle[];
  sortBy: 'impact' | 'date' | 'sentiment';
  filters: {
    categories: ArticleCategory[];
    minImpact: number;
    dateRange: string;
  };
}
```

**Row Design:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 87 │ 🔴 │ Fed signals rate pause amid inflation concerns    │ Reuters │ 2h │
│    │    │ Sentiment: -34  |  GPR: sanctions, fed           │         │    │
│    │    │                                          [👍][👎]│         │    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Columns:**
1. Impact score (color-coded badge)
2. Sentiment indicator (🟢/🟡/🔴)
3. Headline (clickable → full article)
4. Source name
5. Time ago
6. Feedback buttons

---

## "Why" Feature (Explainability)

### Article Explanation Modal

When user clicks "Why?" on any article:

```
┌─────────────────────────────────────────────────────────────────┐
│  WHY IS THIS ARTICLE RANKED #3?                          [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "Fed signals rate pause amid inflation concerns"               │
│                                                                  │
│  IMPACT SCORE: 87/100 (Critical)                                │
│  ═══════════════════════════════════════════════════════════   │
│                                                                  │
│  BREAKDOWN:                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Factor              │ Raw Value │ Weight │ Contribution │   │
│  ├─────────────────────┼───────────┼────────┼──────────────┤   │
│  │ Sentiment Magnitude │ 65        │ ×0.4   │ 26 points    │   │
│  │ Cluster Size        │ 12 arts   │ ×0.3   │ 18 points    │   │
│  │ Source (Reuters)    │ 1.3       │ ×0.2   │ 20 points    │   │
│  │ Recency (2h ago)    │ 0.95      │ ×0.1   │ 9.5 points   │   │
│  ├─────────────────────┼───────────┼────────┼──────────────┤   │
│  │ TOTAL               │           │        │ 87 points    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  WHY HIGH IMPACT?                                               │
│  • 12 sources reported this story (major coverage)              │
│  • Reuters is a Tier 1 source (high credibility)                │
│  • Sentiment is strongly negative (-65)                         │
│  • Published 2 hours ago (breaking news)                        │
│                                                                  │
│  RELATED ARTICLES IN CLUSTER:                                   │
│  • "Fed Chair hints at policy shift" - Bloomberg                │
│  • "Markets react to Fed signals" - CNBC                        │
│  • [+10 more]                                                   │
│                                                                  │
│  [View Full Article]                      [This seems wrong 🤔] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mobile Responsiveness

### Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Desktop (>1024px) | Full dashboard, 3-column metrics |
| Tablet (768-1024px) | 2-column metrics, stacked charts |
| Mobile (<768px) | Single column, collapsible sections |

### Mobile Priority Order

1. Executive Summary (always visible)
2. GPR + Sentiment gauges (side by side)
3. Top 3 Trending Topics
4. Live Feed (scrollable)
5. Charts (tap to expand)

---

## Dark Mode (Default)

```typescript
const darkTheme = {
  background: {
    primary: '#0a0a0f',
    secondary: '#12121a',
    card: '#1a1a2e',
  },
  text: {
    primary: '#ffffff',
    secondary: '#a1a1aa',
    muted: '#71717a',
  },
  accent: {
    primary: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  border: '#27272a',
};
```

---

## Loading States

### Skeleton Loading

```
┌─────────────────────────────────────────────────────────────────┐
│  ████████████████████████████████████                           │
│  ████████████████████████████████████████████████████          │
│  ██████████████████████████████████████████                     │
│  ████████████████████████████████████████████████████████████  │
│  ███████████████████████████████                                │
└─────────────────────────────────────────────────────────────────┘
```

### Progress Indicators

```typescript
interface LoadingState {
  stage: 'fetching' | 'enriching' | 'clustering' | 'synthesizing';
  progress: number;  // 0-100
  message: string;
}

// Example messages:
// "Fetching latest articles..." (25%)
// "Analyzing sentiment..." (50%)
// "Identifying trends..." (75%)
// "Generating insights..." (90%)
```

---

## Error States

### API Failure

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  Unable to generate AI briefing                             │
│                                                                  │
│  Showing local analysis instead.                                │
│  AI features will be restored when service recovers.            │
│                                                                  │
│  [Retry]  [Use Local Analysis]                                  │
└─────────────────────────────────────────────────────────────────┘
```

### No Data

```
┌─────────────────────────────────────────────────────────────────┐
│  📭  No news articles for today yet                             │
│                                                                  │
│  Check back in a few hours or trigger a manual refresh.         │
│                                                                  │
│  [Refresh Now]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Accessibility

### ARIA Labels

```typescript
// GPR Gauge
<div
  role="meter"
  aria-valuenow={58}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Geopolitical Risk Index: 58 out of 100, Elevated"
>
```

### Keyboard Navigation

- Tab through all interactive elements
- Enter/Space to activate
- Escape to close modals
- Arrow keys for feed navigation

### Screen Reader

- All charts have text alternatives
- Impact scores read as "Impact: 87 out of 100, Critical"
- Sentiment read as "Sentiment: Positive, plus 72"

---

## Tech Stack

```typescript
// Frontend
- React 18+ with TypeScript
- Recharts for visualizations
- Tailwind CSS for styling
- Framer Motion for animations
- React Query for data fetching

// Components
- shadcn/ui base components
- Custom chart components
- Responsive grid system
```

---

## Implementation Priority

### Phase 1: Core Dashboard
1. Executive Summary card
2. GPR + Sentiment gauges
3. Live Feed with impact sorting

### Phase 2: Visualizations
1. Sentiment trend chart
2. GPR history chart
3. Category breakdown

### Phase 3: Explainability
1. "Why" modal for articles
2. Cluster detail view
3. Impact breakdown

### Phase 4: Polish
1. Mobile optimization
2. Loading states
3. Error handling
4. Accessibility audit
