/**
 * Correlation Engine - Statistical Analysis
 *
 * Computes Pearson and Spearman correlation coefficients between
 * sentiment scores and market returns. No external dependencies.
 *
 * Academic methodology:
 * - Articles published post-market → linked to next trading day
 * - Weekend articles → aggregated and linked to Monday's return
 * - Direction accuracy: did sentiment polarity match return polarity?
 */

import { BacktestDataPoint } from '../core/types';

class CorrelationEngine {

  /**
   * Compute Pearson correlation coefficient
   * Measures linear relationship between two variables (-1 to 1)
   */
  public pearson(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 3) return 0;

    const n = x.length;
    const meanX = x.reduce((s, v) => s + v, 0) / n;
    const meanY = y.reduce((s, v) => s + v, 0) / n;

    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    const denominator = Math.sqrt(sumX2 * sumY2);
    if (denominator === 0) return 0;

    return Math.round((sumXY / denominator) * 10000) / 10000;
  }

  /**
   * Compute Spearman rank correlation coefficient
   * More robust to outliers than Pearson (uses ranks instead of raw values)
   */
  public spearman(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 3) return 0;

    const rankX = this.computeRanks(x);
    const rankY = this.computeRanks(y);

    return this.pearson(rankX, rankY);
  }

  /**
   * Convert values to ranks (handles ties by averaging)
   */
  private computeRanks(values: number[]): number[] {
    const indexed = values.map((v, i) => ({ value: v, index: i }));
    indexed.sort((a, b) => a.value - b.value);

    const ranks = new Array(values.length);
    let i = 0;

    while (i < indexed.length) {
      let j = i;
      // Find ties
      while (j < indexed.length && indexed[j].value === indexed[i].value) {
        j++;
      }
      // Average rank for ties
      const avgRank = (i + j + 1) / 2; // 1-based
      for (let k = i; k < j; k++) {
        ranks[indexed[k].index] = avgRank;
      }
      i = j;
    }

    return ranks;
  }

  /**
   * Calculate direction accuracy
   * What % of days did our sentiment direction match market direction?
   */
  public directionAccuracy(dataPoints: BacktestDataPoint[]): number {
    if (dataPoints.length === 0) return 0;

    const matches = dataPoints.filter(dp => dp.directionMatch).length;
    return Math.round((matches / dataPoints.length) * 10000) / 100;
  }

  /**
   * Align sentiment dates with market trading days
   * Following academic standards:
   * - Post-market articles (16:00-23:59 ET) → next trading day
   * - Weekend articles → Monday
   * - Pre-market articles (00:00-09:29 ET) → same trading day
   *
   * For daily aggregation, we simply use: sentiment on date D → market return on date D+1
   */
  public alignSentimentToMarket(
    sentimentByDate: Map<string, number>,
    marketByDate: Map<string, number>
  ): BacktestDataPoint[] {
    const dataPoints: BacktestDataPoint[] = [];

    // Get sorted sentiment dates
    const sentimentDates = Array.from(sentimentByDate.keys()).sort();
    const marketDates = Array.from(marketByDate.keys()).sort();

    if (marketDates.length === 0) return dataPoints;

    for (const sentDate of sentimentDates) {
      // Find the next available trading day after this sentiment date
      const nextTradingDay = this.findNextTradingDay(sentDate, marketDates);
      if (!nextTradingDay) continue;

      const sentiment = sentimentByDate.get(sentDate)!;
      const marketReturn = marketByDate.get(nextTradingDay)!;

      // Direction match: positive sentiment → positive return (or both negative)
      const sentimentDirection = sentiment >= 0 ? 1 : -1;
      const marketDirection = marketReturn >= 0 ? 1 : -1;
      const directionMatch = sentimentDirection === marketDirection;

      dataPoints.push({
        date: sentDate,
        sentimentScore: Math.round(sentiment * 100) / 100,
        marketReturn: Math.round(marketReturn * 1000) / 1000,
        directionMatch,
        gprScore: 0 // Will be filled by backtest orchestrator
      });
    }

    console.log(`[Correlation] Aligned ${dataPoints.length} sentiment-market pairs`);
    return dataPoints;
  }

  /**
   * Find the next trading day after a given date
   */
  private findNextTradingDay(date: string, tradingDays: string[]): string | null {
    for (const td of tradingDays) {
      if (td > date) return td;
    }
    return null;
  }

  /**
   * Interpret correlation strength for human-readable output
   */
  public interpretCorrelation(r: number): string {
    const abs = Math.abs(r);
    const direction = r >= 0 ? 'positive' : 'negative';

    if (abs >= 0.7) return `Strong ${direction} correlation`;
    if (abs >= 0.4) return `Moderate ${direction} correlation`;
    if (abs >= 0.2) return `Weak ${direction} correlation`;
    return 'No meaningful correlation';
  }
}

export const correlationEngine = new CorrelationEngine();
