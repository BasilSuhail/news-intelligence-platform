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
  ChevronDown,
  BarChart2,
  Users,
  GitBranch,
  ShieldCheck,
  FileText,
  Layers,
  Zap,
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
import { TerminalTOC, type TocSection } from "@/components/ScrollIndicator";
import {
  IntelligenceDashboard,
  HindsightValidator,
  EntityTimeline,
  AnomalyBanner,
  NarrativeTimeline,
  ExportBriefing,
  TodaySignal,
  WeeklyScorecard,
} from "@/components/intelligence";

// =============================================================================
// TYPES
// =============================================================================

interface EnrichedArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: { normalizedScore: number; label: string };
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
  gprIndex: { current: number; trend: 'rising' | 'falling' | 'stable'; history: any[] };
  marketSentiment: { overall: number; byCategory: Record<string, number>; trend: string };
  isEmpty?: boolean;
}

// =============================================================================
// COLLAPSIBLE SECTION
// =============================================================================

interface CollapsibleSectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  preview?: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({
  id,
  icon,
  title,
  badge,
  open,
  onToggle,
  preview,
  children,
}: CollapsibleSectionProps) {
  return (
    <div
      data-toc-id={id}
      className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-violet-500">{icon}</span>
          <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">{title}</span>
          {badge && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{badge}</Badge>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {preview && !open && (
        <div className="px-5 pb-3 text-xs text-gray-400 dark:text-neutral-500 border-t border-gray-50 dark:border-neutral-800/50">
          {preview}
        </div>
      )}

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-neutral-800">
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function MarketTerminal() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAllClusters, setShowAllClusters] = useState(false);
  const { data: content } = useContent();

  // Lifted accordion state — keyed by section id
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    topicMap: false,
    clusters: false,
    briefing: false,
    entities: true,
    narratives: false,
    validator: false,
    alpha: false,
  });

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Called by TOC when user clicks a collapsed section — auto-expand it
  const handleTocScroll = (id: string) => {
    if (id in expanded && !expanded[id]) {
      setExpanded((prev) => ({ ...prev, [id]: true }));
    }
  };

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
        body: JSON.stringify({ articleId, headline, userCorrection: correction }),
      });
    } catch (e) {
      console.error("Feedback failed:", e);
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 10) return "text-emerald-600 dark:text-emerald-400";
    if (score < -10) return "text-red-600 dark:text-red-400";
    return "text-gray-500 dark:text-neutral-500";
  };

  // Build TOC sections (reactive to expanded state + briefing data)
  const tocSections: TocSection[] = [
    {
      id: "signal",
      label: "Today's Signal",
    },
    {
      id: "metrics",
      label: "Key Metrics",
      badge: briefing ? `GPR ${briefing.gprIndex.current}` : undefined,
    },
    {
      id: "scorecard",
      label: "Weekly Accuracy",
    },
    {
      id: "topicMap",
      label: "Topic Map",
      badge: briefing?.topClusters ? `${briefing.topClusters.length} clusters` : undefined,
      subItems: expanded.topicMap && briefing?.topClusters
        ? briefing.topClusters.slice(0, 5).map(c => c.topic)
        : undefined,
    },
    {
      id: "clusters",
      label: "Clusters",
      badge: briefing?.topClusters ? `${briefing.topClusters.length} topics` : undefined,
      preview: briefing?.topClusters
        ? briefing.topClusters.slice(0, 2).map(c => c.topic).join(" · ")
        : undefined,
      subItems: expanded.clusters && briefing?.topClusters
        ? briefing.topClusters.slice(0, 6).map(c =>
          `${c.aggregateSentiment > 10 ? "↑" : c.aggregateSentiment < -10 ? "↓" : "–"} ${c.topic}`
        )
        : undefined,
    },
    {
      id: "briefing",
      label: "Executive Briefing",
      badge: "Gemini Pro",
      subItems: expanded.briefing && briefing
        ? [briefing.executiveSummary.split(" ").slice(0, 12).join(" ") + "…"]
        : undefined,
    },
    {
      id: "entities",
      label: "Entity Tracker",
    },
    {
      id: "narratives",
      label: "Developing Stories",
    },
    {
      id: "validator",
      label: "Hindsight Validator",
      badge: "Backtesting",
    },
    {
      id: "alpha",
      label: "Alpha & Risks",
    },
  ];

  const expandedIds = new Set(
    Object.entries(expanded)
      .filter(([, v]) => v)
      .map(([k]) => k)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block size-8 border-[3px] border-current border-t-transparent text-violet-500 rounded-full mb-4" />
          <p className="text-sm text-gray-500 dark:text-neutral-500">Decrypting Market Signals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Reactive Table of Contents */}
      <TerminalTOC
        sections={tocSections}
        expandedIds={expandedIds}
        onScrollTo={handleTocScroll}
      />

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
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-3xl font-semibold text-gray-800 dark:text-neutral-200">
              Terminal Alpha
            </h1>
            <Badge variant="outline" className="border-violet-500/30 text-violet-600 dark:text-violet-400">
              MODULAR v2
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-neutral-400">
            Real-time intelligence pipeline: Sentiment, Clustering, and GPR Analytics
          </p>
        </div>

        {error && (
          <div className="text-center py-10 border border-red-200 rounded-xl bg-red-50 dark:border-red-800 dark:bg-red-900/20 mb-8">
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
              <Button variant="outline" className="mt-6">Go to News Page to Sync</Button>
            </Link>
          </div>
        )}

        {briefing && !briefing.isEmpty && (
          <div className="space-y-4">

            {/* ── ALWAYS VISIBLE: Today's Signal ── */}
            <div data-toc-id="signal">
              <TodaySignal />
            </div>

            {/* ── ALWAYS VISIBLE: Anomaly Banner ── */}
            <AnomalyBanner />

            {/* ── ALWAYS VISIBLE: Key Metrics ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-toc-id="metrics">
              <GPRGauge score={briefing.gprIndex.current} trend={briefing.gprIndex.trend} />

              <div className="p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-3">
                  Market Sentiment
                </h3>
                <div className="flex items-end gap-3 mb-3">
                  <span className={`text-4xl font-light tabular-nums ${getScoreColor(briefing.marketSentiment.overall)}`}>
                    {briefing.marketSentiment.overall > 0 ? "+" : ""}{briefing.marketSentiment.overall.toFixed(2)}
                  </span>
                  <p className={`text-xs font-medium uppercase tracking-tight pb-1 ${getScoreColor(briefing.marketSentiment.overall)}`}>
                    {briefing.marketSentiment.trend}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                    <span>Bearish</span><span>Bullish</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-1000 ${briefing.marketSentiment.overall > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{
                        width: `${Math.abs(briefing.marketSentiment.overall)}%`,
                        marginLeft: briefing.marketSentiment.overall > 0 ? '50%' : `${50 - Math.abs(briefing.marketSentiment.overall)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── ALWAYS VISIBLE: Weekly Scorecard ── */}
            <div data-toc-id="scorecard">
              <WeeklyScorecard />
            </div>

            {/* ─────────────────────────────────────
                COLLAPSIBLE SECTIONS
            ───────────────────────────────────── */}

            {/* Topic Intelligence Map */}
            {briefing.topClusters && briefing.topClusters.length > 0 && (
              <CollapsibleSection
                id="topicMap"
                icon={<BarChart2 className="w-4 h-4" />}
                title="Topic Intelligence Map"
                badge={`${briefing.topClusters.length} clusters`}
                open={expanded.topicMap}
                onToggle={() => toggle("topicMap")}
                preview={
                  <span>
                    Top topic: <span className="text-gray-600 dark:text-neutral-400">{briefing.topClusters[0]?.topic}</span>
                  </span>
                }
              >
                <IntelligenceDashboard clusters={briefing.topClusters} />
              </CollapsibleSection>
            )}

            {/* Intelligence Clusters */}
            <CollapsibleSection
              id="clusters"
              icon={<Layers className="w-4 h-4" />}
              title="Intelligence Clusters"
              badge={`${briefing.topClusters.length} topics`}
              open={expanded.clusters}
              onToggle={() => toggle("clusters")}
              preview={
                <span>
                  {briefing.topClusters.slice(0, 2).map(c => c.topic).join(" · ")}
                  {briefing.topClusters.length > 2 ? ` · +${briefing.topClusters.length - 2} more` : ""}
                </span>
              }
            >
              <div className="space-y-3 pt-2">
                {(showAllClusters ? briefing.topClusters : briefing.topClusters.slice(0, 3)).map((cluster) => (
                  <div key={cluster.id} className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 hover:border-violet-500/20 transition-all bg-white dark:bg-neutral-900 overflow-hidden group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${cluster.aggregateSentiment > 10 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            cluster.aggregateSentiment < -10 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-400'
                            }`}>
                            {cluster.aggregateSentiment > 10 ? 'Bullish' : cluster.aggregateSentiment < -10 ? 'Bearish' : 'Neutral'}
                          </span>
                          <span className="text-[10px] text-gray-400">Impact: {cluster.aggregateImpact}/100</span>
                        </div>
                        <h3 className="text-sm font-medium text-gray-800 dark:text-neutral-200 leading-tight">{cluster.topic}</h3>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Cluster Analysis: {cluster.topic}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6 mt-4">
                            <div className="flex flex-wrap gap-2">
                              {cluster.keywords.slice(0, 8).map(k => (
                                <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                              ))}
                            </div>
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
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cluster.keywords.slice(0, 4).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded dark:bg-neutral-800/50 dark:text-neutral-500 border border-gray-100 dark:border-neutral-800">
                          {tag}
                        </span>
                      ))}
                      <span className="text-[10px] px-1.5 py-0.5 text-violet-400 font-medium">+{cluster.articleCount - 4} sources</span>
                    </div>
                  </div>
                ))}
                {briefing.topClusters.length > 3 && (
                  <button
                    onClick={() => setShowAllClusters(!showAllClusters)}
                    className="w-full py-2.5 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-300 border border-gray-200 dark:border-neutral-800 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-all"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllClusters ? "rotate-180" : ""}`} />
                    {showAllClusters ? "Show Less" : `Show ${briefing.topClusters.length - 3} More Clusters`}
                  </button>
                )}
              </div>
            </CollapsibleSection>

            {/* Executive Briefing */}
            <CollapsibleSection
              id="briefing"
              icon={<FileText className="w-4 h-4" />}
              title="Executive Briefing"
              badge="Gemini Pro"
              open={expanded.briefing}
              onToggle={() => toggle("briefing")}
              preview={
                <span className="line-clamp-1">
                  {briefing.executiveSummary.split('\n\n')[0]?.slice(0, 120)}…
                </span>
              }
            >
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400">AI-generated market analysis</span>
                  <ExportBriefing date={briefing.date} />
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-neutral-400 leading-relaxed bg-gray-50/50 dark:bg-neutral-800/30 p-5 rounded-xl border border-gray-100 dark:border-neutral-800/50">
                  {briefing.executiveSummary.split('\n\n').map((para, i) => (
                    <p key={i} className="mb-3 last:mb-0">{para}</p>
                  ))}
                </div>
              </div>
            </CollapsibleSection>

            {/* Entity Sentiment Tracker */}
            <CollapsibleSection
              id="entities"
              icon={<Users className="w-4 h-4" />}
              title="Entity Sentiment Tracker"
              open={expanded.entities}
              onToggle={() => toggle("entities")}
            >
              <div className="pt-2">
                <EntityTimeline />
              </div>
            </CollapsibleSection>

            {/* Developing Stories */}
            <CollapsibleSection
              id="narratives"
              icon={<GitBranch className="w-4 h-4" />}
              title="Developing Stories"
              open={expanded.narratives}
              onToggle={() => toggle("narratives")}
            >
              <div className="pt-2">
                <NarrativeTimeline />
              </div>
            </CollapsibleSection>

            {/* Hindsight Validator */}
            <CollapsibleSection
              id="validator"
              icon={<ShieldCheck className="w-4 h-4" />}
              title="Hindsight Validator"
              badge="Backtesting"
              open={expanded.validator}
              onToggle={() => toggle("validator")}
            >
              <div className="pt-2">
                <HindsightValidator />
              </div>
            </CollapsibleSection>

            {/* Strategic Alpha & Risks */}
            <CollapsibleSection
              id="alpha"
              icon={<Zap className="w-4 h-4" />}
              title="Strategic Alpha & Risks"
              open={expanded.alpha}
              onToggle={() => toggle("alpha")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" /> Strategic Alpha
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-500 leading-relaxed italic border-l-2 border-emerald-500/20 pl-3">
                    "Bullish sentiment in semiconductor supply chains suggests inventory normalization is ahead of expectations."
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> Systemic Threats
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-500 leading-relaxed italic border-l-2 border-red-500/20 pl-3">
                    "Geopolitical escalation in the South China Sea presents a medium-term risk to global compute infrastructure cost basis."
                  </p>
                </div>
              </div>
            </CollapsibleSection>

          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
