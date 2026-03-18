import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Newspaper,
  Target,
  Activity,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ArticleCluster } from "@/types/intelligence";

interface IntelligenceDashboardProps {
  clusters: ArticleCluster[];
}

// Colors
const COLORS = {
  bullish: "#10b981", // emerald-500
  neutral: "#6b7280", // gray-500
  bearish: "#ef4444", // red-500
  violet: "#8b5cf6", // violet-500
};

export function IntelligenceDashboard({ clusters }: IntelligenceDashboardProps) {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  // Sort and limit clusters
  const sortedClusters = [...clusters]
    .sort((a, b) => b.aggregateImpact - a.aggregateImpact)
    .slice(0, 8);

  // Calculate metrics
  const totalArticles = sortedClusters.reduce((sum, c) => sum + c.articleCount, 0);
  const avgSentiment = sortedClusters.length > 0
    ? sortedClusters.reduce((sum, c) => sum + c.aggregateSentiment, 0) / sortedClusters.length
    : 0;
  const topTopic = sortedClusters[0]?.topic || "N/A";

  // Sentiment distribution for pie chart
  const sentimentCounts = sortedClusters.reduce(
    (acc, c) => {
      if (c.aggregateSentiment > 10) acc.bullish++;
      else if (c.aggregateSentiment < -10) acc.bearish++;
      else acc.neutral++;
      return acc;
    },
    { bullish: 0, neutral: 0, bearish: 0 }
  );

  const pieData = [
    { name: "Positive", value: sentimentCounts.bullish, color: COLORS.bullish },
    { name: "Neutral", value: sentimentCounts.neutral, color: COLORS.neutral },
    { name: "Negative", value: sentimentCounts.bearish, color: COLORS.bearish },
  ].filter(d => d.value > 0);

  // Bar chart data - topic comparison
  const barData = sortedClusters.slice(0, 6).map(c => ({
    name: c.topic.length > 20 ? c.topic.substring(0, 20) + "..." : c.topic,
    fullName: c.topic,
    sentiment: Math.round(c.aggregateSentiment),
    impact: c.aggregateImpact,
    fill: c.aggregateSentiment > 10 ? COLORS.bullish : c.aggregateSentiment < -10 ? COLORS.bearish : COLORS.neutral,
  }));

  // Accessibility: Use shapes + colors (not just colors)
  const getSentimentLabel = (score: number) => {
    if (score > 10) return {
      text: "Positive",
      icon: ArrowUp, // ⬆️ Up arrow for positive
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/20"
    };
    if (score < -10) return {
      text: "Negative",
      icon: ArrowDown, // ⬇️ Down arrow for negative
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/20"
    };
    return {
      text: "Neutral",
      icon: Circle, // ⏺️ Circle for neutral
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-50 dark:bg-neutral-800/50"
    };
  };

  // Contrarian Signal: Find dissenting opinion in predominantly positive/negative clusters
  const findContrarianArticle = (cluster: typeof sortedClusters[0]) => {
    if (!cluster.articles || cluster.articles.length < 3) return null;

    const clusterSentiment = cluster.aggregateSentiment;

    // Only flag contrarian if cluster is strongly positive or negative
    if (Math.abs(clusterSentiment) < 15) return null;

    // Find article with opposite sentiment
    const contrarian = cluster.articles.find(article => {
      const articleSentiment = article.sentiment?.normalizedScore || 0;
      // If cluster is positive (>15), look for negative article (<-5)
      // If cluster is negative (<-15), look for positive article (>5)
      if (clusterSentiment > 15 && articleSentiment < -5) return true;
      if (clusterSentiment < -15 && articleSentiment > 5) return true;
      return false;
    });

    return contrarian || null;
  };

  const overallSentiment = getSentimentLabel(avgSentiment);
  const OverallIcon = overallSentiment.icon;

  if (!clusters || clusters.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-neutral-500">
        No intelligence data available for analysis
      </div>
    );
  }

  return (
    <section data-section="causal" className="space-y-6">
      {/* Article count caption */}
      <p className="text-xs text-gray-400">Based on {totalArticles} articles across {sortedClusters.length} clusters</p>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Total Articles */}
        <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-2 mb-2">
            <Newspaper className="w-4 h-4 text-violet-500" />
            <span className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
              Articles
            </span>
          </div>
          <p className="text-2xl font-semibold text-gray-800 dark:text-neutral-200">
            {totalArticles}
          </p>
          <p className="text-xs text-gray-400 mt-1">analyzed today</p>
        </div>

        {/* Overall Mood */}
        <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-violet-500" />
            <span className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
              Overall Mood
            </span>
          </div>
          <div className="flex items-center gap-2">
            <OverallIcon className={`w-5 h-5 ${overallSentiment.color}`} />
            <p className={`text-xl font-semibold ${overallSentiment.color}`}>
              {overallSentiment.text}
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-1">across all topics</p>
        </div>

        {/* Top Topic */}
        <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-violet-500" />
            <span className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
              Trending
            </span>
          </div>
          <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 line-clamp-2">
            {topTopic}
          </p>
          <p className="text-xs text-gray-400 mt-1">highest impact</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sentiment Distribution Pie Chart */}
        <div className="p-5 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <h3 className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-4">
            Sentiment Distribution
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            How positive or negative is today's news?
          </p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-neutral-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700">
                          <p className="text-sm font-medium">{data.name}</p>
                          <p className="text-xs text-gray-500">{data.value} topics</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-gray-500">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Sentiment Bar Chart */}
        <div className="p-5 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <h3 className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-4">
            Sentiment by Topic
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Which topics are positive vs negative?
          </p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  domain={[-50, 50]}
                  tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-neutral-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 max-w-xs">
                          <p className="text-sm font-medium">{data.fullName}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Sentiment: {data.sentiment > 0 ? "+" : ""}{data.sentiment}
                          </p>
                          <p className="text-xs text-gray-500">
                            Impact: {data.impact}/100
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="sentiment" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-2">
            ← Negative | Positive →
          </p>
        </div>
      </div>

      {/* Topic Details List */}
      <div className="rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-sm font-medium text-gray-700 dark:text-neutral-300">
            Topic Breakdown
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Click any topic to see sources and details
          </p>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-neutral-800">
          {sortedClusters.map((cluster, index) => {
            const isExpanded = expandedTopic === cluster.id;
            const sentiment = getSentimentLabel(cluster.aggregateSentiment);
            const SentimentIcon = sentiment.icon;

            return (
              <div key={cluster.id}>
                <button
                  onClick={() => setExpandedTopic(isExpanded ? null : cluster.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
                >
                  {/* Rank */}
                  <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-medium text-gray-500 flex-shrink-0">
                    {index + 1}
                  </span>

                  {/* Topic Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 truncate">
                      {cluster.topic}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`flex items-center gap-1 text-xs ${sentiment.color}`}>
                        <SentimentIcon className="w-3 h-3" />
                        {sentiment.text}
                      </span>
                      <span className="text-xs text-gray-400">
                        {cluster.articleCount} articles
                      </span>
                    </div>
                  </div>

                  {/* Impact Badge */}
                  <Badge
                    variant="outline"
                    className="text-[10px] flex-shrink-0"
                  >
                    Impact: {cluster.aggregateImpact}
                  </Badge>

                  {/* Chevron */}
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-4 bg-gray-50 dark:bg-neutral-800/30">
                    {/* Contrarian Signal */}
                    {(() => {
                      const contrarian = findContrarianArticle(cluster);
                      if (!contrarian) return null;
                      return (
                        <div className="mb-4 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                              Dissenting Opinion
                            </span>
                          </div>
                          <a
                            href={contrarian.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-amber-800 dark:text-amber-200 hover:underline"
                          >
                            {contrarian.title}
                          </a>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                            This article presents an opposing view to the overall cluster sentiment
                          </p>
                        </div>
                      );
                    })()}

                    {/* Keywords */}
                    <div className="mb-4">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
                        Keywords
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {cluster.keywords.slice(0, 8).map((keyword) => (
                          <span
                            key={keyword}
                            className="px-2 py-0.5 text-xs bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-full text-gray-600 dark:text-neutral-400"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Sources */}
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
                        Sources
                      </p>
                      <div className="space-y-2">
                        {cluster.articles.slice(0, 3).map((article) => (
                          <a
                            key={article.id}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors group"
                          >
                            <span className="flex-1 text-xs text-gray-600 dark:text-neutral-400 leading-relaxed line-clamp-2">
                              {article.title}
                            </span>
                            <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Accessible Legend/Guide - Uses shapes + colors */}
      <div className="text-center py-4 border-t border-gray-100 dark:border-neutral-800">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <ArrowUp className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">Positive</span>
            <span>= Good news</span>
          </span>
          <span className="flex items-center gap-1">
            <Circle className="w-3 h-3 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Neutral</span>
            <span>= Mixed</span>
          </span>
          <span className="flex items-center gap-1">
            <ArrowDown className="w-3 h-3 text-red-500" />
            <span className="text-red-600 dark:text-red-400">Negative</span>
            <span>= Concerning</span>
          </span>
        </div>
      </div>
    </section>
  );
}
