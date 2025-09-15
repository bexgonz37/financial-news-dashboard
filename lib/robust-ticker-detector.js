// Robust Ticker Detector - Name→ticker resolution with caching
import { comprehensiveSymbolMaster } from './comprehensive-symbol-master.js';

class RobustTickerDetector {
  constructor() {
    this.cache = new Map(); // article hash -> ticker results
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
    this.minConfidence = 0.8; // Minimum confidence threshold
  }

  async detectTickers(article) {
    // Generate cache key
    const cacheKey = this.generateCacheKey(article);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.result;
    }

    // Detect tickers
    const result = await this.performDetection(article);
    
    // Cache result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  generateCacheKey(article) {
    const content = `${article.title || ''}|${article.summary || ''}|${article.url || ''}`;
    return Buffer.from(content).toString('base64').slice(0, 32);
  }

  async performDetection(article) {
    const title = article.title || '';
    const summary = article.summary || '';
    const content = article.content || '';
    const url = article.url || '';

    // Combine text for analysis
    const combinedText = `${title} ${summary}`;
    const fullText = `${title} ${summary} ${content}`;

    const candidates = new Map(); // symbol -> { score, matchType, context, confidence }

    // Stage 1: Source tickers (if present)
    if (article.tickers && Array.isArray(article.tickers)) {
      for (const ticker of article.tickers) {
        const symbol = comprehensiveSymbolMaster.getSymbol(ticker);
        if (symbol && symbol.isActive) {
          candidates.set(ticker, {
            score: 100,
            matchType: 'source',
            context: 'provided',
            confidence: 1.0,
            matchedPhrase: ticker
          });
        }
      }
    }

    // Stage 2: Exact symbol mentions
    const symbolMatches = combinedText.match(/\b([A-Z]{1,5})\b/g);
    if (symbolMatches) {
      for (const match of symbolMatches) {
        const symbol = comprehensiveSymbolMaster.getSymbol(match);
        if (symbol && symbol.isActive) {
          const inTitle = title.toLowerCase().includes(match.toLowerCase());
          const score = 95 + (inTitle ? 5 : 0);
          const confidence = 0.95;

          candidates.set(match, {
            score,
            matchType: 'exact_symbol',
            context: inTitle ? 'title' : 'body',
            confidence,
            matchedPhrase: match
          });
        }
      }
    }

    // Stage 3: Cashtag patterns
    const cashtagMatches = combinedText.match(/\$([A-Z]{1,5})\b/g);
    if (cashtagMatches) {
      for (const match of cashtagMatches) {
        const ticker = match.substring(1);
        const symbol = comprehensiveSymbolMaster.getSymbol(ticker);
        if (symbol && symbol.isActive) {
          const inTitle = title.toLowerCase().includes(`$${ticker.toLowerCase()}`);
          const score = 95 + (inTitle ? 5 : 0);
          const confidence = 0.95;

          candidates.set(ticker, {
            score,
            matchType: 'cashtag',
            context: inTitle ? 'title' : 'body',
            confidence,
            matchedPhrase: match
          });
        }
      }
    }

    // Stage 4: Company name matching
    const allSymbols = comprehensiveSymbolMaster.getAllActiveSymbols();
    for (const symbol of allSymbols) {
      if (!symbol.companyName) continue;

      const normalizedName = this.normalizeText(symbol.companyName);
      const normalizedText = this.normalizeText(combinedText);

      // Exact company name match
      if (normalizedText.includes(normalizedName)) {
        const inTitle = this.normalizeText(title).includes(normalizedName);
        const score = 90 + (inTitle ? 5 : 0);
        const confidence = 0.9;

        const existing = candidates.get(symbol.symbol);
        if (!existing || score > existing.score) {
          candidates.set(symbol.symbol, {
            score,
            matchType: 'exact_company_name',
            context: inTitle ? 'title' : 'body',
            confidence,
            matchedPhrase: symbol.companyName
          });
        }
      }

      // Alias matching
      for (const alias of symbol.aliases || []) {
        if (!alias || alias.length < 3) continue;

        const normalizedAlias = this.normalizeText(alias);
        if (normalizedText.includes(normalizedAlias)) {
          const inTitle = this.normalizeText(title).includes(normalizedAlias);
          const score = 80 + (inTitle ? 5 : 0);
          const confidence = 0.8;

          const existing = candidates.get(symbol.symbol);
          if (!existing || score > existing.score) {
            candidates.set(symbol.symbol, {
              score,
              matchType: 'alias',
              context: inTitle ? 'title' : 'body',
              confidence,
              matchedPhrase: alias
            });
          }
        }
      }
    }

    // Stage 5: Fuzzy matching (only if no high-confidence matches)
    const highConfidenceMatches = Array.from(candidates.values()).filter(c => c.confidence >= 0.85);
    if (highConfidenceMatches.length === 0) {
      for (const symbol of allSymbols) {
        if (!symbol.companyName) continue;

        const similarity = this.calculateSimilarity(
          this.normalizeText(symbol.companyName),
          this.normalizeText(combinedText)
        );

        if (similarity >= 0.8) {
          const inTitle = this.calculateSimilarity(
            this.normalizeText(symbol.companyName),
            this.normalizeText(title)
          ) >= 0.8;

          const score = Math.floor(similarity * 100) + (inTitle ? 5 : 0);
          const confidence = similarity;

          const existing = candidates.get(symbol.symbol);
          if (!existing || score > existing.score) {
            candidates.set(symbol.symbol, {
              score,
              matchType: 'fuzzy',
              context: inTitle ? 'title' : 'body',
              confidence,
              matchedPhrase: symbol.companyName
            });
          }
        }
      }
    }

    // Filter and sort candidates
    const validCandidates = Array.from(candidates.entries())
      .filter(([symbol, data]) => data.confidence >= this.minConfidence)
      .sort((a, b) => {
        const [symbolA, dataA] = a;
        const [symbolB, dataB] = b;
        
        // Sort by score (desc), then by context (title first)
        if (dataA.score !== dataB.score) return dataB.score - dataA.score;
        return dataA.context === 'title' ? -1 : 1;
      });

    // Determine if this is a general/sector article
    const isGeneralArticle = this.isGeneralArticle(combinedText, validCandidates);
    
    if (isGeneralArticle) {
      return {
        tickers: [],
        matchDetails: [],
        confidence: 0,
        isGeneral: true,
        reason: 'General/sector article detected'
      };
    }

    // Apply limits
    const maxTickers = this.determineMaxTickers(validCandidates);
    const selectedCandidates = validCandidates.slice(0, maxTickers);

    const tickers = selectedCandidates.map(([symbol, _]) => symbol);
    const matchDetails = selectedCandidates.map(([symbol, data]) => ({
      symbol,
      matchType: data.matchType,
      score: data.score,
      context: data.context,
      confidence: data.confidence,
      matchedPhrase: data.matchedPhrase
    }));

    const avgConfidence = matchDetails.length > 0 
      ? matchDetails.reduce((sum, detail) => sum + detail.confidence, 0) / matchDetails.length
      : 0;

    return {
      tickers,
      matchDetails,
      confidence: avgConfidence,
      isGeneral: false
    };
  }

  isGeneralArticle(text, candidates) {
    const generalKeywords = [
      'market', 'stocks', 'trading', 'investors', 'economy', 'fed', 'federal reserve',
      'inflation', 'recession', 'bull market', 'bear market', 'volatility', 'sector',
      'industry', 'nasdaq', 'dow jones', 's&p 500', 'spy', 'qqq', 'vix'
    ];

    const textLower = text.toLowerCase();
    const generalKeywordCount = generalKeywords.filter(keyword => 
      textLower.includes(keyword)
    ).length;

    // If many general keywords and no high-confidence company matches
    const highConfidenceCompanyMatches = candidates.filter(c => 
      c[1].matchType === 'exact_company_name' || c[1].matchType === 'alias'
    ).length;

    return generalKeywordCount >= 3 && highConfidenceCompanyMatches === 0;
  }

  determineMaxTickers(candidates) {
    // Check if this is clearly a multi-company article
    const hasMultipleExplicitMentions = candidates.filter(c => 
      c[1].matchType === 'exact_symbol' || c[1].matchType === 'cashtag'
    ).length > 1;

    return hasMultipleExplicitMentions ? 3 : 1;
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0 || len2 === 0) return 0.0;
    
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    if (matchWindow < 0) return 0.0;
    
    const str1Matches = new Array(len1).fill(false);
    const str2Matches = new Array(len2).fill(false);
    
    let matches = 0;
    let transpositions = 0;
    
    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);
      
      for (let j = start; j < end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }
    
    if (matches === 0) return 0.0;
    
    // Count transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!str1Matches[i]) continue;
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }
    
    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
    
    // Winkler prefix bonus
    let prefix = 0;
    for (let i = 0; i < Math.min(len1, len2, 4); i++) {
      if (str1[i] === str2[i]) prefix++;
      else break;
    }
    
    return jaro + (prefix * 0.1 * (1 - jaro));
  }

  // Clear expired cache entries
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache) {
      if ((now - value.timestamp) > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL
    };
  }
}

// Export singleton instance
export const robustTickerDetector = new RobustTickerDetector();

// Clear expired cache every hour
setInterval(() => {
  robustTickerDetector.clearExpiredCache();
}, 60 * 60 * 1000);
