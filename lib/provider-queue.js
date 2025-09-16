// Provider Queue with Token Bucket + Exponential Backoff
class ProviderQueue {
  constructor() {
    this.providers = new Map();
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessing = false;
    
    // Initialize providers
    this.initializeProviders();
  }

  initializeProviders() {
    const providerConfigs = [
      { name: 'fmp', key: 'FMP_KEY', rateLimit: 250, burst: 10 },
      { name: 'finnhub', key: 'FINNHUB_KEY', rateLimit: 60, burst: 5 },
      { name: 'alphavantage', key: 'ALPHAVANTAGE_KEY', rateLimit: 5, burst: 1 },
      { name: 'marketaux', key: 'MARKETAUX_KEY', rateLimit: 100, burst: 5 }
    ];

    for (const config of providerConfigs) {
      const hasKey = !!process.env[config.key];
      this.providers.set(config.name, {
        name: config.name,
        key: config.key,
        hasKey,
        enabled: hasKey,
        rateLimit: config.rateLimit, // requests per minute
        burst: config.burst, // burst allowance
        tokens: config.burst,
        lastRefill: Date.now(),
        backoffUntil: null,
        consecutiveFailures: 0,
        lastSuccess: null,
        lastError: null,
        requestCount: 0
      });
    }
  }

  // Token bucket refill
  refillTokens(provider) {
    const now = Date.now();
    const timePassed = now - provider.lastRefill;
    const tokensToAdd = (timePassed / 60000) * provider.rateLimit; // per minute
    
    provider.tokens = Math.min(provider.burst, provider.tokens + tokensToAdd);
    provider.lastRefill = now;
  }

  // Check if provider can make request
  canMakeRequest(providerName) {
    const provider = this.providers.get(providerName);
    if (!provider || !provider.enabled) return false;
    
    // Check backoff
    if (provider.backoffUntil && Date.now() < provider.backoffUntil) {
      return false;
    }
    
    // Refill tokens
    this.refillTokens(provider);
    
    return provider.tokens >= 1;
  }

  // Consume token
  consumeToken(providerName) {
    const provider = this.providers.get(providerName);
    if (provider && provider.tokens >= 1) {
      provider.tokens -= 1;
      provider.requestCount++;
      return true;
    }
    return false;
  }

  // Handle provider response
  handleResponse(providerName, success, error = null) {
    const provider = this.providers.get(providerName);
    if (!provider) return;

    if (success) {
      provider.consecutiveFailures = 0;
      provider.lastSuccess = Date.now();
      provider.lastError = null;
      provider.backoffUntil = null;
    } else {
      provider.consecutiveFailures++;
      provider.lastError = {
        message: error?.message || 'Unknown error',
        timestamp: Date.now(),
        statusCode: this.extractStatusCode(error)
      };

      // Exponential backoff
      const backoffTime = Math.min(300000, 1000 * Math.pow(2, provider.consecutiveFailures)); // Max 5 minutes
      provider.backoffUntil = Date.now() + backoffTime;
      
      console.warn(`Provider ${providerName} backoff until ${new Date(provider.backoffUntil).toISOString()}`);
    }
  }

  extractStatusCode(error) {
    if (!error) return 0;
    if (error.message.includes('429')) return 429;
    if (error.message.includes('403')) return 403;
    if (error.message.includes('401')) return 401;
    if (error.message.includes('500')) return 500;
    return 0;
  }

  // Get available providers for data type
  getAvailableProviders(dataType) {
    const available = [];
    
    for (const [name, provider] of this.providers) {
      if (!provider.enabled) continue;
      
      // Check if provider supports this data type
      if (dataType === 'news' && (name === 'fmp' || name === 'finnhub' || name === 'marketaux')) {
        if (this.canMakeRequest(name)) {
          available.push(provider);
        }
      } else if (dataType === 'quotes' && (name === 'fmp' || name === 'finnhub' || name === 'alphavantage')) {
        if (this.canMakeRequest(name)) {
          available.push(provider);
        }
      }
    }
    
    return available;
  }

  // Get provider status for diagnostics
  getProviderStatus() {
    const status = {};
    
    for (const [name, provider] of this.providers) {
      status[name] = {
        enabled: provider.enabled,
        keyPresent: provider.hasKey,
        rateLimitBackoffUntil: provider.backoffUntil ? new Date(provider.backoffUntil).toISOString() : null,
        lastAttemptAt: provider.lastSuccess ? new Date(provider.lastSuccess).toISOString() : null,
        lastSuccessAt: provider.lastSuccess ? new Date(provider.lastSuccess).toISOString() : null,
        lastError: provider.lastError,
        consecutiveFailures: provider.consecutiveFailures,
        tokens: Math.floor(provider.tokens),
        requestCount: provider.requestCount
      };
    }
    
    return status;
  }

  // Make request with automatic failover
  async makeRequest(dataType, method, params = {}) {
    const availableProviders = this.getAvailableProviders(dataType);
    
    if (availableProviders.length === 0) {
      throw new Error(`No available providers for ${dataType}`);
    }

    const errors = [];

    for (const provider of availableProviders) {
      try {
        if (!this.consumeToken(provider.name)) {
          continue; // No tokens available
        }

        // Make the actual request (this would call the provider's method)
        const result = await this.executeProviderRequest(provider.name, method, params);
        
        this.handleResponse(provider.name, true);
        return result;

      } catch (error) {
        this.handleResponse(provider.name, false, error);
        errors.push(`${provider.name}: ${error.message}`);
        console.warn(`Provider ${provider.name} failed:`, error.message);
      }
    }

    throw new Error(`All providers failed for ${dataType}. Errors: ${errors.join(', ')}`);
  }

  // Execute provider request (placeholder - would integrate with actual providers)
  async executeProviderRequest(providerName, method, params) {
    // This would be implemented to call the actual provider methods
    throw new Error(`Provider request not implemented: ${providerName}.${method}`);
  }
}

// Export singleton
export const providerQueue = new ProviderQueue();
