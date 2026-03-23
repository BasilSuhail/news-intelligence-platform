import { useState, useEffect } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Target,
  BarChart3,
  RefreshCw,
  Sliders,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BacktestDataPoint {
  date: string;
  sentimentScore: number;
  marketReturn: number;
  directionMatch: boolean;
  gprScore: number;
}

interface ValidationResult {
  id: string;
  periodStart: string;
  periodEnd: string;
  sentimentAccuracy: number;
  pearsonCorrelation: number;
  spearmanCorrelation: number;
  gprCorrelation: number;
  sampleSize: number;
  dataPoints: BacktestDataPoint[];
  calculatedAt: string;
  isEmpty?: boolean;
  message?: string;
}

interface WeightInfo {
  sentimentWeight: number;
  clusterWeight: number;
  sourceWeight: number;
  recencyWeight: number;
  pearsonCorrelation?: number;
}

interface OptimizeResult {
  best: WeightInfo & { pearsonCorrelation: number; spearmanCorrelation: number };
  top5: Array<WeightInfo & { pearsonCorrelation: number }>;
  defaultCorrelation: number;
  improvement: string;
}

function interpretCorrelation(r: number): { text: string; color: string; bg: string } {
  const abs = Math.abs(r);
  const direction = r >= 0 ? "positive" : "negative";

  if (abs >= 0.7) return {
    text: `Strong ${direction}`,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500"
  };
  if (abs >= 0.4) return {
    text: `Moderate ${direction}`,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500"
  };
  if (abs >= 0.2) return {
    text: `Weak ${direction}`,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500"
  };
  return {
    text: "No correlation",
    color: "text-gray-500 dark:text-neutral-500",
    bg: "bg-gray-400"
  };
}

export function HindsightValidator() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Weight optimization state
  const [currentWeights, setCurrentWeights] = useState<WeightInfo | null>(null);
  const [isOptimized, setIsOptimized] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);

  useEffect(() => {
    const fetchBacktest = async () => {
      try {
        const res = await fetch("/api/intelligence/backtest");
        if (res.ok) {
          const data = await res.json();
          setResult(data);
        }
      } catch (err) {
        console.error("Failed to fetch backtest:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchWeights = async () => {
      try {
        const res = await fetch("/api/intelligence/current-weights");
        if (res.ok) {
          const data = await res.json();
          setCurrentWeights(data.weights);
          setIsOptimized(data.isOptimized);
        }
      } catch (err) {
        console.error("Failed to fetch weights:", err);
      }
    };

    fetchBacktest();
    fetchWeights();
  }, []);

  const runBacktest = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/intelligence/backtest/run?days=30");
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (err) {
      console.error("Failed to run backtest:", err);
    } finally {
      setRunning(false);
    }
  };

  const runOptimization = async () => {
    setOptimizing(true);
    try {
      const res = await fetch("/api/intelligence/optimize-weights?days=30");
      if (res.ok) {
        const data = await res.json();
        setOptimizeResult(data);
        setCurrentWeights(data.best);
        setIsOptimized(true);
      }
    } catch (err) {
      console.error("Failed to optimize weights:", err);
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm p-8">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30" />
          <div className="h-4 w-48 bg-gray-100 dark:bg-neutral-800 rounded" />
        </div>
      </div>
    );
  }

  const hasData = result && !result.isEmpty && result.sampleSize > 0;
  const pearsonInterpretation = hasData
    ? interpretCorrelation(result.pearsonCorrelation)
    : null;

  const scatterData = hasData
    ? result.dataPoints.map(dp => ({
      sentiment: dp.sentimentScore,
      return: dp.marketReturn,
      match: dp.directionMatch,
      date: dp.date,
    }))
    : [];

  const correctCount = hasData ? result.dataPoints.filter(d => d.directionMatch).length : 0;
  const wrongCount = hasData ? result.dataPoints.filter(d => !d.directionMatch).length : 0;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">

      {/* ── Hero Header ── */}
      <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/50 dark:from-violet-950/30 dark:via-neutral-900 dark:to-indigo-950/20 border-b border-gray-100 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                Hindsight Validator
              </h2>
              <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
                Does our sentiment actually predict market moves?
              </p>
            </div>
          </div>
          {hasData && (
            <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              {result.sampleSize}-day backtest
            </Badge>
          )}
        </div>

        {!hasData ? (
          <div className="py-8 text-center">
            <ShieldCheck className="w-10 h-10 text-violet-200 dark:text-violet-800 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-neutral-300">
              Backtest Initializing
            </p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1.5 max-w-xs mx-auto">
              The validator compares our BERT sentiment scores against actual S&P 500 returns. Results appear after the first pipeline cycle.
            </p>
            <button
              onClick={runBacktest}
              disabled={running}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${running ? "animate-spin" : ""}`} />
              {running ? "Running..." : "Run Backtest Now"}
            </button>
          </div>
        ) : (
          /* ── Hero Stats Row ── */
          <div className="grid grid-cols-3 gap-3">
            {/* Direction Accuracy — the headline number */}
            <div className="relative p-4 rounded-xl bg-white/80 dark:bg-neutral-800/60 border border-gray-100 dark:border-neutral-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-medium">
                  Direction Accuracy
                </span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-gray-800 dark:text-neutral-100">
                {result.sentimentAccuracy}%
              </p>
              <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5">
                {correctCount} correct / {wrongCount} wrong
              </p>
              {/* Accuracy bar */}
              <div className="mt-2 h-1 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-1000"
                  style={{ width: `${result.sentimentAccuracy}%` }}
                />
              </div>
            </div>

            {/* Pearson Correlation */}
            <div className="relative p-4 rounded-xl bg-white/80 dark:bg-neutral-800/60 border border-gray-100 dark:border-neutral-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-medium">
                  Pearson r
                </span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-gray-800 dark:text-neutral-100">
                {result.pearsonCorrelation > 0 ? "+" : ""}
                {result.pearsonCorrelation}
              </p>
              <p className={`text-[10px] font-medium mt-0.5 ${pearsonInterpretation!.color}`}>
                {pearsonInterpretation!.text}
              </p>
              <div className="mt-2 h-1 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${pearsonInterpretation!.bg}`}
                  style={{ width: `${Math.abs(result.pearsonCorrelation) * 100}%` }}
                />
              </div>
            </div>

            {/* Sample Size & Period */}
            <div className="relative p-4 rounded-xl bg-white/80 dark:bg-neutral-800/60 border border-gray-100 dark:border-neutral-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-medium">
                  Sample Size
                </span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-gray-800 dark:text-neutral-100">
                {result.sampleSize}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5">
                trading days analyzed
              </p>
              <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-1">
                {result.periodStart} — {result.periodEnd}
              </p>
            </div>
          </div>
        )}
      </div>

      {hasData && (
        <>
          {/* ── Scatter Plot — full width, prominent ── */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                  Sentiment vs Next-Day SPY Return
                </h3>
                <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5">
                  Each dot is one trading day — hover for details
                </p>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Correct ({correctCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Wrong ({wrongCount})
                </span>
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis
                    type="number"
                    dataKey="sentiment"
                    name="Sentiment"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    label={{ value: "Our Sentiment Score", position: "bottom", fontSize: 10, fill: "#9ca3af", offset: 5 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="return"
                    name="Market Return"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    label={{ value: "SPY Return %", angle: -90, position: "insideLeft", fontSize: 10, fill: "#9ca3af" }}
                  />
                  <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-neutral-800 px-3 py-2.5 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700">
                            <p className="text-xs font-semibold text-gray-700 dark:text-neutral-200">{data.date}</p>
                            <div className="mt-1.5 space-y-0.5">
                              <p className="text-xs text-gray-500">
                                Sentiment: <span className="font-mono font-medium text-gray-700 dark:text-neutral-300">{data.sentiment > 0 ? "+" : ""}{data.sentiment}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                SPY Return: <span className="font-mono font-medium text-gray-700 dark:text-neutral-300">{data.return > 0 ? "+" : ""}{data.return}%</span>
                              </p>
                            </div>
                            <p className={`text-[10px] font-medium mt-1.5 pt-1.5 border-t border-gray-100 dark:border-neutral-700 ${data.match ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                              {data.match ? "Correct prediction" : "Wrong prediction"}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter
                    data={scatterData.filter(d => d.match)}
                    fill="#10b981"
                    opacity={0.8}
                    r={5}
                  />
                  <Scatter
                    data={scatterData.filter(d => !d.match)}
                    fill="#ef4444"
                    opacity={0.8}
                    r={5}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Spearman + Expand Details ── */}
          <div className="px-6 pb-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50 border border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Spearman rho</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200 font-mono">
                    {result.spearmanCorrelation > 0 ? "+" : ""}{result.spearmanCorrelation}
                  </p>
                </div>
                <div className="h-8 w-px bg-gray-200 dark:bg-neutral-700" />
                <div>
                  <span className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Rank Correlation</span>
                  <p className={`text-xs font-medium ${interpretCorrelation(result.spearmanCorrelation).color}`}>
                    {interpretCorrelation(result.spearmanCorrelation).text}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium transition-colors"
              >
                {showDetails ? "Hide" : "Details"}
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* ── Expandable Details: Weight Optimization + Methodology ── */}
          {showDetails && (
            <div className="px-6 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
              {/* Weight Optimization */}
              <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                      Weight Optimization
                    </span>
                    {isOptimized && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Optimized
                      </Badge>
                    )}
                  </div>
                  <button
                    onClick={runOptimization}
                    disabled={optimizing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50"
                  >
                    <Sliders className={`w-2.5 h-2.5 ${optimizing ? "animate-pulse" : ""}`} />
                    {optimizing ? "Optimizing..." : "Optimize"}
                  </button>
                </div>

                {currentWeights && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: "Sentiment", value: currentWeights.sentimentWeight },
                      { label: "Cluster", value: currentWeights.clusterWeight },
                      { label: "Source", value: currentWeights.sourceWeight },
                      { label: "Recency", value: currentWeights.recencyWeight },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center p-2 rounded-lg bg-gray-50 dark:bg-neutral-800/50">
                        <p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase">{label}</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200 font-mono">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {optimizeResult && (
                  <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                    <p className="text-[10px] text-violet-700 dark:text-violet-300 font-medium">
                      Best: sentiment={optimizeResult.best.sentimentWeight}, cluster={optimizeResult.best.clusterWeight}, source={optimizeResult.best.sourceWeight}, recency={optimizeResult.best.recencyWeight} (r={optimizeResult.best.pearsonCorrelation.toFixed(4)})
                    </p>
                    <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">
                      {optimizeResult.improvement}
                    </p>
                  </div>
                )}

                {!currentWeights && !optimizeResult && (
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                    Run optimization to find the best impact score weights via grid search against SPY returns.
                  </p>
                )}
              </div>

              {/* Methodology */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50 border border-gray-100 dark:border-neutral-800">
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 leading-relaxed">
                  <span className="font-semibold">Methodology:</span> Each day's aggregate sentiment score is compared
                  to the next trading day's S&P 500 (SPY) return. Direction accuracy measures how often sentiment polarity
                  matched the market direction. Pearson measures linear correlation; Spearman measures rank correlation
                  (more robust to outliers). Weight optimization uses grid search across ~100 valid combinations.
                  Unlike commercial sentiment APIs, all analysis runs locally using BERT and FinBERT models with
                  zero external dependencies — every score is reproducible and auditable.
                </p>
              </div>
            </div>
          )}

          {/* Bottom padding when details are hidden */}
          {!showDetails && <div className="h-4" />}
        </>
      )}
    </div>
  );
}
