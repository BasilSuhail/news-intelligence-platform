/**
 * Semantic Embeddings Engine
 *
 * Generates sentence embeddings using all-MiniLM-L6-v2 via @xenova/transformers.
 * Produces 384-dimensional vectors that capture semantic meaning.
 *
 * "Oil prices rise" and "Energy sector booming" will have high similarity
 * even though they share no words - because they mean the same thing.
 *
 * Uses dynamic import for ESM compatibility (same pattern as bert-sentiment.ts).
 */

let transformersModule: any = null;
let embeddingPipeline: any = null;
let isLoading = false;
let loadError: Error | null = null;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

/**
 * Load the embedding model (lazy, one-time)
 */
async function ensureModelLoaded(): Promise<boolean> {
  if (embeddingPipeline) return true;
  if (loadError) return false;
  if (isLoading) {
    // Wait for concurrent load
    await new Promise(resolve => setTimeout(resolve, 2000));
    return embeddingPipeline !== null;
  }

  isLoading = true;
  console.log(`[Embeddings] Loading model: ${MODEL_NAME}...`);

  try {
    if (!transformersModule) {
      transformersModule = await import('@xenova/transformers');
    }

    embeddingPipeline = await transformersModule.pipeline(
      'feature-extraction',
      MODEL_NAME,
      { quantized: true }
    );

    console.log(`[Embeddings] Model loaded successfully`);
    isLoading = false;
    return true;
  } catch (error) {
    console.error('[Embeddings] Failed to load model:', error);
    loadError = error as Error;
    isLoading = false;
    return false;
  }
}

class EmbeddingEngine {

  /**
   * Generate embeddings for a batch of texts
   * Returns array of 384-dimensional vectors
   */
  public async embed(texts: string[]): Promise<number[][] | null> {
    const ready = await ensureModelLoaded();
    if (!ready || !embeddingPipeline) return null;

    try {
      console.log(`[Embeddings] Generating embeddings for ${texts.length} texts...`);
      const results: number[][] = [];

      // Process in small batches to avoid memory issues
      const batchSize = 16;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        for (const text of batch) {
          // Truncate to 256 chars (model handles ~128 tokens well)
          const truncated = text.slice(0, 256);
          const output = await embeddingPipeline(truncated, {
            pooling: 'mean',
            normalize: true
          });

          // Extract the embedding vector from the tensor
          const embedding = Array.from(output.data as Float32Array).slice(0, 384);
          results.push(embedding);
        }
      }

      console.log(`[Embeddings] Generated ${results.length} embeddings (${results[0]?.length || 0} dimensions)`);
      return results;
    } catch (error) {
      console.error('[Embeddings] Embedding generation failed:', error);
      return null;
    }
  }

  /**
   * Compute cosine similarity between two vectors
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Cluster articles by cosine similarity threshold
   *
   * Algorithm:
   * 1. Start with first unclustered article as seed
   * 2. Find all articles with similarity > threshold
   * 3. Group them into a cluster
   * 4. Repeat with remaining unclustered articles
   *
   * This is a greedy single-pass algorithm - simple but effective for news articles.
   */
  public clusterBySimilarity(
    embeddings: number[][],
    threshold = 0.55
  ): number[][] {
    const n = embeddings.length;
    const assigned = new Array(n).fill(-1);
    const clusters: number[][] = [];

    for (let i = 0; i < n; i++) {
      if (assigned[i] !== -1) continue;

      // Start a new cluster with this article as seed
      const cluster: number[] = [i];
      assigned[i] = clusters.length;

      // Find all similar unassigned articles
      for (let j = i + 1; j < n; j++) {
        if (assigned[j] !== -1) continue;

        const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
        if (similarity >= threshold) {
          cluster.push(j);
          assigned[j] = clusters.length;
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Check if the embedding model is available
   */
  public isAvailable(): boolean {
    return embeddingPipeline !== null && loadError === null;
  }

  /**
   * Preload the embedding model at startup
   */
  public async preload(): Promise<boolean> {
    console.log('[Embeddings] Preloading embedding model...');
    return ensureModelLoaded();
  }
}

export const embeddingEngine = new EmbeddingEngine();
