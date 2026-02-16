/**
 * Market Intelligence Platform - Feedback System
 *
 * Collects user feedback on sentiment analysis and impact scoring
 * to build a "Golden Dataset" for future model fine-tuning.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// =============================================================================
// TYPES
// =============================================================================

export interface SentimentFeedback {
  id: string;
  articleId: string;
  headline: string;
  predictedSentiment: number;
  predictedLabel: 'positive' | 'negative' | 'neutral';
  userCorrection: 'positive' | 'negative' | 'neutral';
  comment?: string;
  category: string;
  timestamp: string;
}

export interface ImpactFeedback {
  id: string;
  articleId: string;
  headline: string;
  predictedImpact: number;
  userRating: 'too_high' | 'correct' | 'too_low';
  suggestedImpact?: number;
  reason?: string;
  timestamp: string;
}

export interface FeedbackStats {
  totalFeedback: number;
  sentiment: {
    total: number;
    agreementRate: number;
    corrections: {
      positiveToNegative: number;
      positiveToNeutral: number;
      negativeToPositive: number;
      negativeToNeutral: number;
      neutralToPositive: number;
      neutralToNegative: number;
    };
  };
  impact: {
    total: number;
    tooHigh: number;
    correct: number;
    tooLow: number;
    averageAdjustment: number;
  };
}

// =============================================================================
// FEEDBACK STORE
// =============================================================================

class FeedbackStore {
  private feedbackDir: string;

  constructor() {
    this.feedbackDir = path.join(
      process.env.NEWS_FEED_DIR || process.cwd(),
      'feedback'
    );
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.feedbackDir, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // SENTIMENT FEEDBACK
  // -------------------------------------------------------------------------

  async saveSentimentFeedback(feedback: SentimentFeedback): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.feedbackDir, 'sentiment_feedback.json');

    let existing: SentimentFeedback[] = [];
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      existing = JSON.parse(data);
    } catch {}

    existing.push(feedback);
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2));
    console.log(`[Feedback] Saved sentiment feedback: ${feedback.id}`);
  }

  async getSentimentFeedback(): Promise<SentimentFeedback[]> {
    try {
      const filePath = path.join(this.feedbackDir, 'sentiment_feedback.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // IMPACT FEEDBACK
  // -------------------------------------------------------------------------

  async saveImpactFeedback(feedback: ImpactFeedback): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.feedbackDir, 'impact_feedback.json');

    let existing: ImpactFeedback[] = [];
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      existing = JSON.parse(data);
    } catch {}

    existing.push(feedback);
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2));
    console.log(`[Feedback] Saved impact feedback: ${feedback.id}`);
  }

  async getImpactFeedback(): Promise<ImpactFeedback[]> {
    try {
      const filePath = path.join(this.feedbackDir, 'impact_feedback.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // ANALYTICS
  // -------------------------------------------------------------------------

  async getStats(): Promise<FeedbackStats> {
    const sentimentFeedback = await this.getSentimentFeedback();
    const impactFeedback = await this.getImpactFeedback();

    // Calculate sentiment agreement rate
    const sentimentAgreements = sentimentFeedback.filter(f => {
      const predicted = f.predictedSentiment > 20 ? 'positive' :
                       f.predictedSentiment < -20 ? 'negative' : 'neutral';
      return predicted === f.userCorrection;
    });

    // Count correction patterns
    const corrections = {
      positiveToNegative: 0,
      positiveToNeutral: 0,
      negativeToPositive: 0,
      negativeToNeutral: 0,
      neutralToPositive: 0,
      neutralToNegative: 0
    };

    sentimentFeedback.forEach(f => {
      const predicted = f.predictedSentiment > 20 ? 'positive' :
                       f.predictedSentiment < -20 ? 'negative' : 'neutral';
      if (predicted !== f.userCorrection) {
        const key = `${predicted}To${f.userCorrection.charAt(0).toUpperCase() + f.userCorrection.slice(1)}` as keyof typeof corrections;
        if (key in corrections) {
          corrections[key]++;
        }
      }
    });

    // Calculate impact stats
    const impactAdjustments = impactFeedback
      .filter(f => f.suggestedImpact !== undefined)
      .map(f => (f.suggestedImpact || 0) - f.predictedImpact);

    const averageAdjustment = impactAdjustments.length > 0
      ? impactAdjustments.reduce((sum, adj) => sum + adj, 0) / impactAdjustments.length
      : 0;

    return {
      totalFeedback: sentimentFeedback.length + impactFeedback.length,
      sentiment: {
        total: sentimentFeedback.length,
        agreementRate: sentimentFeedback.length > 0
          ? (sentimentAgreements.length / sentimentFeedback.length) * 100
          : 0,
        corrections
      },
      impact: {
        total: impactFeedback.length,
        tooHigh: impactFeedback.filter(f => f.userRating === 'too_high').length,
        correct: impactFeedback.filter(f => f.userRating === 'correct').length,
        tooLow: impactFeedback.filter(f => f.userRating === 'too_low').length,
        averageAdjustment: Math.round(averageAdjustment)
      }
    };
  }

  // -------------------------------------------------------------------------
  // EXPORT
  // -------------------------------------------------------------------------

  async exportToCSV(type: 'sentiment' | 'impact'): Promise<string> {
    if (type === 'sentiment') {
      const feedback = await this.getSentimentFeedback();
      const headers = ['id', 'headline', 'predicted_sentiment', 'predicted_label', 'user_correction', 'category', 'timestamp'];
      const rows = feedback.map(f => [
        f.id,
        `"${f.headline.replace(/"/g, '""')}"`,
        f.predictedSentiment,
        f.predictedLabel,
        f.userCorrection,
        f.category,
        f.timestamp
      ].join(','));
      return [headers.join(','), ...rows].join('\n');
    } else {
      const feedback = await this.getImpactFeedback();
      const headers = ['id', 'headline', 'predicted_impact', 'user_rating', 'suggested_impact', 'timestamp'];
      const rows = feedback.map(f => [
        f.id,
        `"${f.headline.replace(/"/g, '""')}"`,
        f.predictedImpact,
        f.userRating,
        f.suggestedImpact || '',
        f.timestamp
      ].join(','));
      return [headers.join(','), ...rows].join('\n');
    }
  }

  /**
   * Export in HuggingFace dataset format for fine-tuning
   */
  async exportForHuggingFace(): Promise<object[]> {
    const feedback = await this.getSentimentFeedback();
    return feedback.map(f => ({
      text: f.headline,
      label: f.userCorrection === 'positive' ? 2 :
             f.userCorrection === 'neutral' ? 1 : 0
    }));
  }
}

export const feedbackStore = new FeedbackStore();
