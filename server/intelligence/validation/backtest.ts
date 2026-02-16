/**
 * Hindsight Validator - Backtest Orchestrator
 *
 * Proves whether our sentiment signals have predictive value by
 * correlating them with actual market returns (SPY).
 *
 * Flow: Get sentiment history → Get market data → Align dates → Compute correlation
 */

import { ValidationResult, BacktestDataPoint } from '../core/types';
import { storage } from '../core/storage';
import { marketDataFetcher } from './market-data';
import { correlationEngine } from './correlation';

class HindsightValidator {

  /**
   * Run a full backtest over the specified number of days
   */
  public async runBacktest(days = 30): Promise<ValidationResult> {
    console.log(`[Backtest] Starting hindsight validation over ${days} days...`);

    // 1. Get our sentiment history from SQLite
    const sentimentHistory = storage.getSentimentHistory(days);
    console.log(`[Backtest] Found ${sentimentHistory.length} days of sentiment data`);

    if (sentimentHistory.length < 5) {
      console.log('[Backtest] Not enough sentiment data for meaningful backtest');
      return this.emptyResult('Insufficient sentiment data (need at least 5 days)');
    }

    // 2. Get market data (fetches from Finnhub if API key set, otherwise cached)
    const marketData = await marketDataFetcher.fetchDailyCandles(days + 7); // Extra days for alignment
    console.log(`[Backtest] Found ${marketData.length} days of market data`);

    if (marketData.length < 5) {
      console.log('[Backtest] Not enough market data for meaningful backtest');
      return this.emptyResult('Insufficient market data (need at least 5 days)');
    }

    // 3. Build lookup maps
    const sentimentByDate = new Map<string, number>();
    for (const point of sentimentHistory) {
      sentimentByDate.set(point.date, point.sentiment);
    }

    const marketByDate = new Map<string, number>();
    for (const point of marketData) {
      marketByDate.set(point.date, point.changePct);
    }

    // 4. Align sentiment dates with next-day market returns
    const dataPoints = correlationEngine.alignSentimentToMarket(sentimentByDate, marketByDate);

    if (dataPoints.length < 3) {
      console.log('[Backtest] Not enough aligned data points');
      return this.emptyResult('Not enough overlapping sentiment and market data');
    }

    // 5. Enrich with GPR data
    const gprHistory = storage.getGPRHistory(days);
    const gprByDate = new Map<string, number>();
    for (const gpr of gprHistory) {
      gprByDate.set(gpr.date, gpr.score);
    }
    for (const dp of dataPoints) {
      dp.gprScore = gprByDate.get(dp.date) || 0;
    }

    // 6. Compute correlations
    const sentimentScores = dataPoints.map(dp => dp.sentimentScore);
    const marketReturns = dataPoints.map(dp => dp.marketReturn);
    const gprScores = dataPoints.map(dp => dp.gprScore);

    const pearson = correlationEngine.pearson(sentimentScores, marketReturns);
    const spearman = correlationEngine.spearman(sentimentScores, marketReturns);
    const gprCorrelation = correlationEngine.pearson(
      gprScores.map(g => -g), // Negate: high GPR should correlate with negative returns
      marketReturns
    );
    const accuracy = correlationEngine.directionAccuracy(dataPoints);

    // 7. Determine time period
    const dates = dataPoints.map(dp => dp.date).sort();
    const periodStart = dates[0];
    const periodEnd = dates[dates.length - 1];

    const result: ValidationResult = {
      id: `bt_${periodStart}_${periodEnd}`,
      periodStart,
      periodEnd,
      sentimentAccuracy: accuracy,
      pearsonCorrelation: pearson,
      spearmanCorrelation: spearman,
      gprCorrelation,
      sampleSize: dataPoints.length,
      dataPoints,
      calculatedAt: new Date().toISOString()
    };

    // 8. Cache in SQLite
    storage.saveBacktestResult(result);

    console.log(`[Backtest] Complete:
      Period: ${periodStart} to ${periodEnd}
      Sample size: ${dataPoints.length} days
      Direction accuracy: ${accuracy}%
      Pearson correlation: ${pearson}
      Spearman correlation: ${spearman}
      GPR correlation: ${gprCorrelation}
      Interpretation: ${correlationEngine.interpretCorrelation(pearson)}`);

    return result;
  }

  /**
   * Get the most recent backtest result (from cache)
   */
  public getLatestResult(): ValidationResult | null {
    return storage.getLatestBacktest();
  }

  /**
   * Generate an empty result with a message
   */
  private emptyResult(message: string): ValidationResult {
    return {
      id: `bt_empty_${Date.now()}`,
      periodStart: '',
      periodEnd: '',
      sentimentAccuracy: 0,
      pearsonCorrelation: 0,
      spearmanCorrelation: 0,
      gprCorrelation: 0,
      sampleSize: 0,
      dataPoints: [],
      calculatedAt: new Date().toISOString()
    };
  }
}

export const hindsightValidator = new HindsightValidator();
