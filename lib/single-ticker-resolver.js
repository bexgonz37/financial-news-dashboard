// Single Ticker Resolver - One primary ticker per article
import { comprehensiveSymbolMaster } from './comprehensive-symbol-master.js';

class SingleTickerResolver {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 300000; // 5 minutes
  }

  async resolveTicker(article) {
    const cacheKey = this.generateCacheKey(article);
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.result;
    }

    const result = await this.performResolution(article);
    
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

  async performResolution(article) {
    const title = article.title || '';
    const summary = article.summary || '';
    const url = article.url || '';
    const content = article.content || '';

    // Combine text for analysis
    const combinedText = `${title} ${summary}`;
    const fullText = `${title} ${summary} ${content}`;

    const candidates = [];

    // Stage 1: Source tickers (if present) - highest confidence
    if (article.tickers && Array.isArray(article.tickers)) {
      for (const ticker of article.tickers) {
        const symbol = comprehensiveSymbolMaster.getSymbol(ticker);
        if (symbol && symbol.isActive) {
          candidates.push({
            symbol: ticker,
            score: 100,
            matchType: 'source',
            context: 'provided',
            confidence: 1.0,
            matchedPhrase: ticker
          });
        }
      }
    }

    // Stage 2: Ticker literal patterns - exact word boundaries
    const tickerPatterns = [
      /\b([A-Z]{1,5})\s*:/g,  // "AAPL:"
      /\(([A-Z]{1,5})\)/g,    // "(AAPL)"
      /\b([A-Z]{1,5})\s*\(/g  // "AAPL ("
    ];
    
    for (const pattern of tickerPatterns) {
      const matches = combinedText.match(pattern);
      if (matches) {
        for (const match of matches) {
          const ticker = match.replace(/[:\s\(\)]/g, '');
          const symbol = comprehensiveSymbolMaster.getSymbol(ticker);
          if (symbol && symbol.isActive) {
            const inTitle = title.toLowerCase().includes(match.toLowerCase());
            const score = 30 + (inTitle ? 30 : 0); // +30 title, +15 summary
            
            candidates.push({
              symbol: ticker,
              score,
              matchType: 'ticker_literal',
              context: inTitle ? 'title' : 'summary',
              confidence: 0.8,
              matchedPhrase: match
            });
          }
        }
      }
    }

    // Stage 3: Cashtag patterns - exact word boundaries
    const cashtagMatches = combinedText.match(/\$([A-Z]{1,5})\b/g);
    if (cashtagMatches) {
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
            matchedPhrase: match
          });
        }
      }
    }

    // Stage 4: Exchange hint in URL
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
          matchedPhrase: domainHint
        });
      }
    }

    // Stage 5: Exact company name matching - conservative approach
    const allSymbols = comprehensiveSymbolMaster.getAllActiveSymbols();
    for (const symbol of allSymbols) {
      if (!symbol.companyName) continue;

      const companyName = symbol.companyName;
      const normalizedName = this.normalizeText(companyName);
      const normalizedTitle = this.normalizeText(title);
      const normalizedSummary = this.normalizeText(summary);

      // Exact whole-word company name match in title
      if (this.hasExactWordMatch(normalizedTitle, normalizedName)) {
        candidates.push({
          symbol: symbol.symbol,
          score: 80, // +80 for headline
          matchType: 'exact_company_name',
          context: 'title',
          confidence: 0.95,
          matchedPhrase: companyName
        });
      } 
      // Exact whole-word company name match in summary
      else if (this.hasExactWordMatch(normalizedSummary, normalizedName)) {
        candidates.push({
          symbol: symbol.symbol,
          score: 60, // +60 for summary
          matchType: 'exact_company_name',
          context: 'summary',
          confidence: 0.85,
          matchedPhrase: companyName
        });
      }
      // Partial company name match in title (more aggressive)
      else if (this.hasPartialMatch(normalizedTitle, normalizedName)) {
        candidates.push({
          symbol: symbol.symbol,
          score: 50, // +50 for partial headline match
          matchType: 'partial_company_name',
          context: 'title',
          confidence: 0.7,
          matchedPhrase: companyName
        });
      }
      // Partial company name match in summary
      else if (this.hasPartialMatch(normalizedSummary, normalizedName)) {
        candidates.push({
          symbol: symbol.symbol,
          score: 30, // +30 for partial summary match
          matchType: 'partial_company_name',
          context: 'summary',
          confidence: 0.6,
          matchedPhrase: companyName
        });
      }

      // Clean alias match - only from this company's aliases
      for (const alias of symbol.aliases || []) {
        if (!alias || alias.length < 3) continue;

        const normalizedAlias = this.normalizeText(alias);
        
        if (this.hasExactWordMatch(normalizedTitle, normalizedAlias)) {
          candidates.push({
            symbol: symbol.symbol,
            score: 20, // +20 for headline
            matchType: 'clean_alias',
            context: 'title',
            confidence: 0.7,
            matchedPhrase: alias
          });
        } else if (this.hasExactWordMatch(normalizedSummary, normalizedAlias)) {
          candidates.push({
            symbol: symbol.symbol,
            score: 10, // +10 for summary
            matchType: 'clean_alias',
            context: 'summary',
            confidence: 0.6,
            matchedPhrase: alias
          });
        }
      }
    }

    // Apply negative signals
    const scoredCandidates = this.applyNegativeSignals(candidates, combinedText);

    // Remove duplicates and sort by score
    const uniqueCandidates = this.removeDuplicates(scoredCandidates);
    uniqueCandidates.sort((a, b) => b.score - a.score);

    // Determine if this is a general/sector article
    const isGeneralArticle = this.isGeneralArticle(combinedText, uniqueCandidates);
    
    if (isGeneralArticle) {
      return {
        primaryTicker: null,
        secondaryTickers: [],
        confidence: 0,
        isGeneral: true,
        reason: 'General/sector article detected',
        matchDetails: []
      };
    }

    // Apply confidence threshold: score >= 60 and exceeds #2 by >= 15
    const primaryTicker = this.selectPrimaryTicker(uniqueCandidates);
    
    // Select secondary tickers only for explicit multi-company articles
    const secondaryTickers = this.selectSecondaryTickers(uniqueCandidates, combinedText);

    return {
      primaryTicker: primaryTicker ? primaryTicker.symbol : null,
      secondaryTickers: secondaryTickers.map(c => c.symbol),
      confidence: primaryTicker ? primaryTicker.confidence : 0,
      isGeneral: !primaryTicker,
      reason: primaryTicker ? `${primaryTicker.matchType} match (score: ${primaryTicker.score})` : 'No confident match',
      matchDetails: [primaryTicker, ...secondaryTickers].filter(Boolean)
    };
  }

  // Check for exact word match with word boundaries
  hasExactWordMatch(text, word) {
    if (!text || !word) return false;
    
    // Create word boundary regex
    const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
    return regex.test(text);
  }

  // Check for partial match (company name contains or is contained in text)
  hasPartialMatch(text, word) {
    if (!text || !word) return false;
    
    const normalizedText = this.normalizeText(text);
    const normalizedWord = this.normalizeText(word);
    
    // Check if company name is contained in text
    if (normalizedText.includes(normalizedWord)) {
      return true;
    }
    
    // Check if text is contained in company name (for abbreviations)
    if (normalizedWord.includes(normalizedText)) {
      return true;
    }
    
    // Check for word overlap (at least 3 words in common)
    const textWords = normalizedText.split(/\s+/).filter(w => w.length > 2);
    const wordWords = normalizedWord.split(/\s+/).filter(w => w.length > 2);
    
    const commonWords = textWords.filter(w => wordWords.includes(w));
    return commonWords.length >= 2; // At least 2 words in common
  }

  // Escape special regex characters
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Apply negative signals to candidates
  applyNegativeSignals(candidates, text) {
    const stopwords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
    
    return candidates.map(candidate => {
      let score = candidate.score;
      
      // Check if matched phrase is a stopword
      const matchedPhrase = candidate.matchedPhrase.toLowerCase();
      if (stopwords.includes(matchedPhrase)) {
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
        score: Math.max(0, score) // Don't go below 0
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
    
    // Lower confidence threshold: score >= 30 and exceeds #2 by >= 10
    if (topCandidate.score >= 30) {
      if (!secondCandidate || (topCandidate.score - secondCandidate.score) >= 10) {
        return topCandidate;
      }
    }
    
    return null; // No confident match
  }

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

  selectSecondaryTickers(candidates, text) {
    // Only select secondary tickers for explicit multi-company articles
    const multiCompanyKeywords = ['merger', 'acquisition', 'lawsuit', 'partnership', 'joint venture', 'vs', 'versus'];
    const hasMultiCompanyKeywords = multiCompanyKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );

    if (!hasMultiCompanyKeywords) {
      return []; // Single company article
    }

    // Return up to 2 secondary tickers
    return candidates.slice(1, 3);
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
      c.matchType === 'exact_company_name' || c.matchType === 'alias'
    ).length;

    return generalKeywordCount >= 3 && highConfidenceCompanyMatches === 0;
  }

  extractDomainHint(url) {
    if (!url) return null;
    
    // Extract ticker from URLs like finance.yahoo.com/quote/AAPL
    const yahooMatch = url.match(/\/quote\/([A-Z]{1,5})/);
    if (yahooMatch) return yahooMatch[1];
    
    // Extract ticker from other common patterns
    const tickerMatch = url.match(/\/([A-Z]{1,5})(?:\/|$|\?)/);
    if (tickerMatch) return tickerMatch[1];
    
    return null;
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}

// Export singleton
export const singleTickerResolver = new SingleTickerResolver();
