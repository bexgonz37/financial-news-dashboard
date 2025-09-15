// ProviderManager - Centralized provider access with live data only
import { FMPProvider } from './providers/fmp.js';
import { FinnhubProvider } from './providers/finnhub.js';
import { AlphaVantageProvider } from './providers/alphavantage.js';

class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.inactiveProviders = new Map(); // provider -> retry time
    this.providerStats = new Map(); // provider -> { success: 0, errors: 0, lastError: null }
    
    // Initialize real providers only
    if (process.env.FMP_KEY) {
      this.providers.set('fmp', new FMPProvider(process.env.FMP_KEY));
    }
    
    if (process.env.FINNHUB_KEY) {
      this.providers.set('finnhub', new FinnhubProvider(process.env.FINNHUB_KEY));
    }
    
    if (process.env.ALPHAVANTAGE_KEY) {
      this.providers.set('alphavantage', new AlphaVantageProvider(process.env.ALPHAVANTAGE_KEY));
    }
    
    console.log(`ProviderManager initialized with ${this.providers.size} live providers:`, Array.from(this.providers.keys()));
  }

  // Get active providers (not in backoff or inactive)
  getActiveProviders() {
    const now = Date.now();
    const active = [];
    
    for (const [name, provider] of this.providers) {
      // Check if provider is inactive
      if (this.inactiveProviders.has(name)) {
        const retryTime = this.inactiveProviders.get(name);
        if (now < retryTime) {
          console.log(`Provider ${name} is inactive until ${new Date(retryTime).toISOString()}`);
          continue;
        } else {
          // Retry time passed, reactivate
          this.inactiveProviders.delete(name);
          console.log(`Provider ${name} reactivated`);
        }
      }
      
      active.push({ name, provider });
    }
    
    return active;
  }

  // Handle provider response (success or failure)
  handleProviderResponse(providerName, success, statusCode = 0, error = null) {
    const stats = this.providerStats.get(providerName) || { success: 0, errors: 0, lastError: null };
    
    if (success) {
      stats.success++;
      stats.lastError = null;
    } else {
      stats.errors++;
      stats.lastError = error?.message || 'Unknown error';
      
      // Handle specific error codes
      if (statusCode === 401 || statusCode === 403) {
        // Authentication error - disable for 1 hour
        this.inactiveProviders.set(providerName, Date.now() + 60 * 60 * 1000);
        console.warn(`Provider ${providerName} disabled due to auth error (${statusCode})`);
      } else if (statusCode === 429) {
        // Rate limit - backoff for 5 minutes
        this.inactiveProviders.set(providerName, Date.now() + 5 * 60 * 1000);
        console.warn(`Provider ${providerName} rate limited, backing off for 5 minutes`);
      } else if (error) {
        console.warn(`Provider ${providerName} error:`, error.message);
      }
    }
    
    this.providerStats.set(providerName, stats);
  }

  // Get quotes with live data only
  async getQuotes(symbols) {
    const activeProviders = this.getActiveProviders();
    const errors = [];
    let quotes = [];
    
    // Try real providers only
    for (const { name, provider } of activeProviders) {
      try {
        const result = await provider.getQuotes(symbols);
        if (result && result.length > 0) {
          quotes = result;
          this.handleProviderResponse(name, true);
          console.log(`Provider ${name} returned ${result.length} quotes`);
          break; // Use first successful provider
        }
      } catch (error) {
        const statusCode = error.message.includes('401') ? 401 : 
                          error.message.includes('403') ? 403 :
                          error.message.includes('429') ? 429 : 0;
        
        this.handleProviderResponse(name, false, statusCode, error);
        errors.push(`${name}: ${error.message}`);
        console.warn(`Provider ${name} failed:`, error.message);
      }
    }
    
    // NO FALLBACK DATA - Return empty quotes if no real providers work
    if (quotes.length === 0) {
      console.log('No live providers available, returning empty quotes array');
      errors.push('No live data available from any provider');
    }
    
    return { quotes, errors };
  }

  // Get OHLC with live data only
  async getOHLC(symbol, interval, limit) {
    const activeProviders = this.getActiveProviders();
    if (activeProviders.length === 0) {
      return { candles: [], errors: ['No providers available'] };
    }
    
    const errors = [];
    let candles = [];
    
    // Try providers in order
    for (const { name, provider } of activeProviders) {
      try {
        const result = await provider.getOHLC(symbol, interval, limit);
        if (result && result.length > 0) {
          candles = result;
          this.handleProviderResponse(name, true);
          console.log(`Provider ${name} returned ${result.length} OHLC candles`);
          break;
        }
      } catch (error) {
        const statusCode = error.message.includes('401') ? 401 : 
                          error.message.includes('403') ? 403 :
                          error.message.includes('429') ? 429 : 0;
        
        this.handleProviderResponse(name, false, statusCode, error);
        errors.push(`${name}: ${error.message}`);
        console.warn(`Provider ${name} failed:`, error.message);
      }
    }
    
    return { candles, errors };
  }

  // Get news with live data only
  async getNews(params) {
    const newsProviders = [];
    
    // Try real providers only
    if (this.providers.has('finnhub')) {
      newsProviders.push({ name: 'finnhub', provider: this.providers.get('finnhub') });
    }
    if (this.providers.has('fmp')) {
      newsProviders.push({ name: 'fmp', provider: this.providers.get('fmp') });
    }
    
    const errors = [];
    const allNews = [];
    
    // Try all news providers in parallel
    const promises = newsProviders.map(async ({ name, provider }) => {
      try {
        const result = await provider.getNews(params);
        if (result && result.length > 0) {
          this.handleProviderResponse(name, true);
          console.log(`Provider ${name} returned ${result.length} news items`);
          return { name, news: result, error: null };
        }
        return { name, news: [], error: null };
      } catch (error) {
        const statusCode = error.message.includes('401') ? 401 : 
                          error.message.includes('403') ? 403 :
                          error.message.includes('429') ? 429 : 0;
        
        this.handleProviderResponse(name, false, statusCode, error);
        const errorMsg = `${name}: ${error.message}`;
        errors.push(errorMsg);
        console.warn(`Provider ${name} failed:`, error.message);
        return { name, news: [], error: errorMsg };
      }
    });
    
    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { name, news, error } = result.value;
        if (news.length > 0) {
          allNews.push(...news);
        }
      } else {
        errors.push(`Provider error: ${result.reason.message}`);
      }
    }
    
    // NO FALLBACK DATA - Return empty news if no real providers work
    if (allNews.length === 0) {
      console.log('No live news providers available, returning empty news array');
      errors.push('No live news available from any provider');
    }
    
    return { news: allNews, errors };
  }

  // Get provider status for health check
  getStatus() {
    const now = Date.now();
    const status = {};
    
    for (const [name, provider] of this.providers) {
      const stats = this.providerStats.get(name) || { success: 0, errors: 0, lastError: null };
      const isInactive = this.inactiveProviders.has(name);
      const retryTime = this.inactiveProviders.get(name);
      
      status[name] = {
        active: !isInactive,
        success: stats.success,
        errors: stats.errors,
        lastError: stats.lastError,
        retryTime: retryTime ? new Date(retryTime).toISOString() : null
      };
    }
    
    return status;
  }
}

// Export singleton instance
export const providerManager = new ProviderManager();