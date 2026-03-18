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
  AlertCircle,
  Sliders,
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

function interpretCorrelation(r: number): { text: string; color: string } {
  const abs = Math.abs(r);
  const direction = r >= 0 ? "positive" : "negative";

  if (abs >= 0.7) return {
    text: `Strong ${direction}`,
    color: "text-emerald-600 dark:text-emerald-400"
  };
  if (abs >= 0.4) return {
    text: `Moderate ${direction}`,
    color: "text-blue-600 dark:text-blue-400"
  };
  if (abs >= 0.2) return {
    text: `Weak ${direction}`,
    color: "text-amber-600 dark:text-amber-400"
  };
  return {
    text: "No correlation",
    color: "text-gray-500 dark:text-neutral-500"
  };
}

export function HindsightValidator() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

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
      <div className="py-8 text-center text-gray-400 dark:text-neutral-500 text-sm">
        Loading validation data...
      </div>
    );
  }

  const hasData = result && !result.isEmpty && result.sampleSize > 0;
  const pearsonInterpretation = hasData
    ? interpretCorrelation(result.pearsonCorrelation)
    : null;

  // Scatter data for the chart
  const scatterData = hasData
    ? result.dataPoints.map(dp => ({
      sentiment: dp.sentimentScore,
      return: dp.marketReturn,
      match: dp.directionMatch,
      date: dp.date,
    }))
    : [];

  return (
    <section className="space-y-5">
      {/* Sub-header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Does our sentiment actually predict market moves?</p>
        <button
          onClick={runBacktest}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${running ? "animate-spin" : ""}`} />
          {running ? "Running..." : "Run Backtest"}
        </button>
      </div>

      {!hasData ? (
        <div className="p-6 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-center">
          <AlertCircle className="w-8 h-8 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-neutral-400">
            {result?.message || "No backtest data yet. Click 'Run Backtest' to analyze sentiment vs market returns."}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Requires a Finnhub API key (FINNHUB_API_KEY) for market data, or cached data from a previous run.
          </p>
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Direction Accuracy */}
            <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-violet-500" />
                <span className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                  Accuracy
                </span>
              </div>
              <p className="text-2xl font-semibold text-gray-800 dark:text-neutral-200">
                {result.sentimentAccuracy}%
              </p>
              <p className="text-xs text-gray-400 mt-1">
                direction predicted correctly
              </p>
            </div>

            {/* Pearson Correlation */}
            <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                <span className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                  Correlation
                </span>
              </div>
              <p className="text-2xl font-semibold text-gray-800 dark:text-neutral-200">
                {result.pearsonCorrelation > 0 ? "+" : ""}
                {result.pearsonCorrelation}
              </p>
              <p className={`text-xs mt-1 ${pearsonInterpretation!.color}`}>
                {pearsonInterpretation!.text}
              </p>
            </div>

            {/* Sample Size */}
            <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-violet-500" />
                <span className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide">
                  Sample
                </span>
              </div>
              <p className="text-2xl font-semibold text-gray-800 dark:text-neutral-200">
                {result.sampleSize}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                trading days analyzed
              </p>
            </div>
          </div>

          {/* Scatter Plot */}
          <div className="p-5 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <h3 className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Sentiment vs Next-Day Market Return
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Each dot is a day. Green = correct prediction, Red = wrong prediction
            </p>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis
                    type="number"
                    dataKey="sentiment"
                    name="Sentiment"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    label={{ value: "Our Sentiment Score", position: "bottom", fontSize: 10, fill: "#9ca3af" }}
                  />
                  <YAxis
                    type="number"
                    dataKey="return"
                    name="Market Return"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    label={{ value: "Market Return %", angle: -90, position: "insideLeft", fontSize: 10, fill: "#9ca3af" }}
                  />
                  <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="3 3" />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
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
                              Return: {data.return > 0 ? "+" : ""}{data.return}%
                            </p>
                            <p className={`text-xs mt-1 ${data.match ? "text-emerald-500" : "text-red-500"}`}>
                              {data.match ? "Correct" : "Wrong"} prediction
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
                    opacity={0.7}
                    r={4}
                  />
                  <Scatter
                    data={scatterData.filter(d => !d.match)}
                    fill="#ef4444"
                    opacity={0.7}
                    r={4}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Correct prediction
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Wrong prediction
              </span>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide mb-1">
                Spearman Correlation
              </p>
              <p className="text-lg font-medium text-gray-800 dark:text-neutral-200">
                {result.spearmanCorrelation > 0 ? "+" : ""}{result.spearmanCorrelation}
              </p>
              <p className={`text-xs ${interpretCorrelation(result.spearmanCorrelation).color}`}>
                {interpretCorrelation(result.spearmanCorrelation).text} (rank-based)
              </p>
            </div>

            <div className="p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide mb-1">
                Period
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-neutral-200">
                {result.periodStart} to {result.periodEnd}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Last run: {new Date(result.calculatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Weight Optimization Section */}
          <div className="p-5 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                  Weight Optimization
                </h3>
                {isOptimized && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Optimized
                  </Badge>
                )}
              </div>
              <button
                onClick={runOptimization}
                disabled={optimizing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50"
              >
                <Sliders className={`w-3 h-3 ${optimizing ? "animate-pulse" : ""}`} />
                {optimizing ? "Optimizing..." : "Optimize Weights"}
              </button>
            </div>

            {/* Current Weights Table */}
            {currentWeights && (
              <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-neutral-800 mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-neutral-800/50">
                      <th className="px-3 py-2 text-left text-gray-500 dark:text-neutral-500 font-medium">Factor</th>
                      <th className="px-3 py-2 text-right text-gray-500 dark:text-neutral-500 font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    <tr><td className="px-3 py-1.5 text-gray-700 dark:text-neutral-300">Sentiment</td><td className="px-3 py-1.5 text-right text-gray-800 dark:text-neutral-200 font-mono">{currentWeights.sentimentWeight}</td></tr>
                    <tr><td className="px-3 py-1.5 text-gray-700 dark:text-neutral-300">Cluster Size</td><td className="px-3 py-1.5 text-right text-gray-800 dark:text-neutral-200 font-mono">{currentWeights.clusterWeight}</td></tr>
                    <tr><td className="px-3 py-1.5 text-gray-700 dark:text-neutral-300">Source Weight</td><td className="px-3 py-1.5 text-right text-gray-800 dark:text-neutral-200 font-mono">{currentWeights.sourceWeight}</td></tr>
                    <tr><td className="px-3 py-1.5 text-gray-700 dark:text-neutral-300">Recency</td><td className="px-3 py-1.5 text-right text-gray-800 dark:text-neutral-200 font-mono">{currentWeights.recencyWeight}</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Optimization Results */}
            {optimizeResult && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                  <p className="text-xs text-violet-700 dark:text-violet-300 font-medium mb-1">
                    Best weights found: sentiment={optimizeResult.best.sentimentWeight}, cluster={optimizeResult.best.clusterWeight}, source={optimizeResult.best.sourceWeight}, recency={optimizeResult.best.recencyWeight} (r={optimizeResult.best.pearsonCorrelation.toFixed(4)})
                  </p>
                  <p className="text-xs text-violet-600 dark:text-violet-400">
                    {optimizeResult.improvement}
                  </p>
                </div>
              </div>
            )}

            {!currentWeights && !optimizeResult && (
              <p className="text-xs text-gray-400 dark:text-neutral-500">
                Click "Optimize Weights" to find the best impact score weights using grid search against market returns.
              </p>
            )}
          </div>

          {/* Methodology Note */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800/50 border border-gray-100 dark:border-neutral-800">
            <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
              <span className="font-medium">Methodology:</span> Each day's aggregate sentiment
              score is compared to the next trading day's S&P 500 (SPY) return. Direction accuracy
              measures how often our sentiment polarity matched the market direction. Pearson
              measures linear correlation; Spearman measures rank correlation (more robust to outliers).
              Weight optimization uses grid search across ~100 valid weight combinations to maximize correlation.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

