import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { LiquidGlassButton } from "@/components/ui/liquid-glass";
import { useContent } from "@/hooks/use-content";

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

export default function NewsDetail() {
  const [, params] = useRoute("/news/:date");
  const [newsDay, setNewsDay] = useState<NewsDay | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: content } = useContent();

  // Extract social links from content
  const socialLinks = {
    github: content?.socialLinks?.find((l: any) => l.platform === 'github')?.url,
    linkedin: content?.socialLinks?.find((l: any) => l.platform === 'linkedin')?.url,
    twitter: content?.socialLinks?.find((l: any) => l.platform === 'twitter')?.url,
  };

  useEffect(() => {
    const fetchNews = async () => {
      if (!params?.date) return;

      try {
        const res = await fetch(`/api/news/${params.date}`);
        if (!res.ok) throw new Error("Failed to fetch news");
        const data = await res.json();
        setNewsDay(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [params?.date]);

  const categories = [
    { key: "ai_compute_infra", title: "AI Compute & Infra" },
    { key: "fintech_regtech", title: "FinTech & RegTech" },
    { key: "rpa_enterprise_ai", title: "RPA & Enterprise AI" },
    { key: "semi_supply_chain", title: "Semiconductor Supply Chain" },
    { key: "cybersecurity", title: "Cybersecurity" },
    { key: "geopolitics", title: "Geopolitics" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900">
        <Navigation name={content?.profile?.name || "Portfolio"} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-center justify-center">
            <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-gray-400 rounded-full dark:text-neutral-500" role="status" aria-label="loading">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        </div>
        <Footer name={content?.profile?.name} socialLinks={socialLinks} />
      </div>
    );
  }

  if (!newsDay) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900">
        <Navigation name={content?.profile?.name || "Portfolio"} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-200">News Not Found</h2>
            <p className="text-gray-500 dark:text-neutral-400">
              This news briefing does not exist or has been removed.
            </p>
            <Link href="/news">
              <LiquidGlassButton className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to News
              </LiquidGlassButton>
            </Link>
          </div>
        </div>
        <Footer name={content?.profile?.name} socialLinks={socialLinks} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <Helmet>
        <title>Tech Briefing: {newsDay.date} | {content?.profile?.name || "Portfolio"}</title>
        <meta
          name="description"
          content={newsDay.content.briefing.substring(0, 160)}
        />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={`Tech Briefing: ${newsDay.date}`} />
        <meta
          property="og:description"
          content={newsDay.content.briefing.substring(0, 160)}
        />
        <link rel="icon" type="image/png" href="/uploads/optimized/favicon.webp" />
      </Helmet>

      <Navigation name={content?.profile?.name || "Portfolio"} />

      <main className="pt-10 pb-8">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/news">
              <span className="inline-flex items-center gap-x-1 text-xs text-gray-500 hover:text-gray-800 dark:text-neutral-500 dark:hover:text-neutral-200 cursor-pointer mb-2">
                <ArrowLeft className="size-3" />
                Back to News
              </span>
            </Link>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-neutral-200">
              Tech Briefing
            </h1>
            <time dateTime={newsDay.date} className="text-sm text-gray-600 dark:text-neutral-400">
              {new Date(newsDay.date).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            <div className="flex flex-wrap gap-2 mt-3">
              {categories.map(
                (cat) =>
                  newsDay.content[cat.key as keyof typeof newsDay.content] &&
                  (
                    newsDay.content[cat.key as keyof typeof newsDay.content] as NewsItem[]
                  ).length > 0 && (
                    <Badge key={cat.key} variant="secondary" className="text-xs">
                      {cat.title}
                    </Badge>
                  )
              )}
            </div>
          </div>

          {/* Summary Section */}
          <section className="mb-8">
            <h2 className="text-lg font-medium text-gray-800 dark:text-neutral-200 mb-3">
              Summary
            </h2>
            <div className="text-sm leading-relaxed text-gray-600 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-lg border border-gray-200 dark:border-neutral-700 whitespace-pre-line">
              {newsDay.content.briefing}
            </div>
          </section>

          {/* Category Sections */}
          <div className="space-y-8">
            {categories.map((cat) => {
              const items = newsDay.content[
                cat.key as keyof typeof newsDay.content
              ] as NewsItem[] | undefined;
              return (
                items &&
                items.length > 0 && (
                  <section key={cat.key}>
                    <h2 className="text-lg font-medium text-gray-800 dark:text-neutral-200 border-b border-gray-200 dark:border-neutral-700 pb-2 mb-4">
                      {cat.title}
                    </h2>
                    <div className="grid gap-3">
                      {items.map((item, idx) => (
                        <a
                          key={idx}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block group"
                        >
                          <Card className="p-4 transition-all hover:shadow-sm border border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-800/30">
                            <div className="flex justify-between items-start gap-3 mb-2">
                              <h3 className="font-medium text-sm leading-tight text-gray-800 dark:text-neutral-200 group-hover:text-gray-600 dark:group-hover:text-neutral-300 transition-colors">
                                {item.headline}
                              </h3>
                              <ExternalLink className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-neutral-500">
                              <Badge
                                variant="outline"
                                className="font-mono text-xs h-5 px-1.5 rounded-sm"
                              >
                                {item.ticker}
                              </Badge>
                              <span>{item.source}</span>
                            </div>
                          </Card>
                        </a>
                      ))}
                    </div>
                  </section>
                )
              );
            })}
          </div>
        </div>
      </main>

      <Footer name={content?.profile?.name} socialLinks={socialLinks} />
    </div>
  );
}
