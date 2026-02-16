/**
 * Market Intelligence - Geopolitical Tagging Engine
 * 
 * Extracts geopolitical risk factors (sanctions, conflicts, etc.) 
 * from news text using weighted keyword matching.
 */

export interface GeoTagResult {
    tags: string[];
    riskWeight: number;
}

export class GeoTagEngine {
    private static readonly KEYWORDS: Record<string, string[]> = {
        sanctions: ['sanction', 'embargo', 'blacklist', 'export ban', 'import duty'],
        conflict: ['war', 'invasion', 'military', 'missile', 'attack', 'bombing', 'airstrike'],
        trade_war: ['tariff', 'trade war', 'trade restrictions', 'retaliatory'],
        political_instability: ['coup', 'protest', 'riot', 'martial law', 'political crisis'],
        diplomatic_tension: ['diplomatic crisis', 'expel diplomats', 'ultimatum', 'denounce'],
        regional_hotspot: ['taiwan', 'ukraine', 'gaza', 'south china sea', 'north korea', 'iran'],
        security: ['terrorism', 'cyberattack', 'espionage', 'intelligence', 'threat']
    };

    /**
     * Extract geopolitical tags from text
     */
    public static tag(text: string): GeoTagResult {
        const lowerText = text.toLowerCase();
        const matchedTags = new Set<string>();
        let totalWeight = 0;

        for (const [tag, keywords] of Object.entries(this.KEYWORDS)) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword)) {
                    matchedTags.add(tag);
                    totalWeight += this.getTagWeight(tag);
                    break; // Found one keyword for this tag, move to next tag
                }
            }
        }

        return {
            tags: Array.from(matchedTags),
            riskWeight: Math.min(100, totalWeight * 10) // Scaled
        };
    }

    private static getTagWeight(tag: string): number {
        const weights: Record<string, number> = {
            conflict: 4,
            sanctions: 3,
            trade_war: 2,
            regional_hotspot: 3,
            political_instability: 2,
            diplomatic_tension: 1,
            security: 2
        };
        return weights[tag] || 1;
    }
}
