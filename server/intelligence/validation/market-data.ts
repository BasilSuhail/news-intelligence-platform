/**
 * Market Data Fetcher - Finnhub API Client
 *
 * Fetches historical daily market data (SPY) for backtesting
 * sentiment predictions against actual market returns.
 *
 * Uses Finnhub free tier: 60 calls/min
 * Aggressive caching: historical data doesn't change, only fetch missing dates.
 */

import { MarketDataPoint } from '../core/types';
import { storage } from '../core/storage';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const DEFAULT_SYMBOL = 'SPY'; // S&P 500 ETF
const RATE_LIMIT_MS = 1100; // 1.1 seconds between calls (well under 60/min)

class MarketDataFetcher {
  private apiKey: string | null = null;
  private lastCallTime = 0;

  constructor() {
    this.apiKey = process.env.FINNHUB_API_KEY || null;
    if (this.apiKey) {
      console.log('[MarketData] Finnhub API key configured');
    } else {
      console.log('[MarketData] No FINNHUB_API_KEY set - backtest will use cached data only');
    }
  }

  /**
   * Rate-limited fetch wrapper
   */
  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    this.lastCallTime = Date.now();
    return fetch(url);
  }

  /**
   * Fetch daily candle data from Finnhub for a date range
   * Returns data sorted by date ascending
   */
  public async fetchDailyCandles(
    days = 30,
    symbol = DEFAULT_SYMBOL
  ): Promise<MarketDataPoint[]> {
    if (!this.apiKey) {
      console.log('[MarketData] No API key - returning cached data only');
      return storage.getMarketData(days);
    }

    // Check which dates we already have
    const existingDates = storage.getExistingMarketDates();
    console.log(`[MarketData] ${existingDates.size} dates already cached`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const fromTimestamp = Math.floor(startDate.getTime() / 1000);
    const toTimestamp = Math.floor(endDate.getTime() / 1000);

    try {
      const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${fromTimestamp}&to=${toTimestamp}&token=${this.apiKey}`;
      console.log(`[MarketData] Fetching ${symbol} candles for last ${days} days...`);

      const response = await this.rateLimitedFetch(url);

      if (!response.ok) {
        console.error(`[MarketData] Finnhub API error: ${response.status}`);
        return storage.getMarketData(days);
      }

      const data = await response.json();

      if (data.s !== 'ok' || !data.c || !data.t) {
        console.error('[MarketData] Finnhub returned no data:', data.s);
        return storage.getMarketData(days);
      }

      // Parse candle data into MarketDataPoint[]
      const points: MarketDataPoint[] = [];
      for (let i = 0; i < data.t.length; i++) {
        const date = new Date(data.t[i] * 1000).toISOString().split('T')[0];
        const close = data.c[i];
        const prevClose = i > 0 ? data.c[i - 1] : close;
        const changePct = i > 0 ? ((close - prevClose) / prevClose) * 100 : 0;

        points.push({
          date,
          symbol,
          close: Math.round(close * 100) / 100,
          changePct: Math.round(changePct * 1000) / 1000,
          volume: data.v[i] || 0
        });
      }

      // Save new data points to SQLite (only those we don't have)
      const newPoints = points.filter(p => !existingDates.has(p.date));
      if (newPoints.length > 0) {
        storage.saveMarketData(newPoints);
        console.log(`[MarketData] Cached ${newPoints.length} new data points`);
      }

      console.log(`[MarketData] Total: ${points.length} trading days fetched`);
      return points;

    } catch (error) {
      console.error('[MarketData] Fetch failed, using cached data:', error);
      return storage.getMarketData(days);
    }
  }

  /**
   * Get cached market data without making API calls
   */
  public getCachedData(days = 30): MarketDataPoint[] {
    return storage.getMarketData(days);
  }

  /**
   * Check if Finnhub API is configured
   */
  public isConfigured(): boolean {
    return this.apiKey !== null;
  }
}

export const marketDataFetcher = new MarketDataFetcher();
