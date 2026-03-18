import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Building2,
  MapPin,
  Hash,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopEntity {
  entity: string;
  entityType: string;
  totalMentions: number;
  avgSentiment: number;
}

interface EntitySentimentPoint {
  entity: string;
  entityType: string;
  date: string;
  avgSentiment: number;
  articleCount: number;
}

const ENTITY_ICONS: Record<string, typeof Users> = {
  person: Users,
  organization: Building2,
  place: MapPin,
  topic: Hash,
};

const ENTITY_COLORS: Record<string, string> = {
  person: "text-blue-500",
  organization: "text-violet-500",
  place: "text-emerald-500",
  topic: "text-amber-500",
};

function getSentimentIndicator(score: number) {
  if (score > 5) return { icon: ArrowUp, color: "text-emerald-500", label: "Positive" };
  if (score < -5) return { icon: ArrowDown, color: "text-red-500", label: "Negative" };
  return { icon: Circle, color: "text-gray-400", label: "Neutral" };
}

export function EntityTimeline() {
  const [entities, setEntities] = useState<TopEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<EntitySentimentPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Fetch top entities
  useEffect(() => {
    const fetchEntities = async () => {
      try {
        const res = await fetch("/api/intelligence/entities/top?limit=10");
        if (res.ok) {
          const data = await res.json();
          setEntities(data.entities || []);
        }
      } catch (err) {
        console.error("Failed to fetch entities:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntities();
  }, []);

  // Fetch timeline when entity selected
  useEffect(() => {
    if (!selectedEntity) {
      setTimeline([]);
      return;
    }

    const fetchTimeline = async () => {
      setTimelineLoading(true);
      try {
        const res = await fetch(
          `/api/intelligence/entity/${encodeURIComponent(selectedEntity)}?days=30`
        );
        if (res.ok) {
          const data = await res.json();
          setTimeline(data.timeline || []);
        }
      } catch (err) {
        console.error("Failed to fetch entity timeline:", err);
      } finally {
        setTimelineLoading(false);
      }
    };
    fetchTimeline();
  }, [selectedEntity]);

  if (loading) {
    return (
      <div className="py-8 text-center text-gray-400 dark:text-neutral-500 text-sm">
        Loading entity data...
      </div>
    );
  }

  if (entities.length === 0) {
    return null; // Don't render section if no entity data
  }

  // Prepare chart data (reverse for chronological order)
  const chartData = [...timeline].reverse().map(point => ({
    date: point.date.slice(5), // MM-DD format
    sentiment: Math.round(point.avgSentiment * 10) / 10,
    articles: point.articleCount,
  }));

  return (
    <section className="space-y-4">
      {/* Subtitle */}
      <p className="text-xs text-gray-400">
        How sentiment around key entities evolves over time
      </p>

      {/* Entity Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {entities.map((entity) => {
          const Icon = ENTITY_ICONS[entity.entityType] || Hash;
          const iconColor = ENTITY_COLORS[entity.entityType] || "text-gray-500";
          const sentiment = getSentimentIndicator(entity.avgSentiment);
          const SentimentIcon = sentiment.icon;
          const isSelected = selectedEntity === entity.entity;

          return (
            <button
              key={entity.entity}
              onClick={() =>
                setSelectedEntity(isSelected ? null : entity.entity)
              }
              className={`p-3 rounded-xl border transition-all text-left ${isSelected
                  ? "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 ring-1 ring-violet-200 dark:ring-violet-800"
                  : "border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-gray-200 dark:hover:border-neutral-700"
                }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3 h-3 ${iconColor}`} />
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {entity.entityType}
                </span>
              </div>
              <p className="text-xs font-medium text-gray-800 dark:text-neutral-200 truncate">
                {entity.entity}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-gray-400">
                  {entity.totalMentions} mentions
                </span>
                <SentimentIcon className={`w-3 h-3 ${sentiment.color}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Timeline Chart (shown when entity selected) */}
      {selectedEntity && (
        <div className="p-5 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                {selectedEntity} - Sentiment Over Time
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Last 30 days
              </p>
            </div>
            <button
              onClick={() => setSelectedEntity(null)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
            >
              Close
            </button>
          </div>

          {timelineLoading ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">
              Loading timeline...
            </div>
          ) : chartData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[-50, 50]}
                    tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-neutral-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700">
                            <p className="text-xs font-medium">{data.date}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Sentiment: {data.sentiment > 0 ? "+" : ""}{data.sentiment}
                            </p>
                            <p className="text-xs text-gray-500">
                              {data.articles} article{data.articles !== 1 ? "s" : ""}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sentiment"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#8b5cf6" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">
              No timeline data available for this entity
            </div>
          )}
        </div>
      )}
    </section>
  );
}
