# Impact Score Algorithm

**Document:** Technical specification for article ranking
**Version:** 1.0

---

## Problem Statement

Traditional news feeds sort by "newest first." This is suboptimal for market intelligence because:
- Breaking news may be trivial
- Major developments may come from multiple sources over time
- Source credibility varies significantly
- High-sentiment events deserve more attention

**Goal:** Rank news by "most important first," not "newest first."

---

## The Impact Score Formula

```
Impact = (|Sentiment| × W_s) + (ClusterSize × W_c) + (SourceWeight × W_w) + (Recency × W_r)
```

### Default Weights

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Sentiment Magnitude (W_s) | 0.4 | High emotional content = market-moving |
| Cluster Size (W_c) | 0.3 | Multiple sources = major story |
| Source Weight (W_w) | 0.2 | Credibility matters |
| Recency (W_r) | 0.1 | Fresh news gets slight boost |

---

## Factor 1: Sentiment Magnitude

### Definition
Absolute value of the sentiment score. High volatility (strongly positive OR strongly negative) indicates market-moving news.

### Formula
```
SentimentMagnitude = |sentiment_score| × 100
```

### Examples

| Headline | Sentiment | Magnitude |
|----------|-----------|-----------|
| "NVIDIA crushes earnings expectations" | +0.85 | 85 |
| "Major bank collapse fears spread" | -0.92 | 92 |
| "Company reports quarterly results" | +0.12 | 12 |

### Rationale
- Neutral news (sentiment ~0) is typically low-impact
- Extreme positive OR negative signals market movement
- Magnitude captures both directions equally

---

## Factor 2: Cluster Size

### Definition
Number of articles discussing the same topic. When many sources report the same story, it's likely significant.

### Formula
```
ClusterSizeScore = min(cluster_article_count / 20, 1) × 100
```

### Normalization
- 1 article = 5 points
- 5 articles = 25 points
- 10 articles = 50 points
- 20+ articles = 100 points (capped)

### Examples

| Topic | Articles | Score |
|-------|----------|-------|
| "Fed announces rate decision" | 25 | 100 |
| "Tesla delivery numbers" | 12 | 60 |
| "Small startup raises funding" | 2 | 10 |

### Rationale
- Single-source stories may be opinion or niche
- Multi-source coverage indicates broader significance
- Cap at 20 prevents mega-stories from dominating entirely

---

## Factor 3: Source Weight

### Definition
Credibility multiplier based on source reputation for financial/tech news.

### Source Tiers

**Tier 1 (Weight: 1.3)** - Premier Sources
```
Reuters, Bloomberg, Financial Times, Wall Street Journal,
Associated Press, The Economist
```

**Tier 2 (Weight: 1.1)** - Quality Tech/Business
```
TechCrunch, Ars Technica, The Verge, CNBC, BBC,
Wired, MIT Technology Review
```

**Tier 3 (Weight: 1.0)** - Standard Sources
```
Most mainstream news outlets, industry publications
```

**Tier 4 (Weight: 0.8)** - Lower Credibility
```
Unknown blogs, aggregators, content farms,
heavily biased outlets
```

### Formula
```
SourceWeightScore = (source_weight - 0.7) / 0.6 × 100
```

### Calculation Example
```
Reuters (1.3):  (1.3 - 0.7) / 0.6 × 100 = 100
TechCrunch (1.1): (1.1 - 0.7) / 0.6 × 100 = 67
Unknown (0.8): (0.8 - 0.7) / 0.6 × 100 = 17
```

### Source Weight Database

```typescript
const SOURCE_WEIGHTS: Record<string, number> = {
  // Tier 1
  'reuters': 1.3,
  'bloomberg': 1.3,
  'financial-times': 1.3,
  'the-wall-street-journal': 1.3,
  'associated-press': 1.3,
  'the-economist': 1.3,

  // Tier 2
  'techcrunch': 1.1,
  'ars-technica': 1.1,
  'the-verge': 1.1,
  'cnbc': 1.1,
  'bbc-news': 1.1,
  'wired': 1.1,

  // Tier 3 (default)
  'default': 1.0,

  // Tier 4
  'unknown': 0.8,
  'content-farm': 0.7,
};
```

---

## Factor 4: Recency (Time Decay)

### Definition
Slight boost to fresh news, with exponential decay over time.

### Formula
```
RecencyScore = e^(-λ × hours_old) × 100

Where λ = decay constant (default: 0.05)
```

### Decay Curve

| Age | Score |
|-----|-------|
| 0 hours | 100 |
| 6 hours | 74 |
| 12 hours | 55 |
| 24 hours | 30 |
| 48 hours | 9 |
| 72 hours | 3 |

### Rationale
- Breaking news should surface quickly
- But not dominate over more significant older stories
- Low weight (0.1) ensures recency is a tiebreaker, not primary factor

---

## Combined Formula Implementation

```typescript
interface ImpactFactors {
  sentimentMagnitude: number;  // 0-100
  clusterSize: number;         // 0-100
  sourceWeight: number;        // 0-100
  recency: number;             // 0-100
}

interface ImpactWeights {
  sentiment: number;   // default 0.4
  cluster: number;     // default 0.3
  source: number;      // default 0.2
  recency: number;     // default 0.1
}

function calculateImpactScore(
  factors: ImpactFactors,
  weights: ImpactWeights = { sentiment: 0.4, cluster: 0.3, source: 0.2, recency: 0.1 }
): number {
  const score =
    (factors.sentimentMagnitude * weights.sentiment) +
    (factors.clusterSize * weights.cluster) +
    (factors.sourceWeight * weights.source) +
    (factors.recency * weights.recency);

  return Math.round(Math.min(100, Math.max(0, score)));
}
```

---

## Example Calculations

### Example 1: Major Breaking News

**Article:** "Federal Reserve raises rates by 50 basis points"
- Sentiment: -0.6 → Magnitude: 60
- Cluster: 18 articles → Score: 90
- Source: Reuters → Score: 100
- Age: 2 hours → Score: 90

```
Impact = (60 × 0.4) + (90 × 0.3) + (100 × 0.2) + (90 × 0.1)
       = 24 + 27 + 20 + 9
       = 80
```

### Example 2: Minor Tech News

**Article:** "Startup raises $5M seed round"
- Sentiment: +0.3 → Magnitude: 30
- Cluster: 1 article → Score: 5
- Source: Unknown blog → Score: 17
- Age: 1 hour → Score: 95

```
Impact = (30 × 0.4) + (5 × 0.3) + (17 × 0.2) + (95 × 0.1)
       = 12 + 1.5 + 3.4 + 9.5
       = 26
```

### Example 3: Major Story, Old News

**Article:** "Historic market crash rocks Wall Street"
- Sentiment: -0.95 → Magnitude: 95
- Cluster: 30 articles → Score: 100
- Source: Bloomberg → Score: 100
- Age: 72 hours → Score: 3

```
Impact = (95 × 0.4) + (100 × 0.3) + (100 × 0.2) + (3 × 0.1)
       = 38 + 30 + 20 + 0.3
       = 88
```

---

## Weight Tuning

### Conservative Profile
For users who prefer established, verified news:
```
sentiment: 0.3, cluster: 0.4, source: 0.25, recency: 0.05
```

### Breaking News Profile
For users who want the freshest updates:
```
sentiment: 0.35, cluster: 0.25, source: 0.15, recency: 0.25
```

### Sentiment-Driven Profile
For traders watching market reactions:
```
sentiment: 0.5, cluster: 0.25, source: 0.15, recency: 0.1
```

---

## Edge Cases

### No Cluster Assigned
If article hasn't been clustered yet:
```
clusterSize = 1 (treat as single article)
```

### Unknown Source
If source not in database:
```
sourceWeight = 1.0 (default, neutral)
```

### Missing Sentiment
If sentiment analysis failed:
```
sentimentMagnitude = 50 (neutral, middle ground)
```

### Future-Dated Articles
If publishedAt is in the future (bad data):
```
recency = 100 (treat as brand new)
```

---

## Display Guidelines

### Impact Score Badges

| Score Range | Label | Color |
|-------------|-------|-------|
| 80-100 | Critical | Red |
| 60-79 | High | Orange |
| 40-59 | Medium | Yellow |
| 20-39 | Low | Gray |
| 0-19 | Minimal | Light Gray |

### Sorting Behavior
1. Primary sort: Impact Score (descending)
2. Secondary sort: Published Date (descending)
3. Tertiary sort: Source Weight (descending)

---

## Future Enhancements

1. **Machine Learning Weights**
   - Train on user engagement data
   - A/B test different weight configurations

2. **Category-Specific Weights**
   - Geopolitics may weight sentiment higher
   - Tech news may weight recency higher

3. **User Personalization**
   - Allow users to adjust weights
   - Learn from individual reading patterns

4. **Market Correlation**
   - Factor in actual market movements
   - Validate impact against price changes
