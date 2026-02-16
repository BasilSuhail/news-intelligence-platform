import React from 'react';

interface GPRGaugeProps {
    score: number;
    trend?: 'rising' | 'falling' | 'stable';
}

export const GPRGauge: React.FC<GPRGaugeProps> = ({ score, trend }) => {
    const getStatusColor = (s: number) => {
        if (s > 70) return 'text-red-600 dark:text-red-400';
        if (s > 40) return 'text-amber-600 dark:text-amber-400';
        return 'text-emerald-600 dark:text-emerald-400';
    };

    const getStatusBg = (s: number) => {
        if (s > 70) return 'bg-red-100 dark:bg-red-900/20';
        if (s > 40) return 'bg-amber-100 dark:bg-amber-900/20';
        return 'bg-emerald-100 dark:bg-emerald-900/20';
    };

    const getStatusLabel = (s: number) => {
        if (s > 70) return 'Extreme Anxiety';
        if (s > 40) return 'Elevated Risk';
        return 'Stable Market';
    };

    return (
        <div className={`p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider">
                    Geopolitical Risk Index (GPR)
                </h3>
                {trend && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trend === 'rising' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            trend === 'falling' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}>
                        {trend.toUpperCase()}
                    </span>
                )}
            </div>

            <div className="flex items-end gap-4">
                <span className={`text-5xl font-light tabular-nums ${getStatusColor(score)}`}>
                    {score}
                </span>
                <div className="pb-1.5">
                    <p className={`text-sm font-medium ${getStatusColor(score)}`}>
                        {getStatusLabel(score)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-24 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${score > 70 ? 'bg-red-500' : score > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                style={{ width: `${score}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <p className="mt-4 text-xs text-gray-500 dark:text-neutral-500 leading-relaxed">
                Quantifying global anxiety level based on real-time news keyword frequency and weighted volatility metrics.
            </p>
        </div>
    );
};
