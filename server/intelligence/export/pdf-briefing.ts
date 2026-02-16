/**
 * PDF Briefing Export
 *
 * Generates a clean one-page PDF briefing containing:
 * - Executive summary
 * - Top 3 topics with sentiment
 * - GPR index
 * - Key metrics
 *
 * Uses basic HTML → PDF approach via the browser (client-side print).
 * This server module generates structured HTML that can be rendered as PDF.
 */

import { DailyBriefing, ArticleCluster } from '../core/types';

class PDFBriefingGenerator {

  /**
   * Generate a structured HTML document suitable for PDF printing
   */
  public generateBriefingHTML(briefing: DailyBriefing): string {
    const topClusters = briefing.topClusters.slice(0, 5);
    const gpr = briefing.gprIndex;
    const sentiment = briefing.marketSentiment;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Intelligence Briefing - ${briefing.date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; font-weight: 600; }
    .header .date { font-size: 13px; color: #666; margin-top: 4px; }
    .metrics { display: flex; gap: 24px; margin-bottom: 24px; }
    .metric { flex: 1; padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px; }
    .metric .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
    .metric .value { font-size: 24px; font-weight: 600; margin-top: 4px; }
    .metric .sub { font-size: 11px; color: #888; margin-top: 2px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 12px; }
    .summary { font-size: 13px; line-height: 1.7; color: #333; }
    .topic { padding: 12px; border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 8px; }
    .topic .name { font-size: 13px; font-weight: 600; }
    .topic .meta { font-size: 11px; color: #888; margin-top: 4px; }
    .topic .sentiment { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .positive { background: #dcfce7; color: #166534; }
    .negative { background: #fee2e2; color: #991b1b; }
    .neutral { background: #f3f4f6; color: #4b5563; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #999; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Market Intelligence Briefing</h1>
    <div class="date">${this.formatDate(briefing.date)} | Generated ${new Date(briefing.generatedAt).toLocaleString()}</div>
  </div>

  <div class="metrics">
    <div class="metric">
      <div class="label">GPR Index</div>
      <div class="value">${gpr.current}</div>
      <div class="sub">${gpr.trend === 'rising' ? '↑ Rising' : gpr.trend === 'falling' ? '↓ Falling' : '→ Stable'}</div>
    </div>
    <div class="metric">
      <div class="label">Market Sentiment</div>
      <div class="value">${sentiment.overall > 0 ? '+' : ''}${Math.round(sentiment.overall)}</div>
      <div class="sub">${sentiment.trend}</div>
    </div>
    <div class="metric">
      <div class="label">Topics Identified</div>
      <div class="value">${briefing.topClusters.length}</div>
      <div class="sub">from ${briefing.topClusters.reduce((sum, c) => sum + c.articleCount, 0)} articles</div>
    </div>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <div class="summary">
      ${briefing.executiveSummary.split('\n\n').map(p => `<p style="margin-bottom: 8px;">${this.escapeHtml(p)}</p>`).join('')}
    </div>
  </div>

  <div class="section">
    <h2>Top Topics</h2>
    ${topClusters.map(cluster => this.renderCluster(cluster)).join('')}
  </div>

  <div class="footer">
    Market Intelligence Platform | Automated analysis - not financial advice | ${briefing.source === 'gemini' ? 'Gemini Pro' : 'Local Analysis'}
  </div>
</body>
</html>`;
  }

  /**
   * Generate a plain-text briefing for email
   */
  public generateBriefingText(briefing: DailyBriefing): string {
    const gpr = briefing.gprIndex;
    const sentiment = briefing.marketSentiment;
    const topClusters = briefing.topClusters.slice(0, 5);

    let text = `MARKET INTELLIGENCE BRIEFING\n`;
    text += `${this.formatDate(briefing.date)}\n`;
    text += `${'='.repeat(50)}\n\n`;

    text += `KEY METRICS\n`;
    text += `- GPR Index: ${gpr.current}/100 (${gpr.trend})\n`;
    text += `- Market Sentiment: ${sentiment.overall > 0 ? '+' : ''}${Math.round(sentiment.overall)} (${sentiment.trend})\n`;
    text += `- Topics: ${briefing.topClusters.length} from ${briefing.topClusters.reduce((sum, c) => sum + c.articleCount, 0)} articles\n\n`;

    text += `EXECUTIVE SUMMARY\n`;
    text += `${'-'.repeat(30)}\n`;
    text += `${briefing.executiveSummary}\n\n`;

    text += `TOP TOPICS\n`;
    text += `${'-'.repeat(30)}\n`;
    for (const cluster of topClusters) {
      const sentimentLabel = cluster.aggregateSentiment > 10 ? 'Positive' :
        cluster.aggregateSentiment < -10 ? 'Negative' : 'Neutral';
      text += `\n• ${cluster.topic}\n`;
      text += `  Sentiment: ${sentimentLabel} (${cluster.aggregateSentiment > 0 ? '+' : ''}${Math.round(cluster.aggregateSentiment)})\n`;
      text += `  Articles: ${cluster.articleCount} | Impact: ${Math.round(cluster.aggregateImpact)}\n`;
    }

    text += `\n${'='.repeat(50)}\n`;
    text += `Market Intelligence Platform | Automated analysis - not financial advice\n`;

    return text;
  }

  private renderCluster(cluster: ArticleCluster): string {
    const sentimentClass = cluster.aggregateSentiment > 10 ? 'positive' :
      cluster.aggregateSentiment < -10 ? 'negative' : 'neutral';
    const sentimentLabel = cluster.aggregateSentiment > 10 ? 'Positive' :
      cluster.aggregateSentiment < -10 ? 'Negative' : 'Neutral';

    return `
    <div class="topic">
      <div class="name">${this.escapeHtml(cluster.topic)}</div>
      <div class="meta">
        <span class="sentiment ${sentimentClass}">${sentimentLabel} (${cluster.aggregateSentiment > 0 ? '+' : ''}${Math.round(cluster.aggregateSentiment)})</span>
        &nbsp;·&nbsp;${cluster.articleCount} articles&nbsp;·&nbsp;Impact: ${Math.round(cluster.aggregateImpact)}
      </div>
    </div>`;
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const pdfBriefingGenerator = new PDFBriefingGenerator();
