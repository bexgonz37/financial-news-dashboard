// Global FMP rate limiter - singleton token bucket
class FMPLimiter {
  constructor() {
    this.tokens = 1; // Start with 1 token
    this.maxTokens = 2; // Burst capacity
    this.refillRate = 1; // 1 token per second
    this.lastRefill = Date.now();
    this.queue = [];
    this.isProcessing = false;
  }

  async acquire() {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.processQueue();
    });
  }

  processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    this.refillTokens();
    
    if (this.tokens > 0 && this.queue.length > 0) {
      this.tokens--;
      const { resolve } = this.queue.shift();
      resolve();
    }
    
    this.isProcessing = false;
    
    // Schedule next check
    if (this.queue.length > 0) {
      const delay = Math.max(0, 1000 - (Date.now() - this.lastRefill));
      setTimeout(() => this.processQueue(), delay);
    }
  }

  refillTokens() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async makeRequest(url, options = {}) {
    await this.acquire();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Financial-News-Dashboard/1.0',
          ...options.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        console.log('FMP rate limit hit, backing off...');
        // Back off for 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        throw new Error('FMP rate limit exceeded');
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// Singleton instance
const fmpLimiter = new FMPLimiter();

export default fmpLimiter;
