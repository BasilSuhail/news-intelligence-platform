import { useState, useEffect } from "react";
import { Zap, TrendingUp, TrendingDown, Minus, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SignalData {
    signal: string;
    sentiment: "bullish" | "bearish" | "neutral";
    confidence: "high" | "medium" | "low";
    keyMetric: string;
    timestamp: string;
}

const sentimentConfig = {
    bullish: {
        icon: TrendingUp,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        border: "border-emerald-200 dark:border-emerald-800/50",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    bearish: {
        icon: TrendingDown,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-900/20",
        border: "border-red-200 dark:border-red-800/50",
        badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    neutral: {
        icon: Minus,
        color: "text-gray-600 dark:text-neutral-400",
        bg: "bg-gray-50 dark:bg-neutral-800/30",
        border: "border-gray-200 dark:border-neutral-700",
        badge: "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-400",
    },
};

const confidenceColors: Record<string, string> = {
    high: "text-emerald-500",
    medium: "text-amber-500",
    low: "text-gray-400",
};

export function TodaySignal() {
    const [signal, setSignal] = useState<SignalData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSignal = async () => {
            try {
                const res = await fetch("/api/intelligence/signal");
                if (res.ok) {
                    const data = await res.json();
                    setSignal(data);
                }
            } catch (err) {
                console.error("Failed to fetch signal:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSignal();
    }, []);

    if (loading) {
        return (
            <div className="py-4 text-center text-gray-400 dark:text-neutral-500 text-sm">
                Loading signal...
            </div>
        );
    }

    if (!signal) return null;

    const config = sentimentConfig[signal.sentiment];
    const SentimentIcon = config.icon;

    return (
        <div className={`p-4 rounded-2xl border ${config.border} ${config.bg}`}>
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-lg ${config.badge}`}>
                    <Zap className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">
                            Today's Signal
                        </span>
                        <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${config.badge}`}>
                            <SentimentIcon className="w-2.5 h-2.5 mr-0.5" />
                            {signal.sentiment}
                        </Badge>
                        <span className={`text-[10px] flex items-center gap-0.5 ${confidenceColors[signal.confidence]}`}>
                            <Shield className="w-2.5 h-2.5" />
                            {signal.confidence} confidence
                        </span>
                    </div>
                    <p className={`text-sm font-medium ${config.color} leading-relaxed`}>
                        {signal.signal}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                        <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                            Key: {signal.keyMetric}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
