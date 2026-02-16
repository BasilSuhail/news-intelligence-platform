/**
 * Email Digest Service
 *
 * Sends intelligence briefings via email using Resend (already installed).
 * Supports configurable thresholds: "Email me if GPR > 60 or Impact > 80"
 *
 * Requires RESEND_API_KEY environment variable.
 */

import { Resend } from 'resend';
import { DailyBriefing } from '../core/types';
import { pdfBriefingGenerator } from './pdf-briefing';

interface DigestConfig {
  recipientEmail: string;
  gprThreshold?: number;     // Send if GPR exceeds this (default: 60)
  impactThreshold?: number;  // Send if any topic impact exceeds this (default: 80)
  alwaysSend?: boolean;      // Send regardless of thresholds
}

class EmailDigestService {
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      console.log('[EmailDigest] Resend API configured');
    } else {
      console.log('[EmailDigest] No RESEND_API_KEY set - email digest disabled');
    }
  }

  /**
   * Check if email service is configured
   */
  public isConfigured(): boolean {
    return this.resend !== null;
  }

  /**
   * Send a daily briefing email if thresholds are met
   */
  public async sendDigest(
    briefing: DailyBriefing,
    config: DigestConfig
  ): Promise<{ sent: boolean; reason: string }> {
    if (!this.resend) {
      return { sent: false, reason: 'Email service not configured (no RESEND_API_KEY)' };
    }

    // Check thresholds
    const gprThreshold = config.gprThreshold || 60;
    const impactThreshold = config.impactThreshold || 80;

    const gprExceeded = briefing.gprIndex.current >= gprThreshold;
    const impactExceeded = briefing.topClusters.some(
      c => c.aggregateImpact >= impactThreshold
    );

    if (!config.alwaysSend && !gprExceeded && !impactExceeded) {
      return {
        sent: false,
        reason: `Thresholds not met (GPR: ${briefing.gprIndex.current}/${gprThreshold}, max impact: ${Math.max(0, ...briefing.topClusters.map(c => c.aggregateImpact)).toFixed(0)}/${impactThreshold})`
      };
    }

    // Build email content
    const htmlContent = this.buildEmailHTML(briefing, gprExceeded, impactExceeded);
    const textContent = pdfBriefingGenerator.generateBriefingText(briefing);

    // Build subject line
    const alerts: string[] = [];
    if (gprExceeded) alerts.push(`GPR ${briefing.gprIndex.current}`);
    if (impactExceeded) alerts.push('High Impact');
    const alertSuffix = alerts.length > 0 ? ` [${alerts.join(', ')}]` : '';
    const subject = `Intelligence Briefing: ${briefing.date}${alertSuffix}`;

    try {
      console.log(`[EmailDigest] Sending digest to ${config.recipientEmail}...`);

      await this.resend.emails.send({
        from: 'Intelligence Platform <onboarding@resend.dev>',
        to: config.recipientEmail,
        subject,
        html: htmlContent,
        text: textContent
      });

      console.log(`[EmailDigest] Digest sent successfully`);
      return { sent: true, reason: 'Email sent' };
    } catch (error: any) {
      console.error('[EmailDigest] Failed to send:', error);
      return { sent: false, reason: `Send failed: ${error.message}` };
    }
  }

  /**
   * Build HTML email content
   */
  private buildEmailHTML(
    briefing: DailyBriefing,
    gprAlert: boolean,
    impactAlert: boolean
  ): string {
    const gpr = briefing.gprIndex;
    const sentiment = briefing.marketSentiment;
    const topClusters = briefing.topClusters.slice(0, 5);

    let alertBanner = '';
    if (gprAlert || impactAlert) {
      const alerts: string[] = [];
      if (gprAlert) alerts.push(`GPR Index at ${gpr.current}/100 (threshold exceeded)`);
      if (impactAlert) alerts.push('High-impact topic detected');

      alertBanner = `
        <div style="background:#fef3c7; border:1px solid #f59e0b; border-radius:8px; padding:12px 16px; margin-bottom:24px;">
          <strong style="color:#92400e;">Alert:</strong>
          <span style="color:#78350f;"> ${alerts.join(' | ')}</span>
        </div>`;
    }

    const clusterRows = topClusters.map(c => {
      const sentColor = c.aggregateSentiment > 10 ? '#166534' :
        c.aggregateSentiment < -10 ? '#991b1b' : '#4b5563';
      const sentBg = c.aggregateSentiment > 10 ? '#dcfce7' :
        c.aggregateSentiment < -10 ? '#fee2e2' : '#f3f4f6';
      const sentLabel = c.aggregateSentiment > 10 ? 'Positive' :
        c.aggregateSentiment < -10 ? 'Negative' : 'Neutral';

      return `
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e5e5;">${this.escapeHtml(c.topic)}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e5e5; text-align:center;">
            <span style="background:${sentBg}; color:${sentColor}; padding:2px 8px; border-radius:4px; font-size:11px;">${sentLabel}</span>
          </td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e5e5; text-align:center;">${c.articleCount}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e5e5; text-align:center;">${Math.round(c.aggregateImpact)}</td>
        </tr>`;
    }).join('');

    return `
    <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width:600px; margin:0 auto; color:#1a1a1a;">
      <div style="border-bottom:2px solid #1a1a1a; padding-bottom:12px; margin-bottom:20px;">
        <h1 style="font-size:20px; margin:0;">Market Intelligence Briefing</h1>
        <p style="font-size:12px; color:#666; margin:4px 0 0;">${briefing.date}</p>
      </div>

      ${alertBanner}

      <div style="display:flex; gap:12px; margin-bottom:20px;">
        <div style="flex:1; padding:12px; border:1px solid #e5e5e5; border-radius:8px;">
          <div style="font-size:10px; text-transform:uppercase; color:#888;">GPR Index</div>
          <div style="font-size:22px; font-weight:600;">${gpr.current}</div>
          <div style="font-size:11px; color:#888;">${gpr.trend}</div>
        </div>
        <div style="flex:1; padding:12px; border:1px solid #e5e5e5; border-radius:8px;">
          <div style="font-size:10px; text-transform:uppercase; color:#888;">Sentiment</div>
          <div style="font-size:22px; font-weight:600;">${sentiment.overall > 0 ? '+' : ''}${Math.round(sentiment.overall)}</div>
          <div style="font-size:11px; color:#888;">${sentiment.trend}</div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <h2 style="font-size:13px; text-transform:uppercase; letter-spacing:0.5px; color:#666; margin-bottom:8px;">Executive Summary</h2>
        <div style="font-size:13px; line-height:1.6; color:#333;">
          ${briefing.executiveSummary.split('\n\n').map(p => `<p style="margin:0 0 8px;">${this.escapeHtml(p)}</p>`).join('')}
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <h2 style="font-size:13px; text-transform:uppercase; letter-spacing:0.5px; color:#666; margin-bottom:8px;">Top Topics</h2>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px; text-align:left; border-bottom:2px solid #e5e5e5;">Topic</th>
              <th style="padding:8px 12px; text-align:center; border-bottom:2px solid #e5e5e5;">Sentiment</th>
              <th style="padding:8px 12px; text-align:center; border-bottom:2px solid #e5e5e5;">Articles</th>
              <th style="padding:8px 12px; text-align:center; border-bottom:2px solid #e5e5e5;">Impact</th>
            </tr>
          </thead>
          <tbody>
            ${clusterRows}
          </tbody>
        </table>
      </div>

      <div style="margin-top:24px; padding-top:12px; border-top:1px solid #e5e5e5; font-size:10px; color:#999;">
        Market Intelligence Platform | Automated analysis - not financial advice
      </div>
    </div>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const emailDigestService = new EmailDigestService();
