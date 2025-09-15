import fetch from 'node-fetch';

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
      'AAPL': { name: 'Apple Inc.', aliases: ['apple', 'iphone', 'ipad', 'macbook', 'app store', 'apple inc', 'apple computer'] },
      'MSFT': { name: 'Microsoft Corporation', aliases: ['microsoft', 'windows', 'office', 'azure', 'xbox', 'microsoft corp', 'bing'] },
      'GOOGL': { name: 'Alphabet Inc.', aliases: ['google', 'youtube', 'android', 'chrome', 'search', 'alphabet', 'waymo'] },
      'AMZN': { name: 'Amazon.com Inc.', aliases: ['amazon', 'aws', 'prime', 'alexa', 'kindle', 'amazon.com', 'whole foods'] },
      'TSLA': { name: 'Tesla Inc.', aliases: ['tesla', 'model s', 'model 3', 'model x', 'model y', 'cybertruck', 'tesla motors', 'elon musk'] },
      'META': { name: 'Meta Platforms Inc.', aliases: ['facebook', 'meta', 'instagram', 'whatsapp', 'oculus', 'facebook inc', 'zuckerberg'] },
      'NVDA': { name: 'NVIDIA Corporation', aliases: ['nvidia', 'gpu', 'cuda', 'rtx', 'gtx', 'ai chips', 'nvidia corp', 'geforce'] },
      'NFLX': { name: 'Netflix Inc.', aliases: ['netflix', 'streaming', 'netflix originals', 'netflix inc'] },
      'AMD': { name: 'Advanced Micro Devices', aliases: ['amd', 'ryzen', 'radeon', 'epyc', 'advanced micro devices'] },
      'INTC': { name: 'Intel Corporation', aliases: ['intel', 'core i7', 'core i5', 'xeon', 'pentium', 'intel corp'] },
      'CRM': { name: 'Salesforce Inc.', aliases: ['salesforce', 'crm', 'sales cloud', 'service cloud', 'salesforce.com'] },
      'ORCL': { name: 'Oracle Corporation', aliases: ['oracle', 'database', 'java', 'cloud infrastructure', 'oracle corp'] },
      'ADBE': { name: 'Adobe Inc.', aliases: ['adobe', 'photoshop', 'illustrator', 'acrobat', 'creative cloud', 'adobe systems'] },
      'PYPL': { name: 'PayPal Holdings Inc.', aliases: ['paypal', 'venmo', 'digital payments', 'paypal holdings'] },
      'SQ': { name: 'Block Inc.', aliases: ['square', 'cash app', 'block', 'bitcoin', 'square inc', 'jack dorsey'] },
      'UBER': { name: 'Uber Technologies Inc.', aliases: ['uber', 'rideshare', 'uber eats', 'uber technologies'] },
      'LYFT': { name: 'Lyft Inc.', aliases: ['lyft', 'rideshare', 'scooters', 'lyft inc'] },
      'SPOT': { name: 'Spotify Technology S.A.', aliases: ['spotify', 'music streaming', 'podcasts', 'spotify technology'] },
      'TWTR': { name: 'Twitter Inc.', aliases: ['twitter', 'tweets', 'social media', 'twitter inc', 'x.com'] },
      'SNAP': { name: 'Snap Inc.', aliases: ['snapchat', 'snap', 'ar filters', 'spectacles', 'snap inc'] },
      'DIS': { name: 'Walt Disney Company', aliases: ['disney', 'walt disney', 'disney+', 'disney plus', 'marvel', 'star wars'] },
      'NKE': { name: 'Nike Inc.', aliases: ['nike', 'nike inc', 'jordan', 'air jordan', 'sneakers'] },
      'WMT': { name: 'Walmart Inc.', aliases: ['walmart', 'walmart inc', 'walmart stores', 'sam\'s club'] },
      'JPM': { name: 'JPMorgan Chase & Co.', aliases: ['jpmorgan', 'jp morgan', 'chase', 'jpmorgan chase', 'bank'] },
      'BAC': { name: 'Bank of America Corporation', aliases: ['bank of america', 'bofa', 'bank of america corp', 'merrill lynch'] },
      'GS': { name: 'Goldman Sachs Group Inc.', aliases: ['goldman sachs', 'goldman', 'investment bank', 'wall street'] },
      'JNJ': { name: 'Johnson & Johnson', aliases: ['johnson & johnson', 'j&j', 'pharmaceuticals', 'medical devices'] },
      'PFE': { name: 'Pfizer Inc.', aliases: ['pfizer', 'pfizer inc', 'pharmaceuticals', 'vaccine', 'covid vaccine'] },
      'UNH': { name: 'UnitedHealth Group Inc.', aliases: ['unitedhealth', 'united health', 'health insurance', 'optum'] },
      'HD': { name: 'Home Depot Inc.', aliases: ['home depot', 'home depot inc', 'hardware store', 'construction'] },
      'PG': { name: 'Procter & Gamble Company', aliases: ['procter & gamble', 'p&g', 'consumer goods', 'household products'] },
      'HOOD': { name: 'Robinhood Markets Inc.', aliases: ['robinhood', 'robinhood markets', 'robinhood inc', 'trading app', 'commission-free trading', 'robinhood app', 'robinhood platform'] },
      'PLTR': { name: 'Palantir Technologies Inc.', aliases: ['palantir', 'palantir technologies', 'data analytics', 'peter thiel'] },
      'GME': { name: 'GameStop Corp.', aliases: ['gamestop', 'gme', 'video games', 'retail gaming'] },
      'AMC': { name: 'AMC Entertainment Holdings Inc.', aliases: ['amc', 'amc entertainment', 'movie theater', 'cinema'] },
      'BB': { name: 'BlackBerry Limited', aliases: ['blackberry', 'bb', 'mobile security', 'enterprise software'] },
      'NOK': { name: 'Nokia Corporation', aliases: ['nokia', 'nok', 'telecommunications', '5g'] },
      'BBBY': { name: 'Bed Bath & Beyond Inc.', aliases: ['bed bath & beyond', 'bbby', 'home goods', 'retail'] }
    };

    for (const [symbol, data] of Object.entries(commonTickers)) {
      this.symbolCache.set(symbol, data);
      for (const alias of data.aliases) {
        this.companyCache.set(alias.toLowerCase(), symbol);
      }
    }
  }

  // Extract tickers from news text using dynamic API lookup
  async extractTickers(text, maxTickers = 6) {
    if (!text) return [];
    
    console.log('Extracting tickers from text:', text.substring(0, 100) + '...');
    const tickers = new Set();
    
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
          console.log('Found explicit ticker:', symbol);
        }
      }
    }
    
    // 2. Extract company names and lookup via API
    const companyNames = this.extractCompanyNames(text);
    console.log('Extracted company names:', companyNames);
    
    for (const companyName of companyNames) {
      if (tickers.size >= maxTickers) break;
        
      try {
        const symbol = await this.lookupCompanySymbol(companyName);
        if (symbol && !tickers.has(symbol)) {
          tickers.add(symbol);
          console.log(`Found ticker ${symbol} for company ${companyName}`);
        }
      } catch (error) {
        console.warn(`Failed to lookup ticker for ${companyName}:`, error);
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

export default tickerExtractor;
