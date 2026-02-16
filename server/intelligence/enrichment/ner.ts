import nlp from 'compromise';

/**
 * Named Entity Recognition Engine
 * Uses compromise.js for lightweight, fast NER
 *
 * Extracts: People, Organizations, Places, Topics
 */

export interface ExtractedEntities {
  people: string[];
  organizations: string[];
  places: string[];
  topics: string[];
}

export class NEREngine {
  /**
   * Extract named entities from text
   */
  public extract(text: string): ExtractedEntities {
    const doc = nlp(text);

    // Extract people (names)
    const people = doc.people().out('array') as string[];

    // Extract organizations (companies, institutions)
    const organizations = doc.organizations().out('array') as string[];

    // Extract places (locations, countries, cities)
    const places = doc.places().out('array') as string[];

    // Extract topics (nouns that aren't people/orgs/places)
    const allNouns = doc.nouns().out('array') as string[];
    const topics = this.extractTopics(allNouns, people, organizations, places);

    return {
      people: this.dedupe(people),
      organizations: this.dedupe(organizations),
      places: this.dedupe(places),
      topics: this.dedupe(topics).slice(0, 10) // Limit to top 10 topics
    };
  }

  /**
   * Extract topics from nouns, excluding named entities
   */
  private extractTopics(
    nouns: string[],
    people: string[],
    orgs: string[],
    places: string[]
  ): string[] {
    const excludeSet = new Set([
      ...people.map(p => p.toLowerCase()),
      ...orgs.map(o => o.toLowerCase()),
      ...places.map(p => p.toLowerCase())
    ]);

    // Common stop words to exclude
    const stopWords = new Set([
      'the', 'a', 'an', 'this', 'that', 'these', 'those',
      'it', 'its', 'they', 'them', 'their', 'we', 'our',
      'you', 'your', 'he', 'she', 'him', 'her', 'his',
      'what', 'which', 'who', 'whom', 'whose',
      'thing', 'things', 'way', 'ways', 'time', 'times',
      'year', 'years', 'day', 'days', 'week', 'weeks',
      'month', 'months', 'today', 'yesterday', 'tomorrow'
    ]);

    return nouns
      .filter(noun => {
        const lower = noun.toLowerCase().trim();
        return (
          noun.length > 2 &&
          !excludeSet.has(lower) &&
          !stopWords.has(lower) &&
          !/^\d+$/.test(noun) && // Exclude pure numbers
          !/[''\u2018\u2019\[\]…]/.test(noun) && // Exclude contractions, brackets, ellipsis
          !/^(a|an|the|some|any|no|my|his|her|its|our|your|their)\s/i.test(noun) && // Exclude articles/determiners as prefix ("A Price Tag", "The Company")
          !/^[a-z]/.test(noun.trim()) // Exclude lowercase-starting words (not proper nouns)
        );
      })
      .map(noun => noun.trim());
  }

  /**
   * Deduplicate and normalize entity list
   */
  private dedupe(items: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of items) {
      const normalized = item.trim();
      const lower = normalized.toLowerCase();

      if (normalized.length > 1 && !seen.has(lower)) {
        seen.add(lower);
        result.push(normalized);
      }
    }

    return result;
  }

  /**
   * Quick check if text contains any company/ticker mentions
   */
  public containsFinancialEntities(text: string): boolean {
    const doc = nlp(text);
    return doc.organizations().length > 0 || doc.match('#Acronym').length > 0;
  }

  /**
   * Extract potential stock tickers (uppercase 1-5 letter words)
   */
  public extractTickers(text: string): string[] {
    const tickerPattern = /\b[A-Z]{1,5}\b/g;
    const matches = text.match(tickerPattern) || [];

    // Filter out common words that look like tickers
    const excludeWords = new Set([
      'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL',
      'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'HAS', 'HIS',
      'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY',
      'WHO', 'BOY', 'DID', 'GET', 'HIM', 'LET', 'PUT', 'SAY',
      'SHE', 'TOO', 'USE', 'CEO', 'CFO', 'CTO', 'COO', 'IPO',
      'GDP', 'USA', 'UK', 'EU', 'UN', 'IMF', 'FBI', 'CIA'
    ]);

    return matches.filter(t => !excludeWords.has(t));
  }
}

export const nerEngine = new NEREngine();
