import { callGemini } from '../../geminiPool';
import { ArticleCluster, DailyBriefing, GPRIndex } from '../core/types';

/**
 * Market Intelligence - Gemini Synthesis Engine
 * 
 * Generates high-fidelity analytical briefings from clustered news data.
 */
export class GeminiSynthesis {
    /**
     * Generate an executive summary from top clusters
     */
    public async generateSummary(
        date: string,
        clusters: ArticleCluster[],
        gprIndex: GPRIndex
    ): Promise<string> {
        const prompt = this.buildPrompt(date, clusters, gprIndex);

        try {
            console.log(`[Synthesis] Requesting Gemini briefing for ${date}...`);
            const response = await callGemini(prompt, {
                agent: 'analyst',
                model: 'gemini-2.0-flash',
                temperature: 0.75,
                maxOutputTokens: 800
            });

            return response;
        } catch (error) {
            console.error(`[Synthesis] Gemini failure:`, error);
            throw error;
        }
    }

    private buildPrompt(date: string, clusters: ArticleCluster[], gprIndex: GPRIndex): string {
        const clusterData = clusters.slice(0, 5).map((c, i) => {
            const articles = c.articles.slice(0, 3).map(a => `- ${a.title} (${a.source})`).join('\n');
            return `Topic #${i + 1}: ${c.topic}\nKeywords: ${c.keywords.slice(0, 5).join(', ')}\nSentiment: ${c.aggregateSentiment.toFixed(2)}\nImpact: ${c.aggregateImpact.toFixed(0)}\nRecent Headlines:\n${articles}`;
        }).join('\n\n');

        return `You are a Senior Market Strategist. Write a 250-350 word daily briefing for ${date}.
    
    Current Geopolitical Risk Index (GPR): ${gprIndex.current}/100 (${gprIndex.trend})
    
    CONTEXT DATA (Top 5 Trends):
    ${clusterData}
    
    INSTRUCTIONS:
    1. Focus on "Why this matters" for institutional investors.
    2. Connect the dots between different topics (e.g., how AI compute trends affect geopolitical tensions).
    3. Be specific about companies and sectors.
    4. Provide one "Strategic Outlook" sentence at the end.
    
    Format: Analytical prose. No headers. No bullet points.`;
    }
}

export const geminiSynthesis = new GeminiSynthesis();
