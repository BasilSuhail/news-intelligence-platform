/**
 * Weekly Accuracy Scorecard
 *
 * Generates weekly accuracy reports by comparing sentiment predictions
 * to actual market returns. Tracks:
 * - Direction accuracy (did we predict up/down correctly?)
 * - Pearson & Spearman correlation
 * - Sample size and period
 * - Trend across recent weeks
 */

import { storage } from '../core/storage';
import { correlationEngine } from './correlation';
import { marketDataFetcher } from './market-data';

export interface WeeklyReport {
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

class ScorecardEngine {
    constructor() {
        this.ensureTable();
    }

    /**
     * Create the weekly_scorecard table if it doesn't exist
     */
    private ensureTable(): void {
        try {
            storage.getDb().exec(`
        CREATE TABLE IF NOT EXISTS weekly_scorecard (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          week_start TEXT NOT NULL,
          week_end TEXT NOT NULL,
          direction_accuracy REAL,
          pearson_r REAL,
          spearman_r REAL,
          sample_size INTEGER,
          avg_sentiment REAL,
          avg_return REAL,
          grade TEXT,
          calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(week_start)
        );
      `);
        } catch (err: any) {
            console.error('[Scorecard] Table creation error:', err.message);
        }
    }

    /**
     * Generate the current week's scorecard
     */
    public async generateCurrentWeek(): Promise<WeeklyReport> {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // Monday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Sunday

        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        return this.generateForWeek(weekStartStr, weekEndStr);
    }

    /**
     * Generate a scorecard for a specific week
     */
    private async generateForWeek(weekStart: string, weekEnd: string): Promise<WeeklyReport> {
        try {
            // Get sentiment history for the week
            const sentimentByDate = new Map<string, number>();
            const db = storage.getDb();

            const rows = db.prepare(`
        SELECT
          SUBSTR(r.published_at, 1, 10) as date,
          AVG(e.sentiment_score) as avg_sentiment
        FROM enriched_articles e
        JOIN raw_articles r ON e.raw_article_id = r.id
        WHERE SUBSTR(r.published_at, 1, 10) >= ? AND SUBSTR(r.published_at, 1, 10) <= ?
        GROUP BY SUBSTR(r.published_at, 1, 10)
        ORDER BY date ASC
      `).all(weekStart, weekEnd) as any[];

            for (const row of rows) {
                sentimentByDate.set(row.date, row.avg_sentiment * 100); // Convert to -100..100 scale
            }

            // Get market data for the week (with 1 extra day for next-day returns)
            const marketData = storage.getMarketData(14);
            const marketByDate = new Map<string, number>();
            for (const point of marketData) {
                marketByDate.set(point.date, point.changePct);
            }

            // Align sentiment to market
            const dataPoints = correlationEngine.alignSentimentToMarket(sentimentByDate, marketByDate);

            if (dataPoints.length < 2) {
                return this.emptyReport(weekStart, weekEnd, 'Insufficient data for this week');
            }

            const sentimentScores = dataPoints.map(dp => dp.sentimentScore);
            const marketReturns = dataPoints.map(dp => dp.marketReturn);

            const directionAccuracy = correlationEngine.directionAccuracy(dataPoints);
            const pearsonR = correlationEngine.pearson(sentimentScores, marketReturns);
            const spearmanR = correlationEngine.spearman(sentimentScores, marketReturns);
            const avgSentiment = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
            const avgReturn = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;

            const grade = this.calculateGrade(directionAccuracy, Math.abs(pearsonR));

            const report: WeeklyReport = {
                weekStart,
                weekEnd,
                directionAccuracy: Math.round(directionAccuracy * 100) / 100,
                pearsonR: Math.round(pearsonR * 10000) / 10000,
                spearmanR: Math.round(spearmanR * 10000) / 10000,
                sampleSize: dataPoints.length,
                avgSentiment: Math.round(avgSentiment * 100) / 100,
                avgReturn: Math.round(avgReturn * 10000) / 10000,
                grade
            };

            // Save to database
            this.saveReport(report);

            return report;
        } catch (err: any) {
            console.error('[Scorecard] Generation failed:', err.message);
            return this.emptyReport(weekStart, weekEnd, err.message);
        }
    }

    /**
     * Get historical scorecards
     */
    public getHistory(weeks = 8): WeeklyReport[] {
        try {
            const rows = storage.getDb().prepare(
                'SELECT * FROM weekly_scorecard ORDER BY week_start DESC LIMIT ?'
            ).all(weeks) as any[];

            return rows.map(row => ({
                weekStart: row.week_start,
                weekEnd: row.week_end,
                directionAccuracy: row.direction_accuracy,
                pearsonR: row.pearson_r,
                spearmanR: row.spearman_r,
                sampleSize: row.sample_size,
                avgSentiment: row.avg_sentiment,
                avgReturn: row.avg_return,
                grade: row.grade
            }));
        } catch (err: any) {
            console.error('[Scorecard] Failed to get history:', err.message);
            return [];
        }
    }

    /**
     * Calculate a letter grade based on accuracy and correlation
     */
    private calculateGrade(accuracy: number, absCorrelation: number): string {
        const score = (accuracy * 0.6) + (absCorrelation * 40);
        if (score >= 75) return 'A';
        if (score >= 60) return 'B';
        if (score >= 45) return 'C';
        if (score >= 30) return 'D';
        return 'F';
    }

    /**
     * Save a weekly report to the database
     */
    private saveReport(report: WeeklyReport): void {
        try {
            storage.getDb().prepare(`
        INSERT OR REPLACE INTO weekly_scorecard (
          week_start, week_end, direction_accuracy, pearson_r, spearman_r,
          sample_size, avg_sentiment, avg_return, grade
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                report.weekStart, report.weekEnd, report.directionAccuracy, report.pearsonR,
                report.spearmanR, report.sampleSize, report.avgSentiment, report.avgReturn, report.grade
            );
        } catch (err: any) {
            console.error('[Scorecard] Failed to save report:', err.message);
        }
    }

    /**
     * Return an empty report
     */
    private emptyReport(weekStart: string, weekEnd: string, message?: string): WeeklyReport {
        return {
            weekStart,
            weekEnd,
            directionAccuracy: 0,
            pearsonR: 0,
            spearmanR: 0,
            sampleSize: 0,
            avgSentiment: 0,
            avgReturn: 0,
            grade: 'N/A'
        };
    }
}

export const scorecardEngine = new ScorecardEngine();
