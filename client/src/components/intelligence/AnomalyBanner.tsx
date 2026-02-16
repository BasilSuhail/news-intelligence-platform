import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface AnomalyAlert {
  category: string;
  currentVolume: number;
  rollingAvg7d: number;
  zScore: number;
  isAnomaly: boolean;
  message: string;
  date: string;
}

export function AnomalyBanner() {
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchAnomalies = async () => {
      try {
        const res = await fetch("/api/intelligence/anomalies");
        if (res.ok) {
          const data = await res.json();
          setAnomalies((data.anomalies || []).filter((a: AnomalyAlert) => a.isAnomaly));
        }
      } catch (err) {
        // Silently fail - anomaly banner is non-critical
      }
    };
    fetchAnomalies();
  }, []);

  if (anomalies.length === 0 || dismissed) return null;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Unusual Activity Detected
          </p>
          <div className="mt-1.5 space-y-1">
            {anomalies.map((alert, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
                {alert.message}
                <span className="text-amber-500 dark:text-amber-500 ml-1">
                  (z-score: {alert.zScore})
                </span>
              </p>
            ))}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
