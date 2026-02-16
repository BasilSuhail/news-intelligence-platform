import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { CalendarDays, RefreshCw, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { secureFetch } from "@/lib/csrf";
import { useToast } from "@/hooks/use-toast";

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
  };
}

export function NewsSection() {
  const { toast } = useToast();
  const [news, setNews] = useState<NewsDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const loadNews = async () => {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("Failed to fetch news");
      const data = await res.json();
      setNews(data.news || []);
      setIsVisible(data.visible !== false);
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
    toast({
      title: "Syncing news...",
      description: "Fetching the latest updates. This may take a moment.",
    });

    try {
      // Trigger news scrape on backend
      // Using standard fetch since we disabled CSRF for this specific endpoint to ensure reliability
      const res = await fetch("/api/news/refresh", {
        method: "POST",
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to refresh news data");
      }
      
      // Reload news after successful scrape
      await loadNews();
      
      toast({
        title: "News synced!",
        description: "Latest headlines have been loaded.",
      });
    } catch (e: any) {
      console.error("Refresh failed:", e);
      toast({
        title: "Sync failed",
        description: e.message || "Could not update news feed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const checkScrollButtons = () => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (sliderRef.current) {
      const cardWidth = 280;
      const scrollAmount = direction === "left" ? -cardWidth : cardWidth;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  useEffect(() => {
    checkScrollButtons();
    const slider = sliderRef.current;
    if (slider) {
      slider.addEventListener("scroll", checkScrollButtons);
      window.addEventListener("resize", checkScrollButtons);
      return () => {
        slider.removeEventListener("scroll", checkScrollButtons);
        window.removeEventListener("resize", checkScrollButtons);
      };
    }
  }, [news]);

  if (loading || error || !isVisible || news.length === 0) {
    return null;
  }

  const displayedNews = news.slice(0, 7);

  return (
    <section className="mt-10 sm:mt-14" data-section="news">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-gray-800 dark:text-neutral-200">
            Tech News
          </h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="py-1.5 px-3 inline-flex items-center gap-x-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-800 focus:outline-none disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-200"
          >
            <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">
              {refreshing ? "Syncing..." : "Sync"}
            </span>
          </button>
        </div>

        {/* Slider container */}
        <div className="relative">
          {/* Left scroll button */}
          <button
            className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 size-8 flex items-center justify-center bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:hover:bg-neutral-800 hidden sm:flex ${!canScrollLeft ? "invisible" : ""}`}
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="size-4 text-gray-600 dark:text-neutral-400" />
          </button>

          {/* Scrollable news cards */}
          <div
            ref={sliderRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {displayedNews.map((day) => (
              <Link key={day.date} href={`/news/${day.date}`}>
                <div
                  className="group flex-shrink-0 w-[220px] sm:w-[260px] p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer dark:border-neutral-700 dark:hover:border-neutral-600"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <CalendarDays className="size-4 text-gray-400 group-hover:text-gray-600 dark:text-neutral-500 dark:group-hover:text-neutral-400" />
                    <span className="text-xs text-gray-500 dark:text-neutral-500">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-800 dark:text-neutral-200 mb-2">
                    {new Date(day.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </h3>

                  <p className="text-xs text-gray-600 dark:text-neutral-400 line-clamp-3 mb-3">
                    {day.content.briefing}
                  </p>

                  <span className="inline-flex items-center gap-x-1 text-xs text-gray-500 group-hover:text-gray-800 dark:text-neutral-500 dark:group-hover:text-neutral-200">
                    Read more
                    <ArrowRight className="size-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Right scroll button */}
          <button
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 size-8 flex items-center justify-center bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700 dark:hover:bg-neutral-800 hidden sm:flex ${!canScrollRight ? "invisible" : ""}`}
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
          >
            <ChevronRight className="size-4 text-gray-600 dark:text-neutral-400" />
          </button>
        </div>

        {/* Scroll indicators for mobile */}
        <div className="flex justify-center gap-1 mt-4 sm:hidden">
          {displayedNews.map((day) => (
            <div
              key={day.date}
              className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-neutral-600"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
