// Quote Bus - batches quote requests and caches results
import { FMPProvider } from './providers/fmp.js';
import { FinnhubProvider } from './providers/finnhub.js';
import { AlphaVantageProvider } from './providers/alphavantage.js';

class QuoteBus {
  constructor() {
    this.providers = [];
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.batchWindow = 100; // ms
    this.cacheTTL = 15000; // 15 seconds
    
    // Initialize providers
    if (process.env.FMP_KEY) {
      this.providers.push(new FMPProvider(process.env.FMP_KEY));
    }
    if (process.env.FINNHUB_KEY) {
      this.providers.push(new FinnhubProvider(process.env.FINNHUB_KEY));
    }
    if (process.env.ALPHAVANTAGE_KEY) {
      this.providers.push(new AlphaVantageProvider(process.env.ALPHAVANTAGE_KEY));
    }
    
    console.log(`Quote Bus initialized with ${this.providers.length} providers`);
  }

  // Get quotes for symbols with batching and caching
  async getQuotes(symbols) {
    const now = Date.now();
    const results = new Map();
    const uncachedSymbols = [];
    
    // Check cache first
    for (const symbol of symbols) {
      const cached = this.cache.get(symbol);
      if (cached && (now - cached.timestamp) < this.cacheTTL) {
        results.set(symbol, cached.data);
      } else {
        uncachedSymbols.push(symbol);
      }
    }
    
    // If all symbols are cached, return immediately
    if (uncachedSymbols.length === 0) {
      return Array.from(results.values());
    }
    
    // Check if there's already a pending request for these symbols
    const requestKey = uncachedSymbols.sort().join(',');
    if (this.pendingRequests.has(requestKey)) {
      const pendingResult = await this.pendingRequests.get(requestKey);
      return Array.from(results.values()).concat(pendingResult);
    }
    
    // Create new batch request
    const batchPromise = this.batchGetQuotes(uncachedSymbols);
    this.pendingRequests.set(requestKey, batchPromise);
    
    try {
      const batchResults = await batchPromise;
      
      // Cache the results
      for (const quote of batchResults) {
        this.cache.set(quote.symbol, {
          data: quote,
          timestamp: now
        });
      }
      
      // Add to results
      for (const quote of batchResults) {
        results.set(quote.symbol, quote);
      }
      
      return Array.from(results.values());
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  // Batch get quotes from providers
  async batchGetQuotes(symbols) {
    const allQuotes = [];
    const providerErrors = [];
    
    // Try providers in parallel
    const providerPromises = this.providers.map(async (provider) => {
      try {
        const quotes = await provider.getQuotes(symbols);
        return { provider: provider.name, quotes, error: null };
      } catch (error) {
        console.warn(`${provider.name} batch getQuotes failed:`, error.message);
        return { provider: provider.name, quotes: [], error: error.message };
      }
    });
    
    const results = await Promise.allSettled(providerPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { provider, quotes, error } = result.value;
        if (error) {
          providerErrors.push(`${provider}: ${error}`);
        } else {
          allQuotes.push(...quotes);
        }
      } else {
        providerErrors.push(`Provider error: ${result.reason.message}`);
      }
    }
    
    // Deduplicate by symbol (keep first occurrence)
    const uniqueQuotes = new Map();
    for (const quote of allQuotes) {
      if (!uniqueQuotes.has(quote.symbol)) {
        uniqueQuotes.set(quote.symbol, quote);
      }
    }
    
    const finalQuotes = Array.from(uniqueQuotes.values());
    
    if (providerErrors.length > 0) {
      console.warn(`Quote Bus provider errors:`, providerErrors);
    }
    
    return finalQuotes;
  }

  // Get single quote
  async getQuote(symbol) {
    const quotes = await this.getQuotes([symbol]);
    return quotes[0] || null;
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [symbol, cached] of this.cache) {
      if ((now - cached.timestamp) < this.cacheTTL) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }
    
    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries,
      providers: this.providers.length
    };
  }
}

// Singleton instance
export const quoteBus = new QuoteBus();
