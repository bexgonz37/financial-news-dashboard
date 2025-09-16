// News aggregation and deduplication
import { appState } from '../../state/store.js';

class NewsAggregator {
  constructor() {
    this.sources = [
      { name: 'fmp', priority: 1 },
      { name: 'finnhub', priority: 2 },
      { name: 'marketaux', priority: 3 }
    ];
    this.dedupeWindow = 5 * 60 * 1000; // 5 minutes
    this.maxAge = 14 * 24 * 60 * 60 * 1000; // 14 days
  }

  // Fetch news from all sources
  async fetchNews(limit = 200) {
    const allNews = [];
    const errors = [];

    for (const source of this.sources) {
      try {
        const news = await this.fetchFromSource(source.name, limit);
        allNews.push(...news);
      } catch (error) {
        console.error(`News fetch failed for ${source.name}:`, error);
        errors.push(`${source.name}: ${error.message}`);
      }
    }

    // Deduplicate and normalize
    const deduplicated = this.deduplicateNews(allNews);
    const normalized = this.normalizeNews(deduplicated);

    // Update app state
    appState.updateNews(normalized);

    return {
      news: normalized,
      errors,
      count: normalized.length
    };
  }

  // Fetch from specific source
  async fetchFromSource(source, limit) {
    const response = await fetch(`/api/news/${source}?limit=${limit}`, {
      cache: 'no-store',
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.news || data.data || [];
  }

  // Deduplicate news items
  deduplicateNews(newsItems) {
    const seen = new Map();
    const deduplicated = [];

    for (const item of newsItems) {
      const key = this.generateDedupeKey(item);
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, item);
        deduplicated.push(item);
      } else {
        // Keep the one with higher priority (lower number)
        const existingSource = this.getSourcePriority(existing.source);
        const currentSource = this.getSourcePriority(item.source);
        
        if (currentSource < existingSource) {
          const index = deduplicated.indexOf(existing);
          if (index !== -1) {
            deduplicated[index] = item;
            seen.set(key, item);
          }
        }
      }
    }

    return deduplicated;
  }

  // Generate deduplication key
  generateDedupeKey(item) {
    const title = this.normalizeTitle(item.title || '');
    const url = this.normalizeUrl(item.url || '');
    const publishedAt = this.normalizeTimestamp(item.publishedAt);
    
    return `${title}|${url}|${publishedAt}`;
  }

  // Normalize title for deduplication
  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Normalize URL for deduplication
  normalizeUrl(url) {
    try {
      const u = new URL(url);
      return `${u.hostname}${u.pathname}`;
    } catch {
      return url;
    }
  }

  // Normalize timestamp for deduplication
  normalizeTimestamp(timestamp) {
    const date = new Date(timestamp);
    // Round to nearest 5 minutes for deduplication window
    const rounded = new Date(Math.floor(date.getTime() / this.dedupeWindow) * this.dedupeWindow);
    return rounded.toISOString();
  }

  // Normalize news items
  normalizeNews(newsItems) {
    return newsItems.map(item => ({
      id: item.id || this.generateId(item),
      title: item.title || '',
      summary: item.summary || item.text || '',
      source: item.source || 'Unknown',
      publishedAt: item.publishedAt || new Date().toISOString(),
      url: item.url || '#',
      category: item.category || null,
      tickers: item.tickers || [],
      sentiment: item.sentiment || 'neutral',
      badges: item.badges || [],
      lastUpdate: Date.now()
    }));
  }

  // Generate ID for news item
  generateId(item) {
    const content = `${item.title || ''}|${item.url || ''}|${item.publishedAt || ''}`;
    return Buffer.from(content).toString('base64').slice(0, 16);
  }

  // Get source priority
  getSourcePriority(source) {
    const sourceConfig = this.sources.find(s => s.name === source);
    return sourceConfig ? sourceConfig.priority : 999;
  }

  // Get news for symbol
  getNewsForSymbol(symbol, limit = 50) {
    return appState.getNewsForSymbol(symbol, limit);
  }

  // Get recent news
  getRecentNews(limit = 100) {
    const allNews = Array.from(appState.state.news.values());
    return allNews
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);
  }

  // Get news with filters
  getNews(filters = {}) {
    const {
      symbol = null,
      lookbackDays = 7,
      limit = 100,
      source = null,
      category = null
    } = filters;

    let news = Array.from(appState.state.news.values());

    // Filter by symbol
    if (symbol) {
      news = news.filter(item => 
        item.primaryTicker === symbol || 
        item.tickers?.includes(symbol)
      );
    }

    // Filter by lookback days
    const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    news = news.filter(item => new Date(item.publishedAt) >= cutoff);

    // Filter by source
    if (source) {
      news = news.filter(item => item.source === source);
    }

    // Filter by category
    if (category) {
      news = news.filter(item => item.category === category);
    }

    // Sort by published date
    news.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    return news.slice(0, limit);
  }

  // Clean old news
  cleanup() {
    const cutoff = Date.now() - this.maxAge;
    const oldNews = Array.from(appState.state.news.values())
      .filter(item => item.lastUpdate < cutoff);

    appState.batch(() => {
      oldNews.forEach(item => {
        appState.state.news.delete(item.id);
      });
    });

    return oldNews.length;
  }

  // Get news statistics
  getStats() {
    const allNews = Array.from(appState.state.news.values());
    const now = Date.now();
    
    const stats = {
      total: allNews.length,
      bySource: {},
      byAge: {
        last24h: 0,
        last7d: 0,
        last14d: 0
      },
      withTickers: 0,
      general: 0
    };

    allNews.forEach(item => {
      // By source
      stats.bySource[item.source] = (stats.bySource[item.source] || 0) + 1;
      
      // By age
      const age = now - new Date(item.publishedAt).getTime();
      if (age < 24 * 60 * 60 * 1000) stats.byAge.last24h++;
      if (age < 7 * 24 * 60 * 60 * 1000) stats.byAge.last7d++;
      if (age < 14 * 24 * 60 * 60 * 1000) stats.byAge.last14d++;
      
      // With tickers
      if (item.primaryTicker || item.tickers?.length > 0) {
        stats.withTickers++;
      } else {
        stats.general++;
      }
    });

    return stats;
  }
}

// Export singleton
export const newsAggregator = new NewsAggregator();

// Cleanup old news every hour
setInterval(() => {
  const cleaned = newsAggregator.cleanup();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old news items`);
  }
}, 3600000);
