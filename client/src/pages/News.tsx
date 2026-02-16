import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { RefreshCw, ArrowLeft, ArrowRight, Activity, ChevronDown } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ScrollIndicator } from "@/components/ScrollIndicator";
import { useContent } from "@/hooks/use-content";
import { LiquidGlassButton } from "@/components/ui/liquid-glass";

interface NewsItem {
  ticker: string;
  headline: string;
  url: string;
  source: string;
}

interface NewsDay {
  date: string;
  content: {
    briefing: string;
    ai_compute_infra?: NewsItem[];
    fintech_regtech?: NewsItem[];
    rpa_enterprise_ai?: NewsItem[];
    semi_supply_chain?: NewsItem[];
    cybersecurity?: NewsItem[];
    geopolitics?: NewsItem[];
  };
}

const filterOptions = [
  { label: "All Time", days: null },
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
];

const ITEMS_PER_PAGE = 10;

// Static sections removed, dynamic sections generated in component


export default function News() {
  const [news, setNews] = useState<NewsDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(filterOptions[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const { data: content } = useContent();

  const loadNews = async () => {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("Failed to fetch news");
      const data = await res.json();
      setNews(data.news || []);
      setError(false);
    } catch (e) {
      console.error("News fetch error:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const refreshRes = await fetch("/api/news/refresh", { method: "POST" });
      if (!refreshRes.ok) {
        const errorData = await refreshRes.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to sync news");
      }
      await loadNews();
    } catch (e) {
      console.error("Refresh failed:", e);
      setError(true);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [selectedFilter]);

  // Filter news by selected filter
  const filteredNews = useMemo(() => {
    if (!selectedFilter.days) return news;
    return news.slice(0, selectedFilter.days);
  }, [news, selectedFilter]);

  // Get visible news based on pagination
  const visibleNews = useMemo(() => {
    return filteredNews.slice(0, visibleCount);
  }, [filteredNews, visibleCount]);

  const hasMoreItems = visibleCount < filteredNews.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  };

  // Generate dynamic sections for scroller
  const newsSections = useMemo(() => {
    const sections = [{ id: "header", label: "Top" }];

    if (visibleNews.length > 0) {
      sections.push({ id: "featured", label: "Briefing" });

      // Add a section for each subsequent news item (starting from index 1)
      visibleNews.slice(1).forEach((day) => {
        const date = new Date(day.date);
        const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        sections.push({
          id: `news-${day.date}`,
          label: label
        });
      });
    }

    return sections;
  }, [visibleNews]);

  // Extract social links from content
  const socialLinks = {
    github: content?.socialLinks?.find((l: any) => l.platform === 'github')?.url,
    linkedin: content?.socialLinks?.find((l: any) => l.platform === 'linkedin')?.url,
    twitter: content?.socialLinks?.find((l: any) => l.platform === 'twitter')?.url,
  };

  // Get category from news day for display
  const getCategory = (day: NewsDay) => {
    if (day.content.ai_compute_infra?.length) return "AI";
    if (day.content.fintech_regtech?.length) return "Fintech";
    if (day.content.semi_supply_chain?.length) return "Semiconductors";
    if (day.content.cybersecurity?.length) return "Cybersecurity";
    if (day.content.geopolitics?.length) return "Geopolitics";
    if (day.content.rpa_enterprise_ai?.length) return "Enterprise AI";
    return "Tech";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-gray-400 rounded-full dark:text-neutral-500" role="status" aria-label="loading">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <ScrollIndicator sections={newsSections} />
      <Navigation name={content?.profile?.name || "Portfolio"} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        {/* Back Link */}
        <Link href="/">
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors mb-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </span>
        </Link>

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8" data-section="header">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800 dark:text-neutral-200 mb-2">Tech News</h1>
            <p className="text-gray-600 dark:text-neutral-400">
              Daily briefings on AI, fintech, semiconductors, and cybersecurity
            </p>
          </div>

          {/* Action Buttons - Liquid Glass Preserved */}
          <div className="flex items-center gap-2">
            <Link href="/market-terminal">
              <LiquidGlassButton size="sm">
                <Activity className="size-4" />
                Intelligence
              </LiquidGlassButton>
            </Link>
            <LiquidGlassButton
              onClick={handleRefresh}
              disabled={refreshing}
              size="sm"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Syncing..." : "Sync"}
            </LiquidGlassButton>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-neutral-700 mb-8">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors"
            >
              <span>{selectedFilter.label}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 min-w-[140px]">
                {filterOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => {
                      setSelectedFilter(option);
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-sm text-gray-500 dark:text-neutral-500">
            {visibleNews.length} of {filteredNews.length} briefings
          </span>
        </div>

        {/* Error State */}
        {error && (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-neutral-500">Failed to load news. Please try again.</p>
          </div>
        )}

        {/* Featured / Latest Article */}
        {!error && visibleNews.length > 0 && (
          <>
            <article className="mb-10" data-section="featured">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                  {getCategory(visibleNews[0])}
                </span>
                <span className="text-xs text-gray-500 dark:text-neutral-500">
                  {new Date(visibleNews[0].date).toLocaleDateString("en-US", { weekday: "long" })} · {new Date(visibleNews[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <h2 className="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-2 leading-snug">
                Daily Tech Briefing
              </h2>
              <p className="text-gray-600 dark:text-neutral-400 mb-4 leading-relaxed">
                {visibleNews[0].content.briefing}
              </p>
              <Link href={`/news/${visibleNews[0].date}`}>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-neutral-200 hover:text-gray-600 dark:hover:text-neutral-400 transition-colors cursor-pointer">
                  Read briefing
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </article>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-neutral-700 mb-8" />

            {/* News List */}
            <div className="space-y-0">
              {visibleNews.slice(1).map((day, index) => (
                <article
                  key={day.date}
                  data-section={`news-${day.date}`}
                  className={`py-6 ${index !== visibleNews.slice(1).length - 1 ? "border-b border-gray-200 dark:border-neutral-700" : ""
                    }`}
                >
                  <Link href={`/news/${day.date}`}>
                    <div className="flex items-start justify-between gap-6 cursor-pointer group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                            {getCategory(day)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-neutral-500">
                            {new Date(day.date).toLocaleDateString("en-US", { weekday: "long" })}
                          </span>
                        </div>
                        <h3 className="text-base font-medium text-gray-800 dark:text-neutral-200 mb-1.5 leading-snug group-hover:text-gray-600 dark:group-hover:text-neutral-400 transition-colors">
                          Daily Tech Briefing
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed line-clamp-2">
                          {day.content.briefing}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="text-xs text-gray-500 dark:text-neutral-500">
                          {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>

            {/* Load More */}
            {hasMoreItems && (
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-neutral-700">
                <button
                  onClick={handleLoadMore}
                  className="text-sm text-gray-500 dark:text-neutral-500 hover:text-gray-800 dark:hover:text-neutral-200 transition-colors"
                >
                  Load more briefings ({filteredNews.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!error && visibleNews.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-neutral-500">
              No news available yet.
            </p>
          </div>
        )}
      </main>

      <Footer
        name={content?.profile?.name}
        socialLinks={socialLinks}
      />
    </div>
  );
}
