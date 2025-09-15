// Unified Provider Manager - Single interface for all data types with failover
import { FMPProvider } from './providers/fmp.js';
import { FinnhubProvider } from './providers/finnhub.js';
import { AlphaVantageProvider } from './providers/alphavantage.js';

class UnifiedProviderManager {
  constructor() {
    this.providers = new Map();
    this.health = new Map();
    this.rateLimits = new Map();
    this.circuitBreakers = new Map();
    
    // Initialize providers in priority order
    this.initializeProviders();
    
    // Health check interval
    setInterval(() => this.performHealthCheck(), 30000); // Every 30 seconds
  }

  initializeProviders() {
    // Quotes/Charts/Scanner providers (in priority order)
    if (process.env.POLYGON_KEY) {
      this.providers.set('polygon', new FMPProvider(process.env.POLYGON_KEY)); // Using FMP as Polygon proxy
    }
    if (process.env.FMP_KEY) {
      this.providers.set('fmp', new FMPProvider(process.env.FMP_KEY));
    }
    if (process.env.ALPHAVANTAGE_KEY) {
      this.providers.set('alphavantage', new AlphaVantageProvider(process.env.ALPHAVANTAGE_KEY));
    }

    // News providers (in priority order)
    if (process.env.MARKETAUX_KEY) {
      this.providers.set('marketaux', new FMPProvider(process.env.MARKETAUX_KEY)); // Using FMP as Marketaux proxy
    }
    if (process.env.FINNHUB_KEY) {
      this.providers.set('finnhub', new FinnhubProvider(process.env.FINNHUB_KEY));
    }

    // Initialize health tracking
    for (const [name, provider] of this.providers) {
      this.health.set(name, {
        status: 'unknown',
        lastCheck: null,
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
        backoffUntil: null
      });
      this.rateLimits.set(name, {
        requests: 0,
        windowStart: Date.now(),
        limit: 60, // requests per minute
        remaining: 60
      });
      this.circuitBreakers.set(name, {
        state: 'closed', // closed, open, half-open
        failures: 0,
        lastFailure: null,
        nextRetry: null
      });
    }

    console.log(`UnifiedProviderManager initialized with ${this.providers.size} providers:`, Array.from(this.providers.keys()));
  }

  // Get active providers for a specific data type
  getActiveProviders(dataType) {
    const now = Date.now();
    const active = [];

    for (const [name, provider] of this.providers) {
      const health = this.health.get(name);
      const circuitBreaker = this.circuitBreakers.get(name);
      const rateLimit = this.rateLimits.get(name);

      // Check circuit breaker
      if (circuitBreaker.state === 'open') {
        if (now < circuitBreaker.nextRetry) {
          continue; // Still in backoff
        } else {
          circuitBreaker.state = 'half-open';
          circuitBreaker.failures = 0;
        }
      }

      // Check rate limiting
      if (rateLimit.remaining <= 0) {
        const timeSinceWindow = now - rateLimit.windowStart;
        if (timeSinceWindow < 60000) { // 1 minute window
          continue; // Still rate limited
        } else {
          // Reset rate limit window
          rateLimit.requests = 0;
          rateLimit.windowStart = now;
          rateLimit.remaining = rateLimit.limit;
        }
      }

      // Check backoff
      if (health.backoffUntil && now < health.backoffUntil) {
        continue;
      }

      active.push({ name, provider, health, rateLimit });
    }

    return active;
  }

  // Make request with automatic failover
  async makeRequest(dataType, method, params = {}) {
    const activeProviders = this.getActiveProviders(dataType);
    
    if (activeProviders.length === 0) {
      throw new Error(`No active providers available for ${dataType}`);
    }

    const errors = [];

    for (const { name, provider, health, rateLimit } of activeProviders) {
      try {
        // Check if provider supports the method
        if (typeof provider[method] !== 'function') {
          continue;
        }

        // Make the request
        const result = await provider[method](params);
        
        // Update health on success
        this.updateProviderHealth(name, true);
        this.updateRateLimit(name, true);
        
        console.log(`✅ ${name} succeeded for ${dataType}.${method}`);
        return result;

      } catch (error) {
        const statusCode = this.extractStatusCode(error);
        errors.push(`${name}: ${error.message}`);
        
        // Update health on failure
        this.updateProviderHealth(name, false, statusCode);
        this.updateRateLimit(name, false);
        
        // Handle specific error codes
        if (statusCode === 429) {
          this.handleRateLimit(name);
        } else if (statusCode >= 500) {
          this.handleServerError(name);
        }
        
        console.warn(`❌ ${name} failed for ${dataType}.${method}:`, error.message);
      }
    }

    throw new Error(`All providers failed for ${dataType}.${method}. Errors: ${errors.join(', ')}`);
  }

  // Update provider health
  updateProviderHealth(providerName, success, statusCode = 0) {
    const health = this.health.get(providerName);
    const now = Date.now();

    if (success) {
      health.status = 'healthy';
      health.lastSuccess = now;
      health.consecutiveFailures = 0;
      health.lastError = null;
    } else {
      health.status = 'unhealthy';
      health.lastError = { message: 'Request failed', statusCode, timestamp: now };
      health.consecutiveFailures++;
      
      // Set backoff based on error type
      if (statusCode === 429) {
        health.backoffUntil = now + 60000; // 1 minute
      } else if (statusCode >= 500) {
        health.backoffUntil = now + 300000; // 5 minutes
      } else {
        health.backoffUntil = now + 30000; // 30 seconds
      }
    }

    health.lastCheck = now;
    this.health.set(providerName, health);
  }

  // Update rate limiting
  updateRateLimit(providerName, success) {
    const rateLimit = this.rateLimits.get(providerName);
    const now = Date.now();

    if (success) {
      rateLimit.requests++;
      rateLimit.remaining = Math.max(0, rateLimit.limit - rateLimit.requests);
    }

    // Reset window if it's been more than a minute
    if (now - rateLimit.windowStart > 60000) {
      rateLimit.requests = 0;
      rateLimit.windowStart = now;
      rateLimit.remaining = rateLimit.limit;
    }
  }

  // Handle rate limiting
  handleRateLimit(providerName) {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    circuitBreaker.state = 'open';
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();
    circuitBreaker.nextRetry = Date.now() + 60000; // 1 minute backoff
    
    console.warn(`🚫 Circuit breaker opened for ${providerName} due to rate limiting`);
  }

  // Handle server errors
  handleServerError(providerName) {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();
    
    if (circuitBreaker.failures >= 5) {
      circuitBreaker.state = 'open';
      circuitBreaker.nextRetry = Date.now() + 300000; // 5 minute backoff
      console.warn(`🚫 Circuit breaker opened for ${providerName} due to server errors`);
    }
  }

  // Extract status code from error
  extractStatusCode(error) {
    if (error.message.includes('401')) return 401;
    if (error.message.includes('403')) return 403;
    if (error.message.includes('429')) return 429;
    if (error.message.includes('500')) return 500;
    if (error.message.includes('502')) return 502;
    if (error.message.includes('503')) return 503;
    return 0;
  }

  // Perform health check
  async performHealthCheck() {
    console.log('🔍 Performing health check on all providers...');
    
    for (const [name, provider] of this.providers) {
      try {
        // Simple health check - try to get a quote for a known symbol
        if (typeof provider.getQuotes === 'function') {
          await provider.getQuotes(['AAPL']);
          this.updateProviderHealth(name, true);
        }
      } catch (error) {
        this.updateProviderHealth(name, false, this.extractStatusCode(error));
      }
    }
  }

  // Get comprehensive health status
  getHealthStatus() {
    const status = {
      overall: 'healthy',
      providers: {},
      timestamp: new Date().toISOString()
    };

    let healthyCount = 0;
    let totalCount = this.providers.size;

    for (const [name, health] of this.health) {
      const circuitBreaker = this.circuitBreakers.get(name);
      const rateLimit = this.rateLimits.get(name);

      let providerStatus = 'unknown';
      if (health.status === 'healthy' && circuitBreaker.state === 'closed') {
        providerStatus = 'healthy';
        healthyCount++;
      } else if (circuitBreaker.state === 'open') {
        providerStatus = 'circuit_open';
      } else if (health.backoffUntil && Date.now() < health.backoffUntil) {
        providerStatus = 'backoff';
      } else {
        providerStatus = 'unhealthy';
      }

      status.providers[name] = {
        status: providerStatus,
        lastSuccess: health.lastSuccess,
        lastError: health.lastError,
        consecutiveFailures: health.consecutiveFailures,
        backoffUntil: health.backoffUntil,
        circuitState: circuitBreaker.state,
        nextRetry: circuitBreaker.nextRetry,
        rateLimitRemaining: rateLimit.remaining
      };
    }

    // Determine overall status
    if (healthyCount === 0) {
      status.overall = 'offline';
    } else if (healthyCount < totalCount) {
      status.overall = 'degraded';
    }

    return status;
  }

  // Data type specific methods
  async getNews(params = {}) {
    const result = await this.makeRequest('news', 'getNews', params);
    
    // Normalize the result to always return { news: [], errors: [] }
    if (Array.isArray(result)) {
      return { news: result, errors: [] };
    } else if (result && result.news) {
      return result;
    } else {
      return { news: [], errors: ['No news data available'] };
    }
  }

  async getQuotes(symbols) {
    const result = await this.makeRequest('quotes', 'getQuotes', { symbols });
    
    // Normalize the result to always return an array
    if (Array.isArray(result)) {
      return result;
    } else if (result && result.quotes) {
      return result.quotes;
    } else {
      return [];
    }
  }

  async getSymbols(params = {}) {
    return this.makeRequest('symbols', 'getSymbols', params);
  }

  async getOHLC(symbol, timeframe = '1m') {
    return this.makeRequest('ohlc', 'getOHLC', { symbol, timeframe });
  }
}

// Export singleton instance
export const unifiedProviderManager = new UnifiedProviderManager();
