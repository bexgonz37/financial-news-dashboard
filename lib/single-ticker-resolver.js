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

    // Stage 1: Source tickers (if present)
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

    // Stage 2: Exact symbol mentions
    const symbolMatches = combinedText.match(/\b([A-Z]{1,5})\b/g);
    if (symbolMatches) {
      for (const match of symbolMatches) {
        const symbol = comprehensiveSymbolMaster.getSymbol(match);
        if (symbol && symbol.isActive) {
          const inTitle = title.toLowerCase().includes(match.toLowerCase());
          const score = 95 + (inTitle ? 5 : 0);
          
          candidates.push({
            symbol: match,
            score,
            matchType: 'exact_symbol',
            context: inTitle ? 'title' : 'body',
            confidence: 0.95,
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
          
          candidates.push({
            symbol: ticker,
            score,
            matchType: 'cashtag',
            context: inTitle ? 'title' : 'body',
            confidence: 0.95,
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
        
        candidates.push({
          symbol: symbol.symbol,
          score,
          matchType: 'exact_company_name',
          context: inTitle ? 'title' : 'body',
          confidence: 0.9,
          matchedPhrase: symbol.companyName
        });
      }

      // Alias matching
      for (const alias of symbol.aliases || []) {
        if (!alias || alias.length < 3) continue;

        const normalizedAlias = this.normalizeText(alias);
        if (normalizedText.includes(normalizedAlias)) {
          const inTitle = this.normalizeText(title).includes(normalizedAlias);
          const score = 80 + (inTitle ? 5 : 0);
          
          candidates.push({
            symbol: symbol.symbol,
            score,
            matchType: 'alias',
            context: inTitle ? 'title' : 'body',
            confidence: 0.8,
            matchedPhrase: alias
          });
        }
      }
    }

    // Stage 5: Domain hints
    const domainHint = this.extractDomainHint(url);
    if (domainHint) {
      const symbol = comprehensiveSymbolMaster.getSymbol(domainHint);
      if (symbol && symbol.isActive) {
        candidates.push({
          symbol: domainHint,
          score: 85,
          matchType: 'domain_hint',
          context: 'url',
          confidence: 0.85,
          matchedPhrase: domainHint
        });
      }
    }

    // Remove duplicates and sort by score
    const uniqueCandidates = this.removeDuplicates(candidates);
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

    // Select primary ticker (highest score)
    const primaryTicker = uniqueCandidates.length > 0 ? uniqueCandidates[0] : null;
    
    // Select secondary tickers only for explicit multi-company articles
    const secondaryTickers = this.selectSecondaryTickers(uniqueCandidates, combinedText);

    return {
      primaryTicker: primaryTicker ? primaryTicker.symbol : null,
      secondaryTickers: secondaryTickers.map(c => c.symbol),
      confidence: primaryTicker ? primaryTicker.confidence : 0,
      isGeneral: !primaryTicker,
      reason: primaryTicker ? `${primaryTicker.matchType} match` : 'No confident match',
      matchDetails: [primaryTicker, ...secondaryTickers].filter(Boolean)
    };
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
