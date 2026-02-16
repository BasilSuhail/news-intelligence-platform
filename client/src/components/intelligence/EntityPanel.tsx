import { X, ExternalLink, TrendingUp, TrendingDown, Minus, Newspaper } from "lucide-react";
import type { EntityPanelProps } from "@/types/intelligence";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const getSentimentIcon = (sentiment: number) => {
  if (sentiment > 15) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (sentiment < -15) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
};

const getSentimentLabel = (sentiment: number): string => {
  if (sentiment > 30) return "Strong Bullish";
  if (sentiment > 15) return "Bullish";
  if (sentiment < -30) return "Strong Bearish";
  if (sentiment < -15) return "Bearish";
  return "Neutral";
};

const getSentimentColor = (sentiment: number): string => {
  if (sentiment > 15) return "text-emerald-600 dark:text-emerald-400";
  if (sentiment < -15) return "text-red-600 dark:text-red-400";
  return "text-gray-600 dark:text-neutral-400";
};

export function EntityPanel({ cluster, onClose }: EntityPanelProps) {
  if (!cluster) return null;

  // Extract unique entities from articles (geo tags, sources)
  const allGeoTags = cluster.articles.flatMap(a => a.geoTags || []);
  const uniqueGeoTags = Array.from(new Set(allGeoTags));

  const allSources = cluster.articles.map(a => a.source);
  const uniqueSources = Array.from(new Set(allSources));

  const allTopics = cluster.articles.flatMap(a => a.topics || []);
  const uniqueTopics = Array.from(new Set(allTopics)).slice(0, 8);

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 shadow-2xl z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getSentimentIcon(cluster.aggregateSentiment)}
            <Badge
              variant="outline"
              className={getSentimentColor(cluster.aggregateSentiment)}
            >
              {getSentimentLabel(cluster.aggregateSentiment)}
            </Badge>
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-neutral-200 text-lg leading-tight">
            {cluster.topic}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Metrics */}
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500 mb-1">
              Sentiment
            </p>
            <p className={`text-2xl font-light tabular-nums ${getSentimentColor(cluster.aggregateSentiment)}`}>
              {cluster.aggregateSentiment > 0 ? "+" : ""}{cluster.aggregateSentiment.toFixed(1)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500 mb-1">
              Impact Score
            </p>
            <p className="text-2xl font-light tabular-nums text-violet-600 dark:text-violet-400">
              {cluster.aggregateImpact}
            </p>
          </div>
        </div>

        {/* Keywords */}
        <div className="px-4 pb-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500 mb-2">
            Keywords
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cluster.keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>

        {/* Categories */}
        {cluster.categories.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500 mb-2">
              Categories
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cluster.categories.map((cat) => (
                <Badge key={cat} variant="outline" className="text-xs capitalize">
                  {cat}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Linked Entities (Geo Tags) */}
        {uniqueGeoTags.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500 mb-2">
              Linked Regions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {uniqueGeoTags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Topics */}
        {uniqueTopics.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500 mb-2">
              Related Topics
            </p>
            <div className="flex flex-wrap gap-1.5">
              {uniqueTopics.map((topic) => (
                <span
                  key={topic}
                  className="text-xs px-2 py-1 rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sources */}
        <div className="px-4 pb-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500 mb-2">
            Sources ({uniqueSources.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {uniqueSources.map((source) => (
              <span
                key={source}
                className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
              >
                {source}
              </span>
            ))}
          </div>
        </div>

        {/* Articles List */}
        <div className="px-4 pb-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-500 mb-3 flex items-center gap-1.5">
            <Newspaper className="w-3 h-3" />
            Contributing Articles ({cluster.articleCount})
          </p>
          <div className="space-y-2">
            {cluster.articles.slice(0, 5).map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-xl border border-gray-100 dark:border-neutral-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 line-clamp-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {article.title}
                  </p>
                  <ExternalLink className="w-3 h-3 text-gray-400 shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-neutral-500">
                  <span className="uppercase">{article.source}</span>
                  <span className={getSentimentColor(article.sentiment.normalizedScore)}>
                    {article.sentiment.label}
                  </span>
                </div>
              </a>
            ))}
            {cluster.articles.length > 5 && (
              <p className="text-center text-xs text-gray-400 dark:text-neutral-600 py-2">
                +{cluster.articles.length - 5} more articles
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
