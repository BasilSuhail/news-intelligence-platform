# Evaluation Hooks (Quality Control)

**Document:** User feedback system for continuous improvement
**Version:** 1.0
**Goal:** Build a "Golden Dataset" for future fine-tuning

---

## Overview

The evaluation hooks system allows users to provide feedback on AI-generated analysis, creating a valuable dataset for:

1. Identifying sentiment analysis errors
2. Improving impact scoring accuracy
3. Fine-tuning models on domain-specific data
4. Building portfolio talking points about ML improvement

---

## Feedback Types

### 1. Sentiment Correction

**When:** User disagrees with sentiment classification

```typescript
interface SentimentFeedback {
  id: string;
  articleId: string;
  headline: string;
  predictedSentiment: number;      // -100 to 100
  predictedLabel: string;          // 'positive' | 'negative' | 'neutral'
  userCorrection: string;          // 'positive' | 'negative' | 'neutral'
  userComment?: string;            // Optional explanation
  category: ArticleCategory;
  timestamp: string;
}
```

### 2. Impact Score Feedback

**When:** User thinks article importance is misranked

```typescript
interface ImpactFeedback {
  id: string;
  articleId: string;
  headline: string;
  predictedImpact: number;         // 0-100
  userRating: 'too_high' | 'correct' | 'too_low';
  suggestedImpact?: number;        // User's suggested score
  reason?: string;
  timestamp: string;
}
```

### 3. Cluster Feedback

**When:** User thinks articles are wrongly grouped

```typescript
interface ClusterFeedback {
  id: string;
  clusterId: string;
  clusterTopic: string;
  feedbackType: 'wrong_grouping' | 'missing_article' | 'wrong_topic';
  articleIds?: string[];           // Articles that don't belong
  suggestedTopic?: string;
  comment?: string;
  timestamp: string;
}
```

### 4. Briefing Feedback

**When:** User rates the daily briefing quality

```typescript
interface BriefingFeedback {
  id: string;
  date: string;
  overallRating: 1 | 2 | 3 | 4 | 5;
  accuracy: 1 | 2 | 3 | 4 | 5;
  usefulness: 1 | 2 | 3 | 4 | 5;
  issues?: string[];               // ['missing_context', 'factual_error', 'too_vague']
  comment?: string;
  timestamp: string;
}
```

---

## UI Components

### Sentiment Feedback Widget

```
┌─────────────────────────────────────────────────────────────────┐
│ "NVIDIA reports record Q4 earnings, stock surges 8%"           │
│                                                                 │
│ AI Sentiment: ████████████░░░░░░░░ +72 (Positive)              │
│                                                                 │
│ Is this correct?  [👍 Yes]  [👎 No]                            │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Actually, this is:  ○ Positive  ○ Neutral  ● Negative      ││
│ │                                                             ││
│ │ Why? (optional): [The stock surge is priced in, this is   ]││
│ │                  [actually bearish for future growth...    ]││
│ │                                                             ││
│ │                              [Submit Feedback]              ││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Impact Score Feedback

```
┌─────────────────────────────────────────────────────────────────┐
│ Impact Score: 85/100 (High)                                     │
│                                                                 │
│ Do you agree with this importance ranking?                      │
│                                                                 │
│   [📉 Too High]    [✓ Correct]    [📈 Too Low]                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Quick Feedback (Inline)

```
┌─────────────────────────────────────────────────────────────────┐
│ "Fed hints at rate pause"           Sentiment: -23  Impact: 67  │
│                                                    [👍] [👎]    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Storage

### CSV Export Format

For ML training compatibility:

```csv
id,headline,predicted_sentiment,predicted_label,user_correction,category,timestamp
f8a2b1,NVIDIA reports record earnings,72,positive,positive,ai_compute_infra,2024-01-15T10:30:00Z
c3d4e5,Bank layoffs accelerate,-45,negative,negative,fintech_regtech,2024-01-15T11:15:00Z
a1b2c3,Market shows mixed signals,12,neutral,negative,geopolitics,2024-01-15T12:00:00Z
```

### JSON Storage

```typescript
interface FeedbackStore {
  sentiment: SentimentFeedback[];
  impact: ImpactFeedback[];
  cluster: ClusterFeedback[];
  briefing: BriefingFeedback[];
  metadata: {
    totalFeedback: number;
    lastUpdated: string;
    exportedAt?: string;
  };
}
```

### File Location

```
news-data/
├── feedback/
│   ├── sentiment_feedback.csv
│   ├── sentiment_feedback.json
│   ├── impact_feedback.csv
│   ├── cluster_feedback.json
│   ├── briefing_feedback.json
│   └── feedback_summary.json
```

---

## API Endpoints

### Submit Feedback

```typescript
// POST /api/feedback/sentiment
app.post('/api/feedback/sentiment', (req, res) => {
  const feedback: SentimentFeedback = {
    id: generateId(),
    articleId: req.body.articleId,
    headline: req.body.headline,
    predictedSentiment: req.body.predictedSentiment,
    predictedLabel: req.body.predictedLabel,
    userCorrection: req.body.userCorrection,
    userComment: req.body.comment,
    category: req.body.category,
    timestamp: new Date().toISOString(),
  };

  saveFeedback('sentiment', feedback);
  res.json({ success: true, id: feedback.id });
});

// POST /api/feedback/impact
// POST /api/feedback/cluster
// POST /api/feedback/briefing
// (Similar structure)
```

### Get Feedback Stats

```typescript
// GET /api/feedback/stats
app.get('/api/feedback/stats', (req, res) => {
  res.json({
    totalFeedback: getTotalFeedbackCount(),
    sentimentFeedback: {
      total: sentimentFeedback.length,
      agreementRate: calculateAgreementRate(sentimentFeedback),
      commonCorrections: getCommonCorrections(sentimentFeedback),
    },
    impactFeedback: {
      total: impactFeedback.length,
      avgAdjustment: calculateAvgAdjustment(impactFeedback),
    },
    briefingFeedback: {
      total: briefingFeedback.length,
      avgRating: calculateAvgRating(briefingFeedback),
    },
  });
});
```

### Export for Training

```typescript
// GET /api/feedback/export
app.get('/api/feedback/export', (req, res) => {
  const format = req.query.format || 'csv'; // 'csv' | 'json' | 'huggingface'

  const data = exportFeedback(format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sentiment_feedback.csv');
  }

  res.send(data);
});
```

---

## Analytics & Insights

### Agreement Rate Tracking

```typescript
function calculateAgreementRate(feedback: SentimentFeedback[]): number {
  const agreements = feedback.filter(f => {
    const predictedLabel = f.predictedSentiment > 20 ? 'positive' :
                          f.predictedSentiment < -20 ? 'negative' : 'neutral';
    return predictedLabel === f.userCorrection;
  });

  return feedback.length > 0 ? agreements.length / feedback.length : 0;
}
```

### Common Correction Patterns

```typescript
interface CorrectionPattern {
  predicted: string;
  corrected: string;
  count: number;
  examples: string[];
}

function getCommonCorrections(feedback: SentimentFeedback[]): CorrectionPattern[] {
  const patterns: Map<string, CorrectionPattern> = new Map();

  for (const f of feedback) {
    const key = `${f.predictedLabel}_to_${f.userCorrection}`;
    const existing = patterns.get(key) || {
      predicted: f.predictedLabel,
      corrected: f.userCorrection,
      count: 0,
      examples: [],
    };

    existing.count++;
    if (existing.examples.length < 5) {
      existing.examples.push(f.headline);
    }

    patterns.set(key, existing);
  }

  return Array.from(patterns.values())
    .filter(p => p.predicted !== p.corrected)
    .sort((a, b) => b.count - a.count);
}
```

### Feedback Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEEDBACK ANALYTICS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Total Feedback: 1,247                                          │
│  Agreement Rate: 78.3%                                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Common Corrections:                                      │   │
│  │                                                          │   │
│  │ Neutral → Negative: 89 times                            │   │
│  │   Example: "Markets await Fed decision"                 │   │
│  │   Example: "Tech sector shows flat growth"              │   │
│  │                                                          │   │
│  │ Positive → Neutral: 45 times                            │   │
│  │   Example: "Company meets earnings expectations"         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Impact Score Feedback:                                         │
│  • Users rated 34% of scores "too low"                         │
│  • Average suggested adjustment: +12 points                     │
│                                                                 │
│  Briefing Ratings:                                              │
│  ★★★★☆ 4.2/5.0 average                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Golden Dataset Building

### Purpose

The collected feedback creates a "Golden Dataset" - human-labeled data that can:

1. **Fine-tune FinBERT** on finance/tech domain
2. **Validate impact scoring** formula
3. **Improve clustering** topic extraction
4. **Train custom models** specific to your news sources

### Dataset Structure

```typescript
interface GoldenDataset {
  version: string;
  createdAt: string;
  stats: {
    totalSamples: number;
    positiveLabels: number;
    negativeLabels: number;
    neutralLabels: number;
    categories: Record<string, number>;
  };
  samples: Array<{
    text: string;
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;      // 1.0 if user explicitly corrected
    source: 'user_feedback' | 'ai_prediction';
    metadata: {
      articleId: string;
      category: string;
      originalPrediction?: number;
    };
  }>;
}
```

### Export for HuggingFace

```typescript
function exportForHuggingFace(feedback: SentimentFeedback[]): string {
  const dataset = feedback.map(f => ({
    text: f.headline,
    label: labelToInt(f.userCorrection), // 0=negative, 1=neutral, 2=positive
  }));

  return JSON.stringify(dataset, null, 2);
}
```

---

## Privacy Considerations

### Data Handling

1. **No PII Storage:** Don't store user identifiers with feedback
2. **Aggregation Only:** Report patterns, not individual feedback
3. **Export Controls:** Admin-only access to raw feedback
4. **Retention Policy:** Auto-delete feedback older than 1 year

### Consent

```typescript
// Show consent notice before enabling feedback
interface FeedbackConsent {
  accepted: boolean;
  acceptedAt?: string;
  version: string;
}

const CONSENT_TEXT = `
Your feedback helps improve our AI analysis.
Feedback is stored anonymously and may be used to train models.
You can disable feedback collection at any time.
`;
```

---

## Implementation Checklist

### Phase 1: Basic Feedback
- [ ] Add 👍/👎 buttons to articles
- [ ] Store feedback in JSON file
- [ ] Show feedback count in admin panel

### Phase 2: Detailed Feedback
- [ ] Add sentiment correction modal
- [ ] Add impact rating widget
- [ ] Create feedback API endpoints

### Phase 3: Analytics
- [ ] Calculate agreement rates
- [ ] Identify correction patterns
- [ ] Build feedback dashboard

### Phase 4: ML Pipeline
- [ ] Export to CSV/HuggingFace format
- [ ] Create fine-tuning scripts
- [ ] A/B test improved models

---

## Portfolio Value

This feedback system demonstrates:

1. **MLOps Awareness:** Understanding of model improvement lifecycle
2. **Human-in-the-Loop:** Designing for continuous learning
3. **Data Engineering:** Building training datasets from production
4. **Product Thinking:** User feedback driving improvements

**Talking Point:** "Built a feedback collection system that achieved 78% user agreement rate and identified systematic prediction errors, creating a golden dataset of 1,200+ labeled samples for model fine-tuning."
