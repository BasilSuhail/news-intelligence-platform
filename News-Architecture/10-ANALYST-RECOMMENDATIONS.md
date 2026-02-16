# 🕵️‍♂️ Analyst Report: News Architecture Audit & Recommendations

**To:** Lead Developer / Product Owner
**From:** External Analyst
**Date:** 2026-02-05
**Subject:** Strategic Improvements for "Local-First" Market Intelligence

---

## 🚨 Executive Summary (The Brutal Truth)

Your "Local-First" architecture is sound, but your intelligence is currently "dumb".

| Problem | Current State | Impact |
|---------|---------------|--------|
| **Sentiment is brittle** | Dictionary-based (keyword counting) | "The market didn't crash" scored as negative |
| **Clustering is surface-level** | TF-IDF (exact word matching) | "Oil prices rise" ≠ "Energy sector booming" |
| **Impact Score is arbitrary** | Heuristic formula | No reality check against market movement |
| **No Entity Recognition** | Hardcoded geo-tags | Can't identify "Elon Musk" vs "Tesla" |

**You don't need to rebuild. You need to upgrade the engine components while keeping the chassis.**

---

## 🧠 Phase 1: Brain Transplant (Intelligence Upgrades)

### 1.1 Upgrade Sentiment to "Local BERT"

**Problem:** Dictionary lookups miss context.
**Solution:** Use `@xenova/transformers` (transformers.js)

| Feature | Dictionary (Current) | FinBERT (Proposed) |
|---------|---------------------|-------------------|
| Accuracy (Finance) | ~60-70% | 89-91% |
| Context Awareness | ❌ None | ✅ Handles negation, sarcasm |
| Latency (Local) | < 1ms | ~16ms (WebGPU) |
| Setup Size | < 1MB | ~250MB (one-time) |

**Why:** It allows you to run state-of-the-art models directly in Node.js. No Python server. No API costs.

**Repo:** [xenova/transformers.js](https://github.com/xenova/transformers.js)

### 1.2 Named Entity Recognition (NER)

**Problem:** Relying on hardcoded "Geo Tags" keywords.
**Solution:** Use `compromise` (already installed!)

| Library | Speed | Accuracy | Status |
|---------|-------|----------|--------|
| Compromise | ~1M+ tokens/sec | Moderate | ✅ Already in package.json |
| Wink-NER | ~650k tokens/sec | 95% | Alternative |

**Benefit:** Automatically tag PERSON (Elon Musk), ORG (Tesla), LOC (Texas) without maintaining manual lists.

### 1.3 Semantic Clustering (Future)

**Problem:** TF-IDF misses synonyms.
**Solution:** Sentence Embeddings + clustering

**Status:** 🔴 High complexity - deferred to Phase 2

---

## 🎨 Phase 2: Face Lift (Visualization & UX)

### 2.1 Accessibility Improvements

**Problem:** Red/Green sentiment is bad for colorblind users.
**Solution:** Shape + Color indicators

| Sentiment | Current | Proposed |
|-----------|---------|----------|
| Positive | Green text | ⬆️ Green Up Arrow |
| Negative | Red text | ⬇️ Red Down Arrow |
| Neutral | Gray text | ⏺️ Gray Circle |

### 2.2 Contrarian Signal

**Problem:** Echo chambers - if 10 articles say "Buy", the 1 "Sell" article is buried.
**Solution:** Disagreement Detection

**Logic:** If a Cluster has 90% positive sentiment, highlight the most negative article as "⚠️ Dissenting Opinion"

### 2.3 Narrative Timeline (Future)

**Status:** 🟡 Deferred - can reuse existing JourneySection component

---

## 🔬 Phase 3: Reality Check (Data Integrity)

### 3.1 Hindsight Validator (Future)

**Problem:** No validation if Impact Score correlates with reality.
**Solution:** Check against stock API (Yahoo Finance free tier)

**Status:** 🔴 Deferred - requires external API integration

---

## 📋 Execution Plan

### Priority Matrix

| # | Task | Effort | Impact | Dependencies |
|---|------|--------|--------|--------------|
| 1 | NER with Compromise | 🟢 Low | 🟡 Medium | None (already installed) |
| 2 | Accessibility (shapes) | 🟢 Low | 🟡 Medium | None |
| 3 | Contrarian Signal | 🟢 Low | 🟡 Medium | None |
| 4 | Local BERT Sentiment | 🟡 Medium | 🔴 High | npm install |
| 5 | Update Implementation Log | 🟢 Low | 🟢 Low | After all above |

### Execution Order

```
Phase 1: Quick Wins (Today)
├── Task 1: NER Integration
│   └── File: server/intelligence/enrichment/ner.ts (NEW)
├── Task 2: Accessibility
│   └── File: client/src/components/intelligence/IntelligenceDashboard.tsx
└── Task 3: Contrarian Signal
    └── File: client/src/components/intelligence/IntelligenceDashboard.tsx

Phase 2: Brain Upgrade (Today)
└── Task 4: Local BERT
    ├── npm install @xenova/transformers
    ├── File: server/intelligence/enrichment/bert-sentiment.ts (NEW)
    └── File: server/intelligence/enrichment/sentiment.ts (UPDATE)

Phase 3: Documentation
└── Task 5: Update IMPLEMENTATION-LOG.md
```

---

## 📁 Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `server/intelligence/enrichment/ner.ts` | Entity extraction with Compromise |
| `server/intelligence/enrichment/bert-sentiment.ts` | Local BERT sentiment analysis |

### Modified Files
| File | Changes |
|------|---------|
| `IntelligenceDashboard.tsx` | Add shapes, contrarian signal |
| `sentiment.ts` | Integrate BERT as primary, dictionary as fallback |
| `pipeline.ts` | Add NER to enrichment pipeline |

---

## 🔧 Technical Specifications

### NER Output Schema
```typescript
interface ExtractedEntities {
  people: string[];      // ["Elon Musk", "Tim Cook"]
  organizations: string[]; // ["Tesla", "Apple"]
  places: string[];      // ["California", "China"]
  topics: string[];      // ["AI", "Semiconductors"]
}
```

### BERT Sentiment Output
```typescript
interface BertSentiment {
  label: 'positive' | 'negative' | 'neutral';
  score: number;      // 0-1 confidence
  source: 'bert' | 'dictionary'; // fallback indicator
}
```

### Contrarian Signal Logic
```typescript
// If cluster sentiment is strongly positive (>70% articles positive)
// Find the article with most negative sentiment
// Flag it as "contrarian"
interface ContrarianArticle {
  id: string;
  title: string;
  sentiment: number;
  isContrarian: boolean;
}
```

---

## ✅ Success Criteria

- [ ] NER extracts entities from article titles/descriptions
- [ ] Accessibility: Sentiment uses shapes + colors
- [ ] Contrarian articles highlighted in clusters
- [ ] BERT sentiment running locally (fallback to dictionary if model fails)
- [ ] No breaking changes to existing APIs
- [ ] All news data preserved

---

## 📊 Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Sentiment Accuracy | ~65% | ~90% |
| Entity Recognition | Manual keywords | Automatic NER |
| Accessibility | Color-only | Shape + Color |
| Contrarian Detection | None | Automatic |
| Model Size | 0 MB | +250 MB |

---

## 🚀 Implementation Status

| Task | Status | Date |
|------|--------|------|
| Documentation created | ✅ | 2026-02-05 |
| NER Integration | ✅ | 2026-02-05 |
| Accessibility | ✅ | 2026-02-05 |
| Contrarian Signal | ✅ | 2026-02-05 |
| Local BERT | ✅ | 2026-02-05 |
| Log Updated | ✅ | 2026-02-05 |
