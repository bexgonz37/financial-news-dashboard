// ProviderManager - Centralized provider access with graceful fallbacks
import { FMPProvider } from './providers/fmp.js';
import { FinnhubProvider } from './providers/finnhub.js';
import { AlphaVantageProvider } from './providers/alphavantage.js';

class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.inactiveProviders = new Map(); // provider -> retry time
    this.backoffCache = new Map(); // provider -> backoff time
    this.retryDelay = 10 * 60 * 1000; // 10 minutes
    this.maxBackoff = 2000; // 2 seconds max backoff
    
    this.initializeProviders();
  }

  initializeProviders() {
    // Initialize available providers based on env vars
    if (process.env.FINNHUB_KEY) {
      this.providers.set('finnhub', new FinnhubProvider(process.env.FINNHUB_KEY));
    }
    
    if (process.env.FMP_API_KEY) {
      this.providers.set('fmp', new FMPProvider(process.env.FMP_API_KEY));
    }
    
    if (process.env.ALPHA_VANTAGE_KEY) {
      this.providers.set('alphavantage', new AlphaVantageProvider(process.env.ALPHA_VANTAGE_KEY));
    }
    
    console.log(`ProviderManager initialized with ${this.providers.size} providers:`, Array.from(this.providers.keys()));
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
      
      // Check if provider is in backoff
      if (this.backoffCache.has(name)) {
        const backoffTime = this.backoffCache.get(name);
        if (now < backoffTime) {
          console.log(`Provider ${name} is in backoff until ${new Date(backoffTime).toISOString()}`);
          continue;
        } else {
          // Backoff time passed, clear it
          this.backoffCache.delete(name);
        }
      }
      
      active.push({ name, provider });
    }
    
    return active;
  }

  // Mark provider as inactive
  markInactive(providerName, reason) {
    const retryTime = Date.now() + this.retryDelay;
    this.inactiveProviders.set(providerName, retryTime);
    console.warn(`Provider ${providerName} marked inactive until ${new Date(retryTime).toISOString()}: ${reason}`);
  }

  // Apply backoff to provider
  applyBackoff(providerName, attempt = 1) {
    const backoffTime = Math.min(250 * Math.pow(2, attempt - 1), this.maxBackoff);
    const retryTime = Date.now() + backoffTime;
    this.backoffCache.set(providerName, retryTime);
    console.warn(`Provider ${providerName} in backoff for ${backoffTime}ms (attempt ${attempt})`);
  }

  // Handle provider response and update status
  handleProviderResponse(providerName, success, statusCode, error) {
    if (success) {
      // Clear any backoff on success
      this.backoffCache.delete(providerName);
      return;
    }
    
    if (statusCode === 401 || statusCode === 403) {
      this.markInactive(providerName, `HTTP ${statusCode}`);
    } else if (statusCode === 429) {
      this.applyBackoff(providerName);
    } else if (error) {
      console.warn(`Provider ${providerName} error:`, error.message);
    }
  }

  // Get quotes with fallback
  async getQuotes(symbols) {
    const activeProviders = this.getActiveProviders();
    if (activeProviders.length === 0) {
      return { quotes: [], errors: ['No active providers available'] };
    }

    const errors = [];
    let quotes = [];
    
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
    
    return { quotes, errors };
  }

  // Get OHLC with fallback
  async getOHLC(symbol, interval, limit) {
    const activeProviders = this.getActiveProviders();
    if (activeProviders.length === 0) {
      return { candles: [], errors: ['No active providers available'] };
    }

    const errors = [];
    let candles = [];
    
    for (const { name, provider } of activeProviders) {
      try {
        const result = await provider.getOHLC(symbol, interval, limit);
        if (result && result.length > 0) {
          candles = result;
          this.handleProviderResponse(name, true);
          console.log(`Provider ${name} returned ${result.length} candles`);
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
    
    return { candles, errors };
  }

  // Get news with fallback (Finnhub + FMP only, no Alpha Vantage)
  async getNews(params) {
    const newsProviders = [];
    
    // Only use Finnhub and FMP for news
    if (this.providers.has('finnhub')) {
      newsProviders.push({ name: 'finnhub', provider: this.providers.get('finnhub') });
    }
    if (this.providers.has('fmp')) {
      newsProviders.push({ name: 'fmp', provider: this.providers.get('fmp') });
    }
    
    if (newsProviders.length === 0) {
      return { news: [], errors: ['No news providers available'] };
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
    
    return { news: allNews, errors };
  }

  // Get provider status for health check
  getStatus() {
    const now = Date.now();
    const status = {};
    
    for (const [name, provider] of this.providers) {
      const isInactive = this.inactiveProviders.has(name);
      const isInBackoff = this.backoffCache.has(name);
      
      let state = 'active';
      let retryTime = null;
      
      if (isInactive) {
        state = 'inactive';
        retryTime = this.inactiveProviders.get(name);
      } else if (isInBackoff) {
        state = 'backoff';
        retryTime = this.backoffCache.get(name);
      }
      
      status[name] = {
        state,
        retryTime: retryTime ? new Date(retryTime).toISOString() : null,
        canRetry: retryTime ? now >= retryTime : true
      };
    }
    
    return status;
  }
}

// Singleton instance
export const providerManager = new ProviderManager();
