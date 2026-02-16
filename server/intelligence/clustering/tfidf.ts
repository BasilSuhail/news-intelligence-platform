import natural from 'natural';
const { TfIdf } = natural;
import {
    EnrichedArticle,
    ArticleCluster
} from '../core/types';

// Dynamic import for ESM-only modules
let kmeansModule: any = null;
let nlpModule: any = null;

async function loadESMModules() {
    if (!kmeansModule) {
        kmeansModule = await import('ml-kmeans');
    }
    if (!nlpModule) {
        nlpModule = await import('compromise');
    }
}

/**
 * Market Intelligence - Clustering Engine
 *
 * Groups similar news articles using TF-IDF vectorization and K-Means.
 * Extracts topic keywords using term frequency analysis.
 */
export class ClusteringEngine {
    /**
     * Cluster articles into topics
     */
    public async cluster(articles: EnrichedArticle[]): Promise<ArticleCluster[]> {
        if (articles.length < 3) {
            console.log(`[Clustering] Too few articles (${articles.length}) to cluster.`);
            return [];
        }

        // Load ESM modules dynamically
        await loadESMModules();

        console.log(`[Clustering] Vectorizing ${articles.length} articles...`);

        // 1. Vectorize headlines
        const texts = articles.map(a => `${a.title} ${a.description || ''}`);
        const vectors = this.vectorize(texts);

        // 2. Perform K-Means clustering
        // Determine target number of clusters (roughly 1 cluster per 10 articles, min 2, max 15)
        const k = Math.min(15, Math.max(2, Math.ceil(articles.length / 10)));
        console.log(`[Clustering] Running K-Means with k=${k}...`);

        const result = kmeansModule.kmeans(vectors, k, {});

        // 3. Group articles by cluster
        const clusterMap: Map<number, EnrichedArticle[]> = new Map();
        result.clusters.forEach((clusterIdx: number, articleIdx: number) => {
            if (!clusterMap.has(clusterIdx)) clusterMap.set(clusterIdx, []);
            clusterMap.get(clusterIdx)!.push(articles[articleIdx]);
        });

        // 4. Create ArticleCluster objects
        const clusters: ArticleCluster[] = [];
        clusterMap.forEach((clusterArticles, idx) => {
            if (clusterArticles.length > 0) {
                clusters.push(this.createCluster(clusterArticles, idx.toString()));
            }
        });

        console.log(`[Clustering] Identified ${clusters.length} clusters.`);
        return clusters.sort((a, b) => b.aggregateImpact - a.aggregateImpact);
    }

    /**
     * Simple TF-IDF Vectorization
     */
    private vectorize(texts: string[]): number[][] {
        const tfidf = new TfIdf();
        texts.forEach(t => tfidf.addDocument(t));

        // Get all unique terms across all documents
        const terms = new Set<string>();
        texts.forEach((_, i) => {
            tfidf.listTerms(i).forEach(item => terms.add(item.term));
        });

        const termList = Array.from(terms);

        // Create vectors
        return texts.map((_, i) => {
            const vector = new Array(termList.length).fill(0);
            tfidf.listTerms(i).forEach(item => {
                const termIdx = termList.indexOf(item.term);
                if (termIdx !== -1) vector[termIdx] = item.tfidf;
            });
            return vector;
        });
    }

    /**
     * Create a cluster and extract metadata
     */
    private createCluster(articles: EnrichedArticle[], id: string): ArticleCluster {
        const combinedText = articles.map(a => `${a.title} ${a.description || ''}`).join(' ');
        const keywords = this.extractKeywords(combinedText);
        const topic = this.generateTopicName(articles[0].title, keywords);

        const earliest = articles.reduce((min, a) => a.publishedAt < min ? a.publishedAt : min, articles[0].publishedAt);
        const latest = articles.reduce((max, a) => a.publishedAt > max ? a.publishedAt : max, articles[0].publishedAt);

        return {
            id: `cluster_${Date.now()}_${id}`,
            topic,
            keywords,
            articles,
            aggregateSentiment: articles.reduce((sum, a) => sum + a.sentiment.normalizedScore, 0) / articles.length,
            aggregateImpact: articles.reduce((sum, a) => sum + a.impactScore, 0) / articles.length,
            articleCount: articles.length,
            categories: Array.from(new Set(articles.map(a => a.category))),
            dateRange: { earliest, latest }
        };
    }

    private extractKeywords(text: string): string[] {
        // Use compromise to get nouns/topics (loaded dynamically)
        if (!nlpModule) {
            // Fallback: simple keyword extraction without NLP
            return text.toLowerCase()
                .split(/\s+/)
                .filter(w => w.length > 4)
                .slice(0, 10);
        }
        const nlp = nlpModule.default || nlpModule;
        const doc = nlp(text);
        const keywords = doc.topics().out('array')
            .concat(doc.nouns().out('array'))
            .filter((w: string) => w.length > 3)
            .slice(0, 10);

        return Array.from(new Set(keywords)) as string[];
    }

    private generateTopicName(primaryHeadline: string, keywords: string[]): string {
        // Highly simplified: Use the primary headline but clean it up or use top keywords
        if (keywords.length > 0) {
            const topWords = keywords.slice(0, 3).map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(' & ');
            return `Trends in ${topWords}`;
        }
        return primaryHeadline.length > 50 ? primaryHeadline.slice(0, 47) + '...' : primaryHeadline;
    }
}

export const clusteringEngine = new ClusteringEngine();
