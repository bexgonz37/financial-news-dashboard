// In-memory storage for Vercel compatibility
// In production, you'd want to use a real database like Supabase, PlanetScale, or MongoDB
const memoryStore = {
  news: new Map(),
  tickers: new Map()
};

// Initialize database (no-op for in-memory)
function initDatabase() {
  return Promise.resolve();
}

// News operations
function saveNews(article) {
  return new Promise((resolve) => {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString(); // 14 days
    const session = getMarketSession(new Date(article.publishedAt));
    
    const newsItem = {
      id: article.id,
      title: article.title,
      url: article.url,
      source: article.source,
      publishedAt: article.publishedAt,
      summary: article.summary || '',
      tickers: article.tickers || [],
      createdAt: now,
      expiresAt: expiresAt,
      session: session,
      lastUpdated: now
    };
    
    memoryStore.news.set(article.id, newsItem);
    resolve(article.id);
  });
}

function getNews(filters = {}) {
  return new Promise((resolve) => {
    let news = Array.from(memoryStore.news.values());
    
    // Filter by expiration
    const now = new Date();
    news = news.filter(item => new Date(item.expiresAt) > now);
    
    // Filter by ticker
    if (filters.ticker) {
      news = news.filter(item => 
        item.tickers.some(ticker => ticker === filters.ticker)
      );
    }
    
    // Filter by source
    if (filters.source) {
      news = news.filter(item => item.source === filters.source);
    }
    
    // Filter by date range
    if (filters.dateRange) {
      const days = filters.dateRange === 'today' ? 1 : 
                   filters.dateRange === '7d' ? 7 : 14;
      const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      news = news.filter(item => new Date(item.publishedAt) > cutoffDate);
    }
    
    // Sort by published date (newest first)
    news.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    
    // Limit results
    const limit = filters.limit || 100;
    news = news.slice(0, limit);
    
    // Add stale indicators
    news = news.map(item => ({
      ...item,
      isStale: isDataStale(item.lastUpdated)
    }));
    
    resolve(news);
  });
}

function cleanupExpiredNews() {
  return new Promise((resolve) => {
    const now = new Date();
    for (const [id, item] of memoryStore.news.entries()) {
      if (new Date(item.expiresAt) < now) {
        memoryStore.news.delete(id);
      }
    }
    resolve();
  });
}

// Ticker operations
function saveTicker(symbol, name, aliases = [], sector = '', marketCap = '') {
  return new Promise((resolve) => {
    const tickerData = {
      symbol,
      name,
      aliases,
      sector,
      marketCap,
      lastUpdated: new Date().toISOString()
    };
    
    memoryStore.tickers.set(symbol, tickerData);
    resolve(symbol);
  });
}

function getTickerBySymbol(symbol) {
  return new Promise((resolve) => {
    const ticker = memoryStore.tickers.get(symbol);
    resolve(ticker || null);
  });
}

function searchTickerByAlias(alias) {
  return new Promise((resolve) => {
    const results = [];
    for (const [symbol, ticker] of memoryStore.tickers.entries()) {
      if (ticker.aliases.some(a => a.toLowerCase().includes(alias.toLowerCase()))) {
        results.push(ticker);
      }
    }
    resolve(results);
  });
}

// Utility functions
function getMarketSession(date) {
  const et = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const hour = et.getHours();
  const minute = et.getMinutes();
  const time = hour * 60 + minute;
  
  // Market hours: 9:30 AM - 4:00 PM ET
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM
  
  if (time >= marketOpen && time < marketClose) {
    return 'RTH'; // Regular Trading Hours
  } else {
    return 'AH'; // After Hours
  }
}

function isDataStale(lastUpdated, maxAgeSeconds = 30) {
  const age = (Date.now() - new Date(lastUpdated).getTime()) / 1000;
  return age > maxAgeSeconds;
}

// Initialize database on module load
initDatabase().catch(console.error);

module.exports = {
  saveNews,
  getNews,
  cleanupExpiredNews,
  saveTicker,
  getTickerBySymbol,
  searchTickerByAlias,
  getMarketSession,
  isDataStale
};