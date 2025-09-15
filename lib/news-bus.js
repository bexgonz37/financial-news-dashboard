// News Bus - batches news requests and caches results
import { FMPProvider } from './providers/fmp.js';
import { FinnhubProvider } from './providers/finnhub.js';
import { AlphaVantageProvider } from './providers/alphavantage.js';

class NewsBus {
  constructor() {
    this.providers = [];
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.batchWindow = 200; // ms
    this.cacheTTL = 60000; // 60 seconds
    
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
    
    console.log(`News Bus initialized with ${this.providers.length} providers`);
  }

  // Get news with batching and caching
  async getNews(params = {}) {
    const { limit = 100, ticker = null, search = null, dateRange = 'all' } = params;
    const cacheKey = this.getCacheKey(params);
    const now = Date.now();
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.cacheTTL) {
      return {
        news: cached.data,
        providerErrors: cached.providerErrors || []
      };
    }
    
    // Check if there's already a pending request
    if (this.pendingRequests.has(cacheKey)) {
      return await this.pendingRequests.get(cacheKey);
    }
    
    // Create new batch request
    const batchPromise = this.batchGetNews(params);
    this.pendingRequests.set(cacheKey, batchPromise);
    
    try {
      const result = await batchPromise;
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: result.news,
        providerErrors: result.providerErrors,
        timestamp: now
      });
      
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  // Generate cache key for parameters
  getCacheKey(params) {
    const { limit, ticker, search, dateRange } = params;
    return `${limit}-${ticker || 'all'}-${search || 'all'}-${dateRange}`;
  }

  // Batch get news from providers
  async batchGetNews(params) {
    const allNews = [];
    const providerErrors = [];
    
    // Try providers in parallel
    const providerPromises = this.providers.map(async (provider) => {
      try {
        const news = await provider.getNews(params);
        return { provider: provider.name, news, error: null };
      } catch (error) {
        console.warn(`${provider.name} batch getNews failed:`, error.message);
        return { provider: provider.name, news: [], error: error.message };
      }
    });
    
    const results = await Promise.allSettled(providerPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { provider, news, error } = result.value;
        if (error) {
          providerErrors.push(`${provider}: ${error}`);
        } else {
          allNews.push(...news);
        }
      } else {
        providerErrors.push(`Provider error: ${result.reason.message}`);
      }
    }
    
    // Deduplicate and merge news
    const mergedNews = this.mergeAndDeduplicateNews(allNews);
    
    // Apply date filter
    const filteredNews = this.applyDateFilter(mergedNews, params.dateRange);
    
    // Sort by publishedAt (newest first)
    filteredNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    
    return {
      news: filteredNews.slice(0, params.limit || 100),
      providerErrors
    };
  }

  // Merge and deduplicate news from multiple providers
  mergeAndDeduplicateNews(allNews) {
    const seen = new Map();
    const merged = [];
    
    for (const item of allNews) {
      // Create a unique key for deduplication
      const canonicalUrl = this.getCanonicalUrl(item.url);
      const title = item.title?.toLowerCase().trim() || '';
      const publishedAt = new Date(item.publishedAt).getTime();
      
      // Use canonical URL if available, otherwise use title + publishedAt
      const key = canonicalUrl || `${title}-${publishedAt}`;
      
      if (!seen.has(key)) {
        seen.set(key, true);
        merged.push({
          ...item,
          canonicalUrl,
          publishedAt: new Date(item.publishedAt).toISOString()
        });
      }
    }
    
    return merged;
  }

  // Get canonical URL for deduplication
  getCanonicalUrl(url) {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      // Remove common tracking parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
      
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  // Apply date filter
  applyDateFilter(news, dateRange) {
    if (dateRange === 'all') return news;
    
    const now = new Date();
    let cutoffDate;
    
    switch (dateRange) {
      case 'today':
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '14d':
        cutoffDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return news;
    }
    
    return news.filter(item => {
      const itemDate = new Date(item.publishedAt);
      return itemDate >= cutoffDate;
    });
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
    
    for (const [key, cached] of this.cache) {
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
export const newsBus = new NewsBus();
