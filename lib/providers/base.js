// Base provider class with rate limiting and backoff
import fetch from 'node-fetch';

export class BaseProvider {
  constructor(name, apiKey, rpm = 60) {
    this.name = name;
    this.apiKey = apiKey;
    this.rpm = rpm; // requests per minute
    this.maxRetries = 3;
    this.baseDelay = 300; // base delay in ms
    this.maxDelay = 5000; // max delay in ms
    
    // Token bucket for rate limiting
    this.tokens = this.rpm;
    this.lastRefill = Date.now();
    
    // Backoff state
    this.consecutiveFailures = 0;
    this.nextRetryTime = 0;
  }

  // Refill token bucket every second
  refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(timePassed / 60000) * (this.rpm / 60); // tokens per second
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.rpm, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  // Check if we can make a request
  canMakeRequest() {
    this.refillTokens();
    return this.tokens >= 1 && Date.now() >= this.nextRetryTime;
  }

  // Consume a token
  consumeToken() {
    this.tokens = Math.max(0, this.tokens - 1);
  }

  // Calculate backoff delay with jitter
  getBackoffDelay() {
    const jitter = Math.random() * 0.1; // 10% jitter
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.consecutiveFailures) * (1 + jitter),
      this.maxDelay
    );
    return Math.floor(delay);
  }

  // Handle response and update backoff state
  handleResponse(success, statusCode) {
    if (success) {
      this.consecutiveFailures = 0;
      this.nextRetryTime = 0;
    } else {
      this.consecutiveFailures++;
      if (statusCode === 429 || statusCode >= 500) {
        this.nextRetryTime = Date.now() + this.getBackoffDelay();
      }
    }
  }

  // Make a request with rate limiting and backoff
  async makeRequest(url, options = {}) {
    if (!this.canMakeRequest()) {
      throw new Error(`${this.name} rate limited or in backoff`);
    }

    this.consumeToken();
    
    try {
      const response = await fetch(url, {
        ...options,
        cache: 'no-store',
        timeout: 10000
      });

      const isSuccess = response.ok;
      this.handleResponse(isSuccess, response.status);

      if (!isSuccess) {
        if (response.status === 429) {
          throw new Error(`${this.name} rate limited (429)`);
        }
        if (response.status >= 500) {
          throw new Error(`${this.name} server error (${response.status})`);
        }
        throw new Error(`${this.name} error (${response.status})`);
      }

      return response;
    } catch (error) {
      this.handleResponse(false, 0);
      throw error;
    }
  }

  // Make a request with rate limiting and backoff
  async makeRequest(url, options = {}) {
    if (!this.canMakeRequest()) {
      throw new Error(`${this.name} rate limited or in backoff`);
    }
    
    this.consumeToken();
    
    try {
      const response = await fetch(url, {
        ...options,
        timeout: 10000,
        cache: 'no-store'
      });
      
      if (response.ok) {
        this.consecutiveFailures = 0;
        return response;
      } else if (response.status === 401 || response.status === 403) {
        this.consecutiveFailures = this.maxRetries; // Mark as failed
        throw new Error(`${this.name} authentication failed: ${response.status}`);
      } else if (response.status === 429) {
        this.consecutiveFailures++;
        this.nextRetryTime = Date.now() + this.getBackoffDelay();
        throw new Error(`${this.name} rate limited: ${response.status}`);
      } else {
        this.consecutiveFailures++;
        throw new Error(`${this.name} request failed: ${response.status}`);
      }
    } catch (error) {
      this.consecutiveFailures++;
      this.nextRetryTime = Date.now() + this.getBackoffDelay();
      throw error;
    }
  }

  // Abstract methods to be implemented by subclasses
  async getQuotes(symbols) {
    throw new Error('getQuotes not implemented');
  }

  async getNews(params) {
    throw new Error('getNews not implemented');
  }

  async getOHLC(symbol, interval, limit) {
    throw new Error('getOHLC not implemented');
  }
}
