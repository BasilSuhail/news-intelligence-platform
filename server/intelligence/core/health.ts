/**
 * Pipeline Health Monitor
 *
 * Tracks the success/failure of each pipeline step on every run.
 * Provides observability into which steps succeed, fail, or are skipped.
 */

import { storage } from './storage';

interface StepRecord {
    startTime: number;
}

export interface HealthStepResult {
    step: string;
    status: 'success' | 'failure' | 'skipped';
    durationMs: number;
    articleCount?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
}

export interface HealthSummary {
    lastRun: string;
    steps: Record<string, {
        status: string;
        duration_ms: number;
        articles?: number;
        error?: string;
        metadata?: Record<string, any>;
    }>;
    failureRate7d: number;
    avgDuration: number;
}

class PipelineHealthMonitor {
    private activeSteps: Map<string, StepRecord> = new Map();
    private currentDate: string = '';

    constructor() {
        this.ensureTable();
    }

    /**
     * Create the pipeline_health table if it doesn't exist
     */
    private ensureTable(): void {
        try {
            const db = storage.getDb();
            db.exec(`
        CREATE TABLE IF NOT EXISTS pipeline_health (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          step TEXT NOT NULL,
          status TEXT NOT NULL,
          duration_ms INTEGER,
          article_count INTEGER,
          error_message TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_health_date ON pipeline_health(date);
      `);
        } catch (err: any) {
            console.error('[Health] Table creation error:', err.message);
        }
    }

    /**
     * Set the current pipeline run date
     */
    public setDate(date: string): void {
        this.currentDate = date;
    }

    /**
     * Record the start of a pipeline step
     */
    public startStep(stepName: string): void {
        this.activeSteps.set(stepName, { startTime: Date.now() });
    }

    /**
     * Record the end of a pipeline step
     */
    public endStep(
        stepName: string,
        status: 'success' | 'failure' | 'skipped',
        metadata?: Record<string, any>
    ): void {
        const step = this.activeSteps.get(stepName);
        const durationMs = step ? Date.now() - step.startTime : 0;
        this.activeSteps.delete(stepName);

        const articleCount = metadata?.articles || metadata?.entities || metadata?.clusters || null;
        const errorMessage = metadata?.error || null;

        try {
            storage.getDb().prepare(`
        INSERT INTO pipeline_health (date, step, status, duration_ms, article_count, error_message, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
                this.currentDate,
                stepName,
                status,
                durationMs,
                articleCount,
                errorMessage,
                metadata ? JSON.stringify(metadata) : null
            );
        } catch (err: any) {
            console.error(`[Health] Failed to save health for ${stepName}:`, err.message);
        }
    }

    /**
     * Get health summary for the last N days
     */
    public getHealth(days = 7): HealthSummary {
        try {
            const db = storage.getDb();
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            const cutoffStr = cutoff.toISOString().split('T')[0];

            // Get the most recent run
            const latestRow = db.prepare(
                'SELECT date, created_at FROM pipeline_health ORDER BY created_at DESC LIMIT 1'
            ).get() as any;

            const lastRun = latestRow?.created_at || '';
            const latestDate = latestRow?.date || '';

            // Get steps from the most recent run
            const steps: Record<string, any> = {};
            const latestSteps = db.prepare(
                'SELECT * FROM pipeline_health WHERE date = ? ORDER BY created_at ASC'
            ).all(latestDate) as any[];

            for (const row of latestSteps) {
                steps[row.step] = {
                    status: row.status,
                    duration_ms: row.duration_ms,
                    articles: row.article_count || undefined,
                    error: row.error_message || undefined,
                    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
                };
            }

            // Calculate failure rate over the period
            const totalSteps = db.prepare(
                'SELECT COUNT(*) as count FROM pipeline_health WHERE date >= ?'
            ).get(cutoffStr) as any;

            const failedSteps = db.prepare(
                "SELECT COUNT(*) as count FROM pipeline_health WHERE date >= ? AND status = 'failure'"
            ).get(cutoffStr) as any;

            const failureRate = totalSteps.count > 0
                ? Math.round((failedSteps.count / totalSteps.count) * 100) / 100
                : 0;

            // Calculate average total duration
            const avgDurationRow = db.prepare(`
        SELECT AVG(total_duration) as avg_dur FROM (
          SELECT date, SUM(duration_ms) as total_duration
          FROM pipeline_health WHERE date >= ?
          GROUP BY date
        )
      `).get(cutoffStr) as any;

            return {
                lastRun,
                steps,
                failureRate7d: failureRate,
                avgDuration: Math.round(avgDurationRow?.avg_dur || 0)
            };
        } catch (err: any) {
            console.error('[Health] Failed to get health:', err.message);
            return { lastRun: '', steps: {}, failureRate7d: 0, avgDuration: 0 };
        }
    }

    /**
     * Get only failures for the last N days
     */
    public getFailures(days = 7): Array<{ date: string; step: string; error: string; createdAt: string }> {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            const cutoffStr = cutoff.toISOString().split('T')[0];

            const rows = storage.getDb().prepare(
                "SELECT date, step, error_message, created_at FROM pipeline_health WHERE date >= ? AND status = 'failure' ORDER BY created_at DESC"
            ).all(cutoffStr) as any[];

            return rows.map(row => ({
                date: row.date,
                step: row.step,
                error: row.error_message || 'Unknown error',
                createdAt: row.created_at
            }));
        } catch (err: any) {
            console.error('[Health] Failed to get failures:', err.message);
            return [];
        }
    }
}

export const healthMonitor = new PipelineHealthMonitor();
