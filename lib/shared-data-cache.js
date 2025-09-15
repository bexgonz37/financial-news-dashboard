// Shared Data Cache for Mini Charts and Scanner Metrics
import { providerManager } from './provider-manager.js';

class SharedDataCache {
  constructor() {
    this.quotesCache = new Map(); // symbol -> { data, timestamp }
    this.ohlcCache = new Map(); // symbol -> { data, timestamp }
    this.newsHeatCache = new Map(); // symbol -> { heat, timestamp }
    this.cacheTTL = 30000; // 30 seconds
    this.batchSize = 100; // Process symbols in batches
  }

  // Get fresh quotes for a batch of symbols
  async getQuotes(symbols) {
    const now = Date.now();
    const freshSymbols = [];
    const cachedQuotes = [];

    // Check cache first
    for (const symbol of symbols) {
      const cached = this.quotesCache.get(symbol);
      if (cached && (now - cached.timestamp) < this.cacheTTL) {
        cachedQuotes.push(cached.data);
      } else {
        freshSymbols.push(symbol);
      }
    }

    // Fetch fresh quotes in batches
    if (freshSymbols.length > 0) {
      console.log(`Fetching fresh quotes for ${freshSymbols.length} symbols`);
      
      for (let i = 0; i < freshSymbols.length; i += this.batchSize) {
        const batch = freshSymbols.slice(i, i + this.batchSize);
        
        try {
          const quotes = await providerManager.getQuotes(batch);
          
          // Cache the results
          for (const quote of quotes) {
            this.quotesCache.set(quote.symbol, {
              data: quote,
              timestamp: now
            });
            cachedQuotes.push(quote);
          }
          
          // Add delay between batches to respect rate limits
          if (i + this.batchSize < freshSymbols.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.warn(`Failed to fetch quotes for batch ${i}-${i + this.batchSize}:`, error.message);
        }
      }
    }

    return cachedQuotes;
  }

  // Get mini OHLC data for symbols (simplified for now)
  async getMiniOHLC(symbols, timeframe = '1m') {
    const now = Date.now();
    const freshSymbols = [];
    const cachedOHLC = [];

    // Check cache first
    for (const symbol of symbols) {
      const cached = this.ohlcCache.get(symbol);
      if (cached && (now - cached.timestamp) < this.cacheTTL) {
        cachedOHLC.push(cached.data);
      } else {
        freshSymbols.push(symbol);
      }
    }

    // For now, return simplified OHLC data based on quotes
    // In a full implementation, this would fetch actual minute bars
    if (freshSymbols.length > 0) {
      const quotes = await this.getQuotes(freshSymbols);
      
      for (const quote of quotes) {
        const ohlc = {
          symbol: quote.symbol,
          open: quote.price * 0.99, // Simplified
          high: quote.price * 1.01,
          low: quote.price * 0.98,
          close: quote.price,
          volume: quote.volume,
          timestamp: now
        };
        
        this.ohlcCache.set(quote.symbol, {
          data: ohlc,
          timestamp: now
        });
        cachedOHLC.push(ohlc);
      }
    }

    return cachedOHLC;
  }

  // Calculate news heat for symbols
  async getNewsHeat(symbols, newsData = []) {
    const now = Date.now();
    const newsHeat = new Map();

    // Count recent news mentions for each symbol
    const recentNews = newsData.filter(news => {
      const newsTime = new Date(news.publishedAt || news.date).getTime();
      return (now - newsTime) < 3600000; // Last hour
    });

    for (const symbol of symbols) {
      const mentions = recentNews.filter(news => 
        news.tickers && news.tickers.includes(symbol)
      ).length;

      const heat = {
        symbol,
        mentions,
        heatScore: Math.min(mentions * 10, 100), // Cap at 100
        lastUpdate: now
      };

      newsHeat.set(symbol, heat);
    }

    return Array.from(newsHeat.values());
  }

  // Get all data needed for scanner
  async getScannerData(symbols, newsData = []) {
    console.log(`Getting scanner data for ${symbols.length} symbols`);
    
    const [quotes, ohlcData, newsHeat] = await Promise.all([
      this.getQuotes(symbols),
      this.getMiniOHLC(symbols),
      this.getNewsHeat(symbols, newsData)
    ]);

    return {
      quotes,
      ohlcData,
      newsHeat,
      lastUpdate: new Date().toISOString()
    };
  }

  // Clear expired cache entries
  clearExpired() {
    const now = Date.now();
    
    for (const [symbol, data] of this.quotesCache) {
      if ((now - data.timestamp) > this.cacheTTL) {
        this.quotesCache.delete(symbol);
      }
    }
    
    for (const [symbol, data] of this.ohlcCache) {
      if ((now - data.timestamp) > this.cacheTTL) {
        this.ohlcCache.delete(symbol);
      }
    }
  }

  // Get cache stats
  getStats() {
    return {
      quotesCached: this.quotesCache.size,
      ohlcCached: this.ohlcCache.size,
      newsHeatCached: this.newsHeatCache.size,
      cacheTTL: this.cacheTTL
    };
  }
}

// Export singleton instance
export const sharedDataCache = new SharedDataCache();

// Clear expired entries every minute
setInterval(() => {
  sharedDataCache.clearExpired();
}, 60000);
