/**
 * Today's Signal Generator
 *
 * Generates a single, actionable signal sentence based on:
 * - GPR index level and trend
 * - Overall market sentiment
 * - Anomaly alerts
 * - Top cluster topic
 *
 * Rule-based for speed, determinism, and testability.
 * Complements Gemini's use in the executive summary.
 */

import { storage } from '../core/storage';
import { anomalyDetector } from '../metrics/anomaly';

export interface TodaySignalData {
    signal: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: 'high' | 'medium' | 'low';
    keyMetric: string;
    timestamp: string;
}

class SignalGenerator {
    /**
     * Generate today's signal from the latest briefing data
     */
    public generate(): TodaySignalData {
        try {
            // Get the most recent briefing
            const today = new Date().toISOString().split('T')[0];
            let briefing = storage.getBriefing(today);

            // Fall back to recent dates
            if (!briefing) {
                for (let i = 1; i <= 7; i++) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    briefing = storage.getBriefing(d.toISOString().split('T')[0]);
                    if (briefing) break;
                }
            }

            if (!briefing) {
                return this.emptySignal();
            }

            // Extract key metrics
            const gpr = briefing.gprIndex?.current || 0;
            const gprTrend = briefing.gprIndex?.trend || 'stable';
            const sentiment = briefing.marketSentiment?.overall || 0;
            const topCluster = briefing.topClusters?.[0];
            const anomalies = anomalyDetector.getAnomalies();

            // Determine sentiment label and confidence
            const sentimentLabel: TodaySignalData['sentiment'] =
                sentiment > 15 ? 'bullish' : sentiment < -15 ? 'bearish' : 'neutral';

            // Higher confidence when GPR and sentiment agree
            const gprAligned =
                (gpr > 50 && sentiment < -10) || // High risk + bearish = aligned
                (gpr < 30 && sentiment > 10);     // Low risk + bullish = aligned

            const confidence: TodaySignalData['confidence'] =
                gprAligned ? 'high' : Math.abs(sentiment) > 20 ? 'medium' : 'low';

            // Build signal sentence
            let signal = '';
            let keyMetric = '';

            // Priority 1: Anomaly alerts
            if (anomalies.length > 0) {
                const topAnomaly = anomalies[0];
                signal = `⚡ Volume spike detected: ${topAnomaly.message}. `;
                keyMetric = `${topAnomaly.zScore.toFixed(1)}σ above normal`;
            }

            // Priority 2: GPR-driven signal
            if (gpr > 65) {
                signal += `Geopolitical risk elevated at ${gpr}/100 (${gprTrend}). `;
                if (!keyMetric) keyMetric = `GPR: ${gpr}/100`;

                if (sentimentLabel === 'bearish') {
                    signal += 'Market sentiment confirms defensive posture.';
                } else {
                    signal += 'Markets haven\'t priced in the risk yet—watch for corrections.';
                }
            } else if (gpr < 25 && sentimentLabel === 'bullish') {
                signal = `Low geopolitical risk (${gpr}/100) with bullish sentiment (+${sentiment.toFixed(1)}). `;
                signal += topCluster
                    ? `${topCluster.topic} driving optimism.`
                    : 'Conditions favor risk-on positioning.';
                if (!keyMetric) keyMetric = `Sentiment: +${sentiment.toFixed(1)}`;
            } else {
                // Standard signal
                const sentimentDirection = sentiment > 0 ? 'positive' : sentiment < 0 ? 'negative' : 'neutral';
                signal = `Market sentiment is ${sentimentDirection} (${sentiment > 0 ? '+' : ''}${sentiment.toFixed(1)}) with GPR at ${gpr}/100. `;

                if (topCluster) {
                    signal += `Top story: ${topCluster.topic}.`;
                }
                if (!keyMetric) keyMetric = `Sentiment: ${sentiment > 0 ? '+' : ''}${sentiment.toFixed(1)}`;
            }

            return {
                signal: signal.trim(),
                sentiment: sentimentLabel,
                confidence,
                keyMetric,
                timestamp: new Date().toISOString()
            };
        } catch (err: any) {
            console.error('[Signal] Generation failed:', err.message);
            return this.emptySignal();
        }
    }

    private emptySignal(): TodaySignalData {
        return {
            signal: 'No signal available. Run the intelligence pipeline to generate today\'s analysis.',
            sentiment: 'neutral',
            confidence: 'low',
            keyMetric: 'N/A',
            timestamp: new Date().toISOString()
        };
    }
}

export const signalGenerator = new SignalGenerator();
