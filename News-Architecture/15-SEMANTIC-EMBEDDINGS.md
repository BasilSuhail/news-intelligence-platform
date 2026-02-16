# Semantic Embeddings Clustering

**Document:** Technical specification for Semantic Embeddings Clustering (Phase 2)
**Status:** Implemented (2026-02-15)
**Philosophy:** "Oil prices rise" and "Energy sector booming" should be in the same cluster - because they mean the same thing.

---

## Overview

Replaces TF-IDF word-matching with semantic sentence embeddings using `all-MiniLM-L6-v2`. Articles are clustered by **meaning**, not just shared words.

### Before vs After

| Feature | TF-IDF + K-Means (Before) | Embeddings + Cosine (After) |
|---------|---------------------------|-------------------------------|
| "Oil prices rise" ≈ "Energy sector booming" | No (different words) | Yes (same meaning) |
| "Apple stock drops" ≈ "iPhone sales decline" | No | Yes |
| Number of clusters | Must specify K upfront | Auto-detected by similarity threshold |
| Outlier handling | Forces all into clusters | Singletons isolated as noise |

---

## Architecture

```
Articles → Generate 384-dim embeddings → Cosine similarity → Threshold clustering
              (all-MiniLM-L6-v2)           (pairwise)         (≥ 0.55 = same cluster)
                                                                    │
                                                              Falls back to
                                                           TF-IDF + K-Means
                                                          if model unavailable
```

---

## Files

| File | Purpose |
|------|---------|
| `server/intelligence/clustering/embeddings.ts` | Sentence embedding engine using `@xenova/transformers` |
| `server/intelligence/clustering/semantic-cluster.ts` | Cosine similarity clustering with TF-IDF fallback |
| `server/intelligence/clustering/pipeline.ts` | Updated: semantic-first, TF-IDF fallback |

---

## Backend Modules

### Embedding Engine (`embeddings.ts`)

- Uses `Xenova/all-MiniLM-L6-v2` via `@xenova/transformers` (already installed for BERT sentiment)
- Produces 384-dimensional normalized vectors
- Dynamic import for ESM compatibility (same pattern as `bert-sentiment.ts`)
- Lazy model loading with preload support
- Batch processing in groups of 16 to avoid memory issues
- Truncates text to 256 characters per article

**Cosine Similarity:**
```
similarity = (A · B) / (||A|| × ||B||)
```
Where A and B are embedding vectors. Result is 0 to 1 (since embeddings are normalized).

**Clustering Algorithm (Greedy Single-Pass):**
1. Start with first unclustered article as seed
2. Find all articles with similarity ≥ threshold
3. Group them into a cluster
4. Repeat with remaining unclustered articles

**Threshold:**
- 50+ articles → threshold = 0.50 (more permissive, larger clusters)
- <50 articles → threshold = 0.55 (tighter clusters)

### Semantic Cluster Engine (`semantic-cluster.ts`)

- Wraps the embedding engine with full ArticleCluster output
- Falls back to existing TF-IDF + K-Means if embeddings unavailable
- Extracts keywords using Compromise NLP (same as TF-IDF engine)
- Output format is **identical** to TF-IDF - downstream code sees no difference

### Pipeline Integration

In `clustering/pipeline.ts`:
```typescript
// Semantic embeddings first, TF-IDF fallback
let clusters: ArticleCluster[];
try {
    clusters = await semanticClusterEngine.cluster(articles);
} catch (err) {
    clusters = await clusteringEngine.cluster(articles);
}
```

---

## Research References

- BERT embeddings + HDBSCAN achieves near-perfect clustering ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2666307424000482))
- `all-MiniLM-L6-v2` gives high performance at only 384 dimensions ([ACL 2025](https://aclanthology.org/2025.acl-long.902.pdf))
- BERTopic (UMAP + HDBSCAN + LLM labeling) is the 2025 gold standard for topic modeling

---

## Patterns Used

- **ESM dynamic import:** `await import('@xenova/transformers')` for CJS compatibility
- **Lazy loading:** Model loads on first use, with preload support
- **Graceful fallback:** If embedding model fails → TF-IDF takes over automatically
- **Zero new dependencies:** Uses `@xenova/transformers` already installed for BERT sentiment
