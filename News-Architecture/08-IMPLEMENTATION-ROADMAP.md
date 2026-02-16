# Implementation Roadmap

**Document:** Step-by-step implementation guide
**Version:** 1.0
**Approach:** Incremental delivery with working features at each milestone

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION TIMELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  MILESTONE 1        MILESTONE 2        MILESTONE 3        MILESTONE 4   │
│  Foundation         Local Brain        Clustering         Synthesis     │
│  ───────────       ───────────        ───────────       ───────────    │
│  • Types           • FinBERT          • TF-IDF          • Gemini       │
│  • Storage         • Impact Score     • BERTopic        • Briefings    │
│  • Providers       • Geo Tags         • Topic Extract   • Caching      │
│                                                                          │
│  MILESTONE 5        MILESTONE 6        MILESTONE 7        MILESTONE 8   │
│  GPR Index         Frontend           Feedback          Polish         │
│  ───────────       ───────────        ───────────       ───────────    │
│  • Keywords        • Dashboard        • UI Hooks        • Testing      │
│  • Calculation     • Charts           • CSV Export      • Docs         │
│  • History         • Explainability   • Analytics       • Deploy       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Milestone 1: Foundation

### Objective
Set up the modular architecture and unified storage layer.

### Deliverables

#### 1.1 Core Types
```
server/intelligence/core/types.ts
├── RawArticle interface
├── EnrichedArticle interface
├── ArticleCluster interface
├── SentimentScore interface
├── ImpactFactors interface
├── GPRDataPoint interface
├── DailyBriefing interface
└── PipelineConfig interface
```

#### 1.2 Storage Layer
```
server/intelligence/core/storage.ts
├── SQLite schema initialization
├── Article CRUD operations
├── Cluster CRUD operations
├── Briefing storage
├── JSON fallback for Docker
└── Migration utilities
```

#### 1.3 Provider Interfaces
```
server/intelligence/ingestion/providers/
├── base.provider.ts (interface)
├── newsapi.provider.ts (refactored)
├── rss.provider.ts (refactored)
└── index.ts (provider registry)
```

#### 1.4 Configuration
```
server/config/
├── categories.ts
├── sources.ts (source weights)
└── pipeline.config.ts
```

### Exit Criteria
- [ ] All types compile without errors
- [ ] SQLite database initializes on startup
- [ ] NewsAPI provider fetches articles
- [ ] RSS provider fetches articles
- [ ] Articles stored in database
- [ ] Existing functionality not broken

---

## Milestone 2: Local Brain (Enrichment Layer)

### Objective
Add sentiment analysis, impact scoring, and geo-tagging WITHOUT any API calls.

### Deliverables

#### 2.1 Sentiment Analysis
```
server/intelligence/enrichment/sentiment.ts
├── FinBERT integration (optional, Node.js compatible)
├── Local dictionary fallback (always works)
├── Hybrid mode selection
├── Sentiment caching
└── Batch processing support
```

**FinBERT Options:**
- Option A: Python subprocess with FinBERT
- Option B: ONNX-converted model in Node.js
- Option C: Enhanced local dictionary (no ML)

#### 2.2 Impact Scoring
```
server/intelligence/enrichment/impact.ts
├── ImpactCalculator class
├── Sentiment magnitude factor
├── Cluster size factor
├── Source weight factor
├── Recency decay factor
├── Configurable weights
└── Score normalization
```

#### 2.3 Geopolitical Tagging
```
server/intelligence/enrichment/geotags.ts
├── Keyword dictionary (300+ terms)
├── Category assignment
├── Keyword extraction
├── Weight calculation
└── Tag aggregation
```

#### 2.4 Enrichment Pipeline
```
server/intelligence/enrichment/pipeline.ts
├── EnrichmentPipeline class
├── Batch article processing
├── Parallel execution
├── Error handling
└── Progress reporting
```

### Exit Criteria
- [ ] Every article has sentiment score
- [ ] Every article has impact score
- [ ] Geopolitical articles have geo tags
- [ ] No external API calls required
- [ ] Processing < 100ms per article (local)
- [ ] Sentiment cache working

---

## Milestone 3: Clustering Layer (Trend Engine)

### Objective
Group similar articles into meaningful topics.

### Deliverables

#### 3.1 TF-IDF Clustering (Primary - No Dependencies)
```
server/intelligence/clustering/tfidf.ts
├── TF-IDF vectorizer
├── Cosine similarity calculation
├── K-Means clustering
├── Topic keyword extraction
├── Cluster merging logic
└── Outlier handling
```

#### 3.2 BERTopic Integration (Optional - Python)
```
server/intelligence/clustering/bertopic.ts
├── Python bridge setup
├── BERTopic wrapper
├── Embedding generation
├── Topic extraction
├── Fallback to TF-IDF
└── Model caching
```

#### 3.3 Keyword Clustering (Fallback - Simplest)
```
server/intelligence/clustering/keyword.ts
├── Keyword extraction
├── Shared keyword grouping
├── Group merging
├── Topic naming
└── Article assignment
```

#### 3.4 Clustering Pipeline
```
server/intelligence/clustering/pipeline.ts
├── ClusteringPipeline class
├── Method selection (auto/manual)
├── Cluster quality metrics
├── Result caching
└── Date-based partitioning
```

### Exit Criteria
- [ ] Articles grouped into 5-15 clusters per day
- [ ] Each cluster has topic name and keywords
- [ ] Aggregate sentiment per cluster
- [ ] Aggregate impact per cluster
- [ ] Clustering < 5 seconds for 100 articles
- [ ] Cluster cache working

---

## Milestone 4: Synthesis Layer (API Gatekeeper)

### Objective
Generate AI briefings with strict caching to prevent API waste.

### Deliverables

#### 4.1 Idempotent Cache
```
server/intelligence/core/cache.ts
├── BriefingCache class
├── Hash generation
├── Cache lookup before API
├── Result storage with hash
├── Expiration management
└── Persistent cache (file-based)
```

#### 4.2 Gemini Integration
```
server/intelligence/synthesis/gemini.ts
├── GeminiClient class
├── API key rotation
├── Rate limiting
├── Prompt templates
├── Response parsing
└── Error handling
```

#### 4.3 Briefing Generator
```
server/intelligence/synthesis/briefing.ts
├── BriefingGenerator class
├── Cluster selection (top 5)
├── Cache check (CRITICAL)
├── API call (if cache miss)
├── Local fallback generation
└── Result formatting
```

#### 4.4 Local Fallback
```
server/intelligence/synthesis/fallback.ts
├── Template-based generation
├── Key metrics summary
├── Top clusters listing
├── No API dependency
└── Marked as fallback
```

### Exit Criteria
- [ ] Daily briefing generated
- [ ] Cache prevents duplicate API calls
- [ ] Same input → Same output (idempotent)
- [ ] Fallback works when Gemini unavailable
- [ ] API calls logged for monitoring
- [ ] < 10 API calls per day

---

## Milestone 5: Geopolitical Risk Index

### Objective
Implement the GPR metric with historical tracking.

### Deliverables

#### 5.1 GPR Calculator
```
server/intelligence/metrics/gpr.ts
├── GPRCalculator class
├── Keyword dictionary (300+ terms)
├── Weighted scoring
├── Daily calculation
├── Trend analysis (7d, 30d)
└── Alert generation
```

#### 5.2 GPR Storage
```
server/intelligence/metrics/gpr-storage.ts
├── Daily GPR records
├── Keyword breakdown storage
├── Historical queries
├── Export functionality
└── Aggregation helpers
```

#### 5.3 GPR API
```
server/routes/gpr.routes.ts
├── GET /api/gpr (current + history)
├── GET /api/gpr/:date/keywords
├── GET /api/gpr/trend
└── GET /api/gpr/alerts
```

### Exit Criteria
- [ ] GPR calculated daily
- [ ] Historical data stored (30+ days)
- [ ] Trend calculation working
- [ ] Keyword breakdown available
- [ ] API endpoints functional
- [ ] Alerts generated for spikes

---

## Milestone 6: Frontend Dashboard

### Objective
Build the explainable dashboard UI.

### Deliverables

#### 6.1 Core Components
```
client/src/components/intelligence/
├── ExecutiveSummary.tsx
├── GPRGauge.tsx
├── SentimentIndicator.tsx
├── TrendingTopics.tsx
├── LiveFeed.tsx
└── ImpactBadge.tsx
```

#### 6.2 Charts
```
client/src/components/charts/
├── SentimentTrendChart.tsx
├── GPRHistoryChart.tsx
├── CategoryBreakdownChart.tsx
└── ImpactDistributionChart.tsx
```

#### 6.3 Explainability
```
client/src/components/explainability/
├── WhyModal.tsx
├── ImpactBreakdown.tsx
├── ClusterDetail.tsx
└── ArticleExplanation.tsx
```

#### 6.4 Pages
```
client/src/pages/
├── IntelligenceDashboard.tsx
├── GPRDetail.tsx
├── ClusterView.tsx
└── ArticleDetail.tsx
```

### Exit Criteria
- [ ] Dashboard displays all metrics
- [ ] Charts render with real data
- [ ] "Why" modal explains rankings
- [ ] Mobile responsive
- [ ] Loading states
- [ ] Error handling

---

## Milestone 7: Feedback System

### Objective
Collect user feedback for ML improvement.

### Deliverables

#### 7.1 Feedback Components
```
client/src/components/feedback/
├── SentimentFeedback.tsx
├── ImpactFeedback.tsx
├── QuickFeedback.tsx (thumbs up/down)
└── FeedbackModal.tsx
```

#### 7.2 Feedback API
```
server/routes/feedback.routes.ts
├── POST /api/feedback/sentiment
├── POST /api/feedback/impact
├── GET /api/feedback/stats
└── GET /api/feedback/export
```

#### 7.3 Feedback Storage
```
server/intelligence/metrics/feedback.ts
├── FeedbackStore class
├── CSV export
├── JSON storage
├── Analytics calculation
└── HuggingFace export
```

#### 7.4 Admin Dashboard
```
client/src/pages/admin/
├── FeedbackDashboard.tsx
├── AgreementRateChart.tsx
├── CorrectionPatterns.tsx
└── ExportControls.tsx
```

### Exit Criteria
- [ ] Feedback buttons on all articles
- [ ] Feedback stored correctly
- [ ] Export to CSV works
- [ ] Analytics dashboard functional
- [ ] Agreement rate calculated

---

## Milestone 8: Polish & Deploy

### Objective
Production-ready release.

### Deliverables

#### 8.1 Testing
```
tests/
├── unit/
│   ├── sentiment.test.ts
│   ├── impact.test.ts
│   ├── clustering.test.ts
│   └── gpr.test.ts
├── integration/
│   ├── pipeline.test.ts
│   └── api.test.ts
└── e2e/
    └── dashboard.test.ts
```

#### 8.2 Documentation
```
News-Architecture/
├── API-REFERENCE.md
├── CONFIGURATION.md
├── TROUBLESHOOTING.md
└── CHANGELOG.md
```

#### 8.3 Performance
- [ ] Pipeline runs in < 2 minutes
- [ ] Dashboard loads in < 2 seconds
- [ ] API responses < 500ms
- [ ] Memory usage < 512MB

#### 8.4 Deployment
- [ ] Docker configuration updated
- [ ] Environment variables documented
- [ ] CI/CD pipeline (optional)
- [ ] Monitoring alerts

### Exit Criteria
- [ ] All tests passing
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Performance targets met
- [ ] Deployed to production

---

## File Structure (Final)

```
server/
├── intelligence/
│   ├── core/
│   │   ├── types.ts
│   │   ├── storage.ts
│   │   ├── cache.ts
│   │   └── pipeline.ts
│   ├── ingestion/
│   │   ├── providers/
│   │   │   ├── base.provider.ts
│   │   │   ├── newsapi.provider.ts
│   │   │   └── rss.provider.ts
│   │   └── collector.ts
│   ├── enrichment/
│   │   ├── sentiment.ts
│   │   ├── impact.ts
│   │   ├── geotags.ts
│   │   └── pipeline.ts
│   ├── clustering/
│   │   ├── tfidf.ts
│   │   ├── bertopic.ts
│   │   ├── keyword.ts
│   │   └── pipeline.ts
│   ├── synthesis/
│   │   ├── gemini.ts
│   │   ├── briefing.ts
│   │   └── fallback.ts
│   └── metrics/
│       ├── gpr.ts
│       ├── gpr-storage.ts
│       ├── feedback.ts
│       └── analytics.ts
├── config/
│   ├── categories.ts
│   ├── sources.ts
│   ├── keywords.ts
│   └── pipeline.config.ts
└── routes/
    ├── intelligence.routes.ts
    ├── gpr.routes.ts
    └── feedback.routes.ts

client/src/
├── components/
│   ├── intelligence/
│   ├── charts/
│   ├── explainability/
│   └── feedback/
├── pages/
│   ├── IntelligenceDashboard.tsx
│   └── admin/
└── hooks/
    └── useIntelligence.ts

News-Architecture/
├── 00-MASTER-PLAN.md
├── 01-CURRENT-STATE-ANALYSIS.md
├── 02-PIPELINE-ARCHITECTURE.md
├── 03-IMPACT-SCORE-ALGORITHM.md
├── 04-GEOPOLITICAL-RISK-INDEX.md
├── 05-CACHING-IDEMPOTENCE.md
├── 06-EVALUATION-HOOKS.md
├── 07-FRONTEND-DASHBOARD.md
├── 08-IMPLEMENTATION-ROADMAP.md
├── API-REFERENCE.md
├── CONFIGURATION.md
├── TROUBLESHOOTING.md
└── CHANGELOG.md
```

---

## Dependencies to Add

### NPM Packages

```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0",     // SQLite for storage
    "natural": "^6.0.0",             // TF-IDF, tokenization
    "ml-kmeans": "^6.0.0",           // K-Means clustering
    "compromise": "^14.0.0"          // NLP for keyword extraction
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.0.0"
  }
}
```

### Optional (for FinBERT/BERTopic)

```bash
# Python environment (optional)
pip install transformers torch bertopic
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| FinBERT too complex | Use enhanced local dictionary |
| BERTopic slow | Default to TF-IDF |
| Gemini unavailable | Local fallback briefings |
| SQLite issues | JSON file fallback |
| Performance problems | Aggressive caching |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Pipeline execution time | < 2 minutes |
| API calls per day | < 20 |
| Cache hit rate | > 80% |
| User feedback collected | 100+ samples |
| GPR accuracy (vs manual) | > 85% |
| Dashboard load time | < 2 seconds |

---

## Next Steps

1. **Review this roadmap** - Confirm scope and priorities
2. **Start Milestone 1** - Foundation setup
3. **Iterate** - Each milestone is independently deployable
4. **Feedback loop** - Adjust based on results

**Ready to start implementation when you say "Go"!**
