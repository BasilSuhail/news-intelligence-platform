import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ExternalLink, ChevronRight, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ArticleCluster } from "@/types/intelligence";

interface IntelligenceOverviewProps {
  clusters: ArticleCluster[];
}

export function IntelligenceOverview({ clusters }: IntelligenceOverviewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort clusters by impact
  const sortedClusters = [...clusters]
    .sort((a, b) => b.aggregateImpact - a.aggregateImpact)
    .slice(0, 6);

  // Calculate sentiment distribution
  const sentimentCounts = sortedClusters.reduce(
    (acc, c) => {
      if (c.aggregateSentiment > 10) acc.bullish++;
      else if (c.aggregateSentiment < -10) acc.bearish++;
      else acc.neutral++;
      return acc;
    },
    { bullish: 0, neutral: 0, bearish: 0 }
  );

  const total = sortedClusters.length || 1;
  const bullishPct = (sentimentCounts.bullish / total) * 100;
  const neutralPct = (sentimentCounts.neutral / total) * 100;
  const bearishPct = (sentimentCounts.bearish / total) * 100;

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 10) return <TrendingUp className="w-3.5 h-3.5" />;
    if (sentiment < -10) return <TrendingDown className="w-3.5 h-3.5" />;
    return <Minus className="w-3.5 h-3.5" />;
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 10) return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20";
    if (sentiment < -10) return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
    return "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-neutral-800/50";
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 10) return "Bullish";
    if (sentiment < -10) return "Bearish";
    return "Neutral";
  };

  if (!clusters || clusters.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-neutral-500">
        No intelligence data available
      </div>
    );
  }

  return (
    <section data-section="causal" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-800 dark:text-neutral-200 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-500" />
          Topic Analysis
        </h2>
        <span className="text-xs text-gray-400 dark:text-neutral-500">
          {sortedClusters.length} topics analyzed
        </span>
      </div>

      {/* Sentiment Distribution Bar */}
      <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider">
            Sentiment Distribution
          </span>
          <div className="flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Bullish ({sentimentCounts.bullish})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              Neutral ({sentimentCounts.neutral})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Bearish ({sentimentCounts.bearish})
            </span>
          </div>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden flex">
          {bullishPct > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${bullishPct}%` }}
            />
          )}
          {neutralPct > 0 && (
            <div
              className="h-full bg-gray-400 transition-all duration-500"
              style={{ width: `${neutralPct}%` }}
            />
          )}
          {bearishPct > 0 && (
            <div
              className="h-full bg-red-500 transition-all duration-500"
              style={{ width: `${bearishPct}%` }}
            />
          )}
        </div>
      </div>

      {/* Topic Cards */}
      <div className="space-y-3">
        {sortedClusters.map((cluster, index) => {
          const isExpanded = expandedId === cluster.id;

          return (
            <div
              key={cluster.id}
              className="rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden transition-all hover:border-gray-200 dark:hover:border-neutral-700"
            >
              {/* Main Card Content */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : cluster.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-start gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-500 dark:text-neutral-500">
                      {index + 1}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Sentiment Badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${getSentimentColor(cluster.aggregateSentiment)}`}>
                        {getSentimentIcon(cluster.aggregateSentiment)}
                        {getSentimentLabel(cluster.aggregateSentiment)}
                      </span>
                    </div>

                    {/* Topic Title */}
                    <h3 className="text-sm font-medium text-gray-800 dark:text-neutral-200 mb-2 leading-snug">
                      {cluster.topic}
                    </h3>

                    {/* Impact Bar */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide w-12">Impact</span>
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all duration-500"
                          style={{ width: `${cluster.aggregateImpact}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-gray-500 dark:text-neutral-500 w-8 text-right">
                        {cluster.aggregateImpact}
                      </span>
                    </div>
                  </div>

                  {/* Expand Arrow */}
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-neutral-800 mt-0">
                  <div className="pt-4 space-y-4">
                    {/* Keywords */}
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-2 block">
                        Keywords
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {cluster.keywords.slice(0, 6).map((keyword) => (
                          <Badge
                            key={keyword}
                            variant="secondary"
                            className="text-[10px] font-normal"
                          >
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Articles */}
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-2 block">
                        Sources ({cluster.articleCount})
                      </span>
                      <div className="space-y-2">
                        {cluster.articles.slice(0, 3).map((article) => (
                          <a
                            key={article.id}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-neutral-800/50 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors group"
                          >
                            <span className="flex-1 text-xs text-gray-600 dark:text-neutral-400 leading-snug line-clamp-2">
                              {article.title}
                            </span>
                            <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
