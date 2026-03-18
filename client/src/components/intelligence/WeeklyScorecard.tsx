import { useState, useEffect } from "react";
import { ClipboardCheck, Award, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WeeklyReport {
    weekStart: string;
    weekEnd: string;
    directionAccuracy: number;
    pearsonR: number;
    spearmanR: number;
    sampleSize: number;
    avgSentiment: number;
    avgReturn: number;
    grade: string;
}

const gradeColors: Record<string, string> = {
    'A': 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50',
    'B': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50',
    'C': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
    'D': 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50',
    'F': 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50',
    'N/A': 'text-gray-500 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-800/30 border-gray-200 dark:border-neutral-700',
};

export function WeeklyScorecard() {
    const [report, setReport] = useState<WeeklyReport | null>(null);
    const [history, setHistory] = useState<WeeklyReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [scoreRes, historyRes] = await Promise.all([
                    fetch("/api/intelligence/scorecard"),
                    fetch("/api/intelligence/scorecard/history")
                ]);

                if (scoreRes.ok) {
                    const data = await scoreRes.json();
                    setReport(data);
                }
                if (historyRes.ok) {
                    const data = await historyRes.json();
                    setHistory(data.history || []);
                }
            } catch (err) {
                console.error("Failed to fetch scorecard:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const generateScorecard = async () => {
        setGenerating(true);
        try {
            const res = await fetch("/api/intelligence/scorecard?refresh=true");
            if (res.ok) {
                const data = await res.json();
                setReport(data);
            }
        } catch (err) {
            console.error("Failed to generate scorecard:", err);
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="py-4 text-center text-gray-400 dark:text-neutral-500 text-sm">
                Loading scorecard...
            </div>
        );
    }

    const hasData = report && report.sampleSize > 0;

    return (
        <div className="p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-violet-500" />
                    <h3 className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                        Weekly Accuracy
                    </h3>
                    {hasData && (
                        <span className="text-[10px] text-gray-400">
                            {report.weekStart} – {report.weekEnd}
                        </span>
                    )}
                </div>
                <button
                    onClick={generateScorecard}
                    disabled={generating}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-2.5 h-2.5 ${generating ? "animate-spin" : ""}`} />
                    {generating ? "..." : "Refresh"}
                </button>
            </div>

            {!hasData ? (
                <p className="text-xs text-gray-400 dark:text-neutral-500 text-center py-3">
                    No scorecard data yet. Click Refresh to generate this week's accuracy report.
                </p>
            ) : (
                <div className="flex items-center gap-6">
                    {/* Grade */}
                    <div className={`flex items-center justify-center w-14 h-14 rounded-xl border text-2xl font-bold ${gradeColors[report.grade] || gradeColors['N/A']}`}>
                        {report.grade}
                    </div>

                    {/* Stats */}
                    <div className="flex-1 grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Accuracy</p>
                            <p className="text-lg font-semibold text-gray-800 dark:text-neutral-200">
                                {report.directionAccuracy}%
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Correlation</p>
                            <p className="text-lg font-semibold text-gray-800 dark:text-neutral-200">
                                {report.pearsonR > 0 ? "+" : ""}{report.pearsonR}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Sample</p>
                            <p className="text-lg font-semibold text-gray-800 dark:text-neutral-200">
                                {report.sampleSize} days
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent History (mini sparkline of grades) */}
            {history.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Recent Weeks</p>
                    <div className="flex gap-2">
                        {history.slice(0, 6).map((week, i) => (
                            <div
                                key={i}
                                className={`flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-bold ${gradeColors[week.grade] || gradeColors['N/A']}`}
                                title={`${week.weekStart}: ${week.directionAccuracy}% accuracy, r=${week.pearsonR}`}
                            >
                                {week.grade}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
