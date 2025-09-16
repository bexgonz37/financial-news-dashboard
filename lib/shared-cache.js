// Shared Cache System for News, Quotes, and Symbol Master
class SharedCache {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map();
    
    // Cache TTLs (in milliseconds)
    this.ttls = {
      news: 120000,      // 2 minutes
      quotes: 30000,     // 30 seconds
      ohlc: 60000,       // 1 minute
      symbols: 86400000, // 24 hours
      health: 10000      // 10 seconds
    };
  }

  // Set cache entry with TTL
  set(key, value, type = 'default') {
    const ttl = this.ttls[type] || 60000; // Default 1 minute
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + ttl);
  }

  // Get cache entry
  get(key) {
    const ttl = this.ttl.get(key);
    if (!ttl || Date.now() > ttl) {
      this.cache.delete(key);
      this.ttl.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  // Check if key exists and is valid
  has(key) {
    return this.get(key) !== null;
  }

  // Delete cache entry
  delete(key) {
    this.cache.delete(key);
    this.ttl.delete(key);
  }

  // Clear all cache
  clear() {
    this.cache.clear();
    this.ttl.clear();
  }

  // Get cache stats
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [key, ttl] of this.ttl) {
      if (now > ttl) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      memoryUsage: this.cache.size
    };
  }

  // News cache methods
  setNews(news) {
    this.set('news:latest', news, 'news');
  }

  getNews() {
    return this.get('news:latest') || [];
  }

  // Quotes cache methods
  setQuotes(symbol, quote) {
    this.set(`quotes:${symbol}`, quote, 'quotes');
  }

  getQuote(symbol) {
    return this.get(`quotes:${symbol}`);
  }

  setQuotesBatch(quotes) {
    for (const quote of quotes) {
      this.setQuotes(quote.symbol, quote);
    }
  }

  getQuotesBatch(symbols) {
    const quotes = [];
    for (const symbol of symbols) {
      const quote = this.getQuote(symbol);
      if (quote) quotes.push(quote);
    }
    return quotes;
  }

  // OHLC cache methods
  setOHLC(symbol, timeframe, data) {
    this.set(`ohlc:${symbol}:${timeframe}`, data, 'ohlc');
  }

  getOHLC(symbol, timeframe) {
    return this.get(`ohlc:${symbol}:${timeframe}`);
  }

  // Symbol master cache methods
  setSymbolMaster(symbols) {
    this.set('symbols:master', symbols, 'symbols');
  }

  getSymbolMaster() {
    return this.get('symbols:master') || [];
  }

  // Health cache methods
  setHealth(health) {
    this.set('health:status', health, 'health');
  }

  getHealth() {
    return this.get('health:status');
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, ttl] of this.ttl) {
      if (now > ttl) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.delete(key);
    }
    
    return expiredKeys.length;
  }
}

// Export singleton
export const sharedCache = new SharedCache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const cleaned = sharedCache.cleanup();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired cache entries`);
  }
}, 300000);
