import { useState, useEffect } from "react";
import { GitBranch, TrendingUp, TrendingDown, Minus, Clock, Users, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NarrativeThread {
  id: string;
  title: string;
  firstSeen: string;
  lastSeen: string;
  durationDays: number;
  clusterIds: string[];
  sentimentArc: number[];
  entities: string[];
  escalation: "rising" | "stable" | "declining";
  status?: "active" | "resolved";
}

function EscalationIcon({ escalation }: { escalation: NarrativeThread["escalation"] }) {
  switch (escalation) {
    case "rising":
      return <TrendingUp className="w-3.5 h-3.5 text-red-500" />;
    case "declining":
      return <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />;
    default:
      return <Minus className="w-3.5 h-3.5 text-gray-400" />;
  }
}

function escalationLabel(e: NarrativeThread["escalation"]): string {
  switch (e) {
    case "rising": return "Escalating";
    case "declining": return "De-escalating";
    default: return "Stable";
  }
}

function escalationColor(e: NarrativeThread["escalation"]): string {
  switch (e) {
    case "rising": return "text-red-500 dark:text-red-400";
    case "declining": return "text-emerald-500 dark:text-emerald-400";
    default: return "text-gray-500 dark:text-neutral-500";
  }
}

/**
 * Mini sentiment arc visualization (text-based sparkline)
 */
function SentimentArc({ arc }: { arc: number[] }) {
  if (arc.length < 2) return null;

  const min = Math.min(...arc);
  const max = Math.max(...arc);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-0.5 h-4">
      {arc.map((val, i) => {
        const height = ((val - min) / range) * 100;
        const color = val >= 0 ? "bg-emerald-400" : "bg-red-400";
        return (
          <div
            key={i}
            className={`w-1.5 rounded-sm ${color}`}
            style={{ height: `${Math.max(15, height)}%` }}
          />
        );
      })}
    </div>
  );
}

function ThreadCard({ thread, isResolved }: { thread: NarrativeThread; isResolved?: boolean }) {
  return (
    <div
      className={`p-4 rounded-xl border ${isResolved
        ? "border-gray-100 dark:border-neutral-800/50 bg-gray-50/50 dark:bg-neutral-900/50 opacity-75"
        : "border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        }`}
    >
      {/* Header: Title + Escalation */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-1">
          <h3 className={`text-sm font-medium leading-tight ${isResolved ? "text-gray-500 dark:text-neutral-500" : "text-gray-800 dark:text-neutral-200"
            }`}>
            {thread.title}
          </h3>
          {isResolved && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-500 shrink-0">
              <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
              Resolved
            </Badge>
          )}
        </div>
        <div className={`flex items-center gap-1 text-xs whitespace-nowrap ${escalationColor(thread.escalation)}`}>
          <EscalationIcon escalation={thread.escalation} />
          {escalationLabel(thread.escalation)}
        </div>
      </div>

      {/* Duration + Dates */}
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-400 dark:text-neutral-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {thread.durationDays} day{thread.durationDays !== 1 ? "s" : ""}
        </span>
        <span>
          {thread.firstSeen} → {thread.lastSeen}
        </span>
      </div>

      {/* Sentiment Arc */}
      {thread.sentimentArc.length >= 2 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">Sentiment:</span>
          <SentimentArc arc={thread.sentimentArc} />
        </div>
      )}

      {/* Entities */}
      {thread.entities.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Users className="w-3 h-3 text-gray-400" />
          {thread.entities.slice(0, 6).map((entity, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"
            >
              {entity}
            </span>
          ))}
          {thread.entities.length > 6 && (
            <span className="text-[10px] text-gray-400">
              +{thread.entities.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function NarrativeTimeline() {
  const [threads, setThreads] = useState<NarrativeThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    const fetchThreads = async () => {
      try {
        const res = await fetch("/api/intelligence/narratives?days=14");
        if (res.ok) {
          const data = await res.json();
          setThreads(data.threads || []);
        }
      } catch (err) {
        console.error("Failed to fetch narratives:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchThreads();
  }, []);

  if (loading) {
    return (
      <div className="py-6 text-center text-gray-400 dark:text-neutral-500 text-sm">
        Loading narrative threads...
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-neutral-500 text-center py-4">
        No multi-day narrative threads detected yet.
      </p>
    );
  }

  // Separate active and resolved threads
  const activeThreads = threads.filter(t => t.status !== 'resolved');
  const resolvedThreads = threads.filter(t => t.status === 'resolved');

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {activeThreads.length > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {activeThreads.length} active
          </Badge>
        )}
        {resolvedThreads.length > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors ml-auto"
          >
            {showResolved ? "Hide" : "Show"} {resolvedThreads.length} resolved
          </button>
        )}
      </div>

      {/* Active threads */}
      <div className="space-y-3">
        {activeThreads.map((thread) => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
      </div>

      {/* Resolved threads (collapsible) */}
      {showResolved && resolvedThreads.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Resolved Stories</p>
          {resolvedThreads.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} isResolved />
          ))}
        </div>
      )}
    </section>
  );
}

