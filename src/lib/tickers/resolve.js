// Pure ticker resolution with confidence scoring
import { comprehensiveSymbolMaster } from '../../../lib/comprehensive-symbol-master.js';

class TickerResolver {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 300000; // 5 minutes
    this.stopwords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
      'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'can', 'must', 'shall', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
      'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);
  }

  // Main resolution function
  async resolveTicker(newsItem) {
    const cacheKey = this.generateCacheKey(newsItem);
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.result;
    }

    const result = this.performResolution(newsItem);
    
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  // Generate cache key
  generateCacheKey(newsItem) {
    const content = `${newsItem.title || ''}|${newsItem.summary || ''}|${newsItem.url || ''}`;
    return Buffer.from(content).toString('base64').slice(0, 32);
  }

  // Perform ticker resolution
  performResolution(newsItem) {
    const title = newsItem.title || '';
    const summary = newsItem.summary || '';
    const url = newsItem.url || '';
    const content = newsItem.content || '';

    const candidates = [];

    // Stage 1: Source tickers (highest confidence)
    if (newsItem.tickers && Array.isArray(newsItem.tickers)) {
      for (const ticker of newsItem.tickers) {
        const symbol = comprehensiveSymbolMaster.getSymbol(ticker);
        if (symbol && symbol.isActive) {
          candidates.push({
            symbol: ticker,
            score: 100,
            matchType: 'source',
            context: 'provided',
            confidence: 1.0,
            matchedPhrase: ticker,
            reason: 'Provided by news source'
          });
        }
      }
    }

    // Stage 2: Ticker literal patterns
    const tickerPatterns = [
      { pattern: /\b([A-Z]{1,5})\s*:/g, name: 'colon' },
      { pattern: /\(([A-Z]{1,5})\)/g, name: 'parentheses' },
      { pattern: /\b([A-Z]{1,5})\s*\(/g, name: 'prefix' }
    ];
    
    for (const { pattern, name } of tickerPatterns) {
      const matches = this.findMatches(pattern, title + ' ' + summary);
      for (const match of matches) {
        const ticker = match.replace(/[:\s\(\)]/g, '');
        const symbol = comprehensiveSymbolMaster.getSymbol(ticker);
        if (symbol && symbol.isActive) {
          const inTitle = title.toLowerCase().includes(match.toLowerCase());
          const score = 30 + (inTitle ? 30 : 0);
          
          candidates.push({
            symbol: ticker,
            score,
            matchType: 'ticker_literal',
            context: inTitle ? 'title' : 'summary',
            confidence: 0.8,
            matchedPhrase: match,
            reason: `Ticker literal (${name})`
          });
        }
      }
    }

    // Stage 3: Cashtag patterns
    const cashtagMatches = this.findMatches(/\$([A-Z]{1,5})\b/g, title + ' ' + summary);
    for (const match of cashtagMatches) {
      const ticker = match.substring(1);
      const symbol = comprehensiveSymbolMaster.getSymbol(ticker);
      if (symbol && symbol.isActive) {
        const inTitle = title.toLowerCase().includes(`$${ticker.toLowerCase()}`);
        const score = 30 + (inTitle ? 30 : 0);
        
        candidates.push({
          symbol: ticker,
          score,
          matchType: 'cashtag',
          context: inTitle ? 'title' : 'summary',
          confidence: 0.8,
          matchedPhrase: match,
          reason: 'Cashtag pattern'
        });
      }
    }

    // Stage 4: Domain hints
    const domainHint = this.extractDomainHint(url);
    if (domainHint) {
      const symbol = comprehensiveSymbolMaster.getSymbol(domainHint);
      if (symbol && symbol.isActive) {
        candidates.push({
          symbol: domainHint,
          score: 25,
          matchType: 'domain_hint',
          context: 'url',
          confidence: 0.85,
          matchedPhrase: domainHint,
          reason: 'Domain hint from URL'
        });
      }
    }

    // Stage 5: Company name matching
    const allSymbols = comprehensiveSymbolMaster.getAllActiveSymbols();
    for (const symbol of allSymbols) {
      if (!symbol.companyName) continue;

      const companyName = symbol.companyName;
      const normalizedName = this.normalizeText(companyName);
      const normalizedTitle = this.normalizeText(title);
      const normalizedSummary = this.normalizeText(summary);

      // Exact company name match
      if (this.hasExactWordMatch(normalizedTitle, normalizedName)) {
        candidates.push({
          symbol: symbol.symbol,
          score: 60,
          matchType: 'exact_company_name',
          context: 'title',
          confidence: 0.9,
          matchedPhrase: companyName,
          reason: 'Exact company name in title'
        });
      } else if (this.hasExactWordMatch(normalizedSummary, normalizedName)) {
        candidates.push({
          symbol: symbol.symbol,
          score: 30,
          matchType: 'exact_company_name',
          context: 'summary',
          confidence: 0.8,
          matchedPhrase: companyName,
          reason: 'Exact company name in summary'
        });
      }

      // Clean alias match
      for (const alias of symbol.aliases || []) {
        if (!alias || alias.length < 3) continue;

        const normalizedAlias = this.normalizeText(alias);
        
        if (this.hasExactWordMatch(normalizedTitle, normalizedAlias)) {
          candidates.push({
            symbol: symbol.symbol,
            score: 20,
            matchType: 'clean_alias',
            context: 'title',
            confidence: 0.7,
            matchedPhrase: alias,
            reason: 'Company alias in title'
          });
        } else if (this.hasExactWordMatch(normalizedSummary, normalizedAlias)) {
          candidates.push({
            symbol: symbol.symbol,
            score: 10,
            matchType: 'clean_alias',
            context: 'summary',
            confidence: 0.6,
            matchedPhrase: alias,
            reason: 'Company alias in summary'
          });
        }
      }
    }

    // Apply negative signals
    const scoredCandidates = this.applyNegativeSignals(candidates, title + ' ' + summary);

    // Remove duplicates and sort by score
    const uniqueCandidates = this.removeDuplicates(scoredCandidates);
    uniqueCandidates.sort((a, b) => b.score - a.score);

    // Determine if this is a general/sector article
    const isGeneralArticle = this.isGeneralArticle(title + ' ' + summary, uniqueCandidates);
    
    if (isGeneralArticle) {
      return {
        ticker: null,
        confidence: 0,
        isGeneral: true,
        reason: 'General/sector article detected',
        matchDetails: []
      };
    }

    // Apply confidence threshold
    const primaryTicker = this.selectPrimaryTicker(uniqueCandidates);
    
    return {
      ticker: primaryTicker ? primaryTicker.symbol : null,
      confidence: primaryTicker ? primaryTicker.confidence : 0,
      isGeneral: !primaryTicker,
      reason: primaryTicker ? primaryTicker.reason : 'No confident match',
      matchDetails: primaryTicker ? [primaryTicker] : []
    };
  }

  // Find matches with regex
  findMatches(pattern, text) {
    const matches = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push(match[0]);
    }
    return matches;
  }

  // Check for exact word match with word boundaries
  hasExactWordMatch(text, word) {
    if (!text || !word) return false;
    
    const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
    return regex.test(text);
  }

  // Escape special regex characters
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Apply negative signals
  applyNegativeSignals(candidates, text) {
    return candidates.map(candidate => {
      let score = candidate.score;
      
      // Check if matched phrase is a stopword
      const matchedPhrase = candidate.matchedPhrase.toLowerCase();
      if (this.stopwords.has(matchedPhrase)) {
        score -= 40;
      }
      
      // Check if token appears only inside unrelated ticker lists
      if (this.isInTickerList(text, candidate.matchedPhrase)) {
        score -= 30;
      }
      
      // Check if it's a substring inside another word
      if (this.isSubstringInWord(text, candidate.matchedPhrase)) {
        score -= 40;
      }
      
      return {
        ...candidate,
        score: Math.max(0, score)
      };
    });
  }

  // Check if phrase appears in a ticker list context
  isInTickerList(text, phrase) {
    const tickerListPattern = /(?:tickers?|symbols?|stocks?):\s*([A-Z,\s]+)/i;
    const match = text.match(tickerListPattern);
    if (match) {
      const tickerList = match[1].split(/[,\s]+/).map(t => t.trim().toUpperCase());
      return tickerList.includes(phrase.toUpperCase());
    }
    return false;
  }

  // Check if phrase is a substring inside another word
  isSubstringInWord(text, phrase) {
    const words = text.split(/\s+/);
    for (const word of words) {
      if (word.toLowerCase().includes(phrase.toLowerCase()) && word.toLowerCase() !== phrase.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  // Select primary ticker with confidence threshold
  selectPrimaryTicker(candidates) {
    if (candidates.length === 0) return null;
    
    const topCandidate = candidates[0];
    const secondCandidate = candidates[1];
    
    // Confidence threshold: score >= 60 and exceeds #2 by >= 15
    if (topCandidate.score >= 60) {
      if (!secondCandidate || (topCandidate.score - secondCandidate.score) >= 15) {
        return topCandidate;
      }
    }
    
    return null;
  }

  // Check if article is general/sector
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

    const highConfidenceCompanyMatches = candidates.filter(c => 
      c.matchType === 'exact_company_name' || c.matchType === 'clean_alias'
    ).length;

    return generalKeywordCount >= 3 && highConfidenceCompanyMatches === 0;
  }

  // Extract domain hint from URL
  extractDomainHint(url) {
    if (!url) return null;
    
    const yahooMatch = url.match(/\/quote\/([A-Z]{1,5})/);
    if (yahooMatch) return yahooMatch[1];
    
    const tickerMatch = url.match(/\/([A-Z]{1,5})(?:\/|$|\?)/);
    if (tickerMatch) return tickerMatch[1];
    
    return null;
  }

  // Normalize text
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Remove duplicates
  removeDuplicates(candidates) {
    const seen = new Set();
    return candidates.filter(candidate => {
      if (seen.has(candidate.symbol)) {
        return false;
      }
      seen.add(candidate.symbol);
      return true;
    });
  }
}

// Export singleton
export const tickerResolver = new TickerResolver();
