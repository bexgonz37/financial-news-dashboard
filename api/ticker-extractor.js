const fetch = require('node-fetch');

// Enhanced ticker extraction with caching
class TickerExtractor {
  constructor() {
    this.symbolCache = new Map();
    this.companyCache = new Map();
    this.loadCommonTickers();
  }

  // Load common tickers and aliases
  loadCommonTickers() {
    const commonTickers = {
      'AAPL': { name: 'Apple Inc.', aliases: ['apple', 'iphone', 'ipad', 'macbook', 'app store'] },
      'MSFT': { name: 'Microsoft Corporation', aliases: ['microsoft', 'windows', 'office', 'azure', 'xbox'] },
      'GOOGL': { name: 'Alphabet Inc.', aliases: ['google', 'youtube', 'android', 'chrome', 'search'] },
      'AMZN': { name: 'Amazon.com Inc.', aliases: ['amazon', 'aws', 'prime', 'alexa', 'kindle'] },
      'TSLA': { name: 'Tesla Inc.', aliases: ['tesla', 'model s', 'model 3', 'model x', 'model y', 'cybertruck'] },
      'META': { name: 'Meta Platforms Inc.', aliases: ['facebook', 'meta', 'instagram', 'whatsapp', 'oculus'] },
      'NVDA': { name: 'NVIDIA Corporation', aliases: ['nvidia', 'gpu', 'cuda', 'rtx', 'gtx', 'ai chips'] },
      'NFLX': { name: 'Netflix Inc.', aliases: ['netflix', 'streaming', 'netflix originals'] },
      'AMD': { name: 'Advanced Micro Devices', aliases: ['amd', 'ryzen', 'radeon', 'epyc'] },
      'INTC': { name: 'Intel Corporation', aliases: ['intel', 'core i7', 'core i5', 'xeon', 'pentium'] },
      'CRM': { name: 'Salesforce Inc.', aliases: ['salesforce', 'crm', 'sales cloud', 'service cloud'] },
      'ORCL': { name: 'Oracle Corporation', aliases: ['oracle', 'database', 'java', 'cloud infrastructure'] },
      'ADBE': { name: 'Adobe Inc.', aliases: ['adobe', 'photoshop', 'illustrator', 'acrobat', 'creative cloud'] },
      'PYPL': { name: 'PayPal Holdings Inc.', aliases: ['paypal', 'venmo', 'digital payments'] },
      'SQ': { name: 'Block Inc.', aliases: ['square', 'cash app', 'block', 'bitcoin'] },
      'UBER': { name: 'Uber Technologies Inc.', aliases: ['uber', 'rideshare', 'uber eats'] },
      'LYFT': { name: 'Lyft Inc.', aliases: ['lyft', 'rideshare', 'scooters'] },
      'SPOT': { name: 'Spotify Technology S.A.', aliases: ['spotify', 'music streaming', 'podcasts'] },
      'TWTR': { name: 'Twitter Inc.', aliases: ['twitter', 'tweets', 'social media'] },
      'SNAP': { name: 'Snap Inc.', aliases: ['snapchat', 'snap', 'ar filters', 'spectacles'] }
    };

    for (const [symbol, data] of Object.entries(commonTickers)) {
      this.symbolCache.set(symbol, data);
      for (const alias of data.aliases) {
        this.companyCache.set(alias.toLowerCase(), symbol);
      }
    }
  }

  // Extract tickers from news text
  async extractTickers(text, maxTickers = 6) {
    if (!text) return [];
    
    const tickers = new Set();
    const textLower = text.toLowerCase();
    
    // 1. Look for explicit $TICKER or (TICKER) patterns
    const explicitPatterns = [
      /\$([A-Z]{1,5})\b/g,  // $AAPL, $TSLA
      /\(([A-Z]{1,5})\)/g,  // (AAPL), (TSLA)
      /\b([A-Z]{1,5})\b/g   // AAPL, TSLA (standalone)
    ];
    
    for (const pattern of explicitPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const symbol = match[1].toUpperCase();
        if (this.isValidSymbol(symbol)) {
          tickers.add(symbol);
        }
      }
    }
    
    // 2. Look for company names and aliases
    for (const [alias, symbol] of this.companyCache) {
      if (textLower.includes(alias) && !tickers.has(symbol)) {
        tickers.add(symbol);
      }
    }
    
    // 3. If we still need more tickers, try API lookup for company names
    if (tickers.size < maxTickers) {
      const companyNames = this.extractCompanyNames(text);
      for (const companyName of companyNames) {
        if (tickers.size >= maxTickers) break;
        
        const symbol = await this.lookupCompanySymbol(companyName);
        if (symbol && !tickers.has(symbol)) {
          tickers.add(symbol);
        }
      }
    }
    
    return Array.from(tickers).slice(0, maxTickers);
  }

  // Extract potential company names from text
  extractCompanyNames(text) {
    const companyPatterns = [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|Corp|Corporation|Company|Ltd|Limited|LLC|LLP|Holdings|Technologies|Systems|Solutions)\b/g,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:announces|reports|launches|acquires|merges|partners)\b/g
    ];
    
    const companies = new Set();
    for (const pattern of companyPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const company = match[1].trim();
        if (company.length > 2 && company.length < 50) {
          companies.add(company);
        }
      }
    }
    
    return Array.from(companies);
  }

  // Lookup company symbol via API
  async lookupCompanySymbol(companyName) {
    try {
      // Try Alpha Vantage search
      const apiKey = process.env.ALPHAVANTAGE_KEY;
      if (apiKey) {
        const response = await fetch(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(companyName)}&apikey=${apiKey}`);
        const data = await response.json();
        
        if (data.bestMatches && data.bestMatches.length > 0) {
          const match = data.bestMatches[0];
          const symbol = match['1. symbol'];
          const name = match['2. name'];
          
          // Cache the result
          this.symbolCache.set(symbol, { name, aliases: [companyName.toLowerCase()] });
          this.companyCache.set(companyName.toLowerCase(), symbol);
          
          return symbol;
        }
      }
    } catch (error) {
      console.warn(`Failed to lookup symbol for ${companyName}:`, error.message);
    }
    
    return null;
  }

  // Validate if a symbol looks legitimate
  isValidSymbol(symbol) {
    return symbol.length >= 1 && symbol.length <= 5 && /^[A-Z]+$/.test(symbol);
  }

  // Get ticker info by symbol
  getTickerInfo(symbol) {
    return this.symbolCache.get(symbol) || null;
  }

  // Search tickers by alias
  searchTickers(alias) {
    const results = [];
    for (const [key, symbol] of this.companyCache) {
      if (key.includes(alias.toLowerCase())) {
        results.push({ symbol, info: this.symbolCache.get(symbol) });
      }
    }
    return results;
  }
}

// Singleton instance
const tickerExtractor = new TickerExtractor();

module.exports = tickerExtractor;
