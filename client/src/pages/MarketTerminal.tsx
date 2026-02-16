import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Info,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Target,
  AlertTriangle,
  ChevronDown
} from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useContent } from "@/hooks/use-content";
import { GPRGauge } from "@/components/GPRGauge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollIndicator } from "@/components/ScrollIndicator";
import {
  IntelligenceDashboard,
  HindsightValidator,
  EntityTimeline,
  AnomalyBanner,
  NarrativeTimeline,
  ExportBriefing,
} from "@/components/intelligence";

// =============================================================================
// TYPES (Updated for Modular Intelligence)
// =============================================================================

interface EnrichedArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: {
    normalizedScore: number;
    label: string;
  };
  impactScore: number;
  geoTags: string[];
  topics: string[];
}

interface ArticleCluster {
  id: string;
  topic: string;
  keywords: string[];
  articles: EnrichedArticle[];
  aggregateSentiment: number;
  aggregateImpact: number;
  articleCount: number;
  categories: string[];
}

interface DailyBriefing {
  date: string;
  executiveSummary: string;
  topClusters: ArticleCluster[];
  gprIndex: {
    current: number;
    trend: 'rising' | 'falling' | 'stable';
    history: any[];
  };
  marketSentiment: {
    overall: number;
    byCategory: Record<string, number>;
    trend: string;
  };
  isEmpty?: boolean;
}

const terminalSections = [
  { id: "header", label: "Terminal" },
  { id: "metrics", label: "Metrics" },
  { id: "causal", label: "Topics" },
  { id: "analysis", label: "Analysis" },
  { id: "entities", label: "Entities" },
  { id: "validation", label: "Validation" },
  { id: "clusters", label: "Clusters" },
  { id: "risks", label: "Risks" },
];

export default function MarketTerminal() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAllClusters, setShowAllClusters] = useState(false);
  const { data: content } = useContent();

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch("/api/intelligence/analysis");
        if (!res.ok) throw new Error("Failed to fetch intelligence analysis");
        const data = await res.json();
        setBriefing(data);
        setError(false);
      } catch (e) {
        console.error("Intelligence fetch error:", e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleFeedback = async (articleId: string, headline: string, correction: 'positive' | 'negative' | 'neutral') => {
    try {
      await fetch("/api/feedback/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, headline, userCorrection: correction })
      });
      // In a real app, we'd show a toast here
    } catch (e) {
      console.error("Feedback failed:", e);
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 10) return "text-emerald-600 dark:text-emerald-400";
    if (score < -10) return "text-red-600 dark:text-red-400";
    return "text-gray-500 dark:text-neutral-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block size-8 border-[3px] border-current border-t-transparent text-violet-500 rounded-full mb-4" />
          <p className="text-sm text-gray-500 dark:text-neutral-500">Decrypting Market Signals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <ScrollIndicator sections={terminalSections} />
      <Navigation name={content?.profile?.name || "Portfolio"} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
        {/* Back Link */}
        <Link href="/news">
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors mb-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Back to News
          </span>
        </Link>

        {/* Header */}
        <div className="mb-10" data-section="header">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold text-gray-800 dark:text-neutral-200">
              Terminal Alpha
            </h1>
            <Badge variant="outline" className="border-violet-500/30 text-violet-600 dark:text-violet-400">
              MODULAR v2
            </Badge>
          </div>
          <p className="text-gray-600 dark:text-neutral-400">
            Real-time intelligence pipeline: Sentiment, Clustering, and GPR Analytics
          </p>
        </div>

        {error && (
          <div className="text-center py-10 border border-red-200 rounded-xl bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-gray-700 dark:text-neutral-300">Failed to load intelligence data.</p>
            <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Try running a manual sync from the News page.</p>
          </div>
        )}

        {briefing?.isEmpty && (
          <div className="text-center py-16 border border-amber-200 rounded-xl bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-700 dark:text-neutral-300 font-medium">No Intelligence Data Yet</p>
            <p className="text-sm text-gray-500 dark:text-neutral-500 mt-2 max-w-md mx-auto">
              {briefing.executiveSummary}
            </p>
            <Link href="/news">
              <Button variant="outline" className="mt-6">
                Go to News Page to Sync
              </Button>
            </Link>
          </div>
        )}

        {briefing && !briefing.isEmpty && (
          <div className="space-y-12">
            {/* Anomaly Alert Banner */}
            <AnomalyBanner />

            {/* Top Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-section="metrics">
              <GPRGauge
                score={briefing.gprIndex.current}
                trend={briefing.gprIndex.trend}
              />

              <div className="p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
                <h3 className="text-sm font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-4">
                  Market Sentiment
                </h3>
                <div className="flex items-end gap-4 mb-4">
                  <span className={`text-5xl font-light tabular-nums ${getScoreColor(briefing.marketSentiment.overall)}`}>
                    {briefing.marketSentiment.overall > 0 ? "+" : ""}{briefing.marketSentiment.overall.toFixed(2)}
                  </span>
                  <div className="pb-1.5">
                    <p className={`text-sm font-medium uppercase tracking-tight ${getScoreColor(briefing.marketSentiment.overall)}`}>
                      {briefing.marketSentiment.trend}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                    <span>Bearish</span>
                    <span>Bullish</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-1000 ${briefing.marketSentiment.overall > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{
                        width: `${Math.abs(briefing.marketSentiment.overall)}%`,
                        marginLeft: briefing.marketSentiment.overall > 0 ? '50%' : `${50 - Math.abs(briefing.marketSentiment.overall)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Causal Intelligence Map */}
            {briefing.topClusters && briefing.topClusters.length > 0 && (
              <IntelligenceDashboard clusters={briefing.topClusters} />
            )}

            {/* Entity Sentiment Tracker */}
            <div data-section="entities">
              <EntityTimeline />
            </div>

            {/* Developing Stories (Narrative Threading) */}
            <NarrativeTimeline />

            {/* Hindsight Validator */}
            <div data-section="validation">
              <HindsightValidator />
            </div>

            {/* AI Executive Summary */}
            <section data-section="analysis">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-800 dark:text-neutral-200 flex items-center gap-2">
                  Executive Briefing
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">Gemini Pro</Badge>
                </h2>
                <ExportBriefing date={briefing.date} />
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-neutral-400 leading-relaxed bg-gray-50/50 dark:bg-neutral-800/30 p-6 rounded-2xl border border-gray-100 dark:border-neutral-800/50">
                {briefing.executiveSummary.split('\n\n').map((para, i) => (
                  <p key={i} className="mb-4 last:mb-0">{para}</p>
                ))}
              </div>
            </section>

            {/* Trending Topics (Clusters) */}
            <section data-section="clusters">
              <h2 className="text-lg font-medium text-gray-800 dark:text-neutral-200 mb-6 flex items-center justify-between">
                <span>Top Intelligence Clusters</span>
                <span className="text-xs font-normal text-gray-500">Sorted by Impact Score</span>
              </h2>

              <div className="space-y-4">
                {(showAllClusters ? briefing.topClusters : briefing.topClusters.slice(0, 2)).map((cluster) => (
                  <div key={cluster.id} className="p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 hover:border-violet-500/20 transition-all bg-white dark:bg-neutral-900 shadow-sm overflow-hidden group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${cluster.aggregateSentiment > 10 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            cluster.aggregateSentiment < -10 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-400'
                            }`}>
                            {cluster.aggregateSentiment > 10 ? 'Bullish' : cluster.aggregateSentiment < -10 ? 'Bearish' : 'Neutral'}
                          </span>
                          <span className="text-xs text-gray-400">Impact Score: {cluster.aggregateImpact}/100</span>
                        </div>
                        <h3 className="text-md font-medium text-gray-800 dark:text-neutral-200 leading-tight">
                          {cluster.topic}
                        </h3>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <Info className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Cluster Analysis: {cluster.topic}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6 mt-4">
                            {/* Keywords & Tags */}
                            <div className="flex flex-wrap gap-2">
                              {cluster.keywords.slice(0, 8).map(k => (
                                <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                              ))}
                            </div>

                            {/* Weighted Articles List */}
                            <div className="space-y-4">
                              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Contributing Reports</h4>
                              {cluster.articles.map(article => (
                                <div key={article.id} className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800">
                                  <div className="flex items-start justify-between gap-4 mb-2">
                                    <p className="text-sm font-medium text-gray-800 dark:text-neutral-200">{article.title}</p>
                                    <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback(article.id, article.title, 'positive')}><ThumbsUp className="h-3 w-3" /></Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback(article.id, article.title, 'negative')}><ThumbsDown className="h-3 w-3" /></Button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500 uppercase">{article.source}</span>
                                    <a href={article.url} target="_blank" rel="noopener" className="text-[10px] text-violet-500 flex items-center gap-1">
                                      Verify Source <ExternalLink className="h-2 w-2" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {cluster.keywords.slice(0, 4).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded-lg dark:bg-neutral-800/50 dark:text-neutral-500 border border-gray-100 dark:border-neutral-800">
                          {tag}
                        </span>
                      ))}
                      <span className="text-[10px] px-2 py-0.5 text-violet-400 font-medium">+{cluster.articleCount - 4} sources</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Show More/Less Button */}
              {briefing.topClusters.length > 2 && (
                <button
                  onClick={() => setShowAllClusters(!showAllClusters)}
                  className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-300 border border-gray-200 dark:border-neutral-800 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-all"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAllClusters ? "rotate-180" : ""}`} />
                  {showAllClusters ? "Show Less" : `Show ${briefing.topClusters.length - 2} More Clusters`}
                </button>
              )}
            </section>

            {/* Opportunities & Risks (High-level Placeholders) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-100 dark:border-neutral-800" data-section="risks">
              <div>
                <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Strategic Alpha
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-500 leading-relaxed italic border-l-2 border-emerald-500/20 pl-4">
                  "Bullish sentiment in semiconductor supply chains suggests inventory normalization is ahead of expectations."
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Systemic Threats
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-500 leading-relaxed italic border-l-2 border-red-500/20 pl-4">
                  "Geopolitical escalation in the South China Sea presents a medium-term risk to global compute infrastructure cost basis."
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
