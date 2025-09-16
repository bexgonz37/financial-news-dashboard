// Single source of truth state store
class AppState {
  constructor() {
    this.state = {
      quotes: new Map(), // symbol -> quote data
      scanners: new Map(), // scanner type -> results
      news: new Map(), // news id -> news item
      tickMap: new Map(), // symbol -> ticker info
      lastUpdated: new Map(), // data type -> timestamp
      status: {
        marketOpen: false,
        afterHours: false,
        wsConnected: false,
        providers: new Map()
      },
      watchlist: new Set(),
      ui: {
        activeTab: 'news',
        selectedSymbol: null,
        focusMode: false
      }
    };
    
    this.listeners = new Set();
    this.batchUpdates = false;
    this.pendingUpdates = new Set();
  }

  // Subscribe to state changes
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners
  notify() {
    if (this.batchUpdates) {
      this.pendingUpdates.add('notify');
      return;
    }
    
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });
  }

  // Batch updates for performance
  batch(updater) {
    this.batchUpdates = true;
    try {
      updater();
    } finally {
      this.batchUpdates = false;
      if (this.pendingUpdates.has('notify')) {
        this.pendingUpdates.delete('notify');
        this.notify();
      }
    }
  }

  // Update quotes
  updateQuotes(quotes) {
    this.batch(() => {
      quotes.forEach(quote => {
        this.state.quotes.set(quote.symbol, {
          ...quote,
          lastUpdate: Date.now()
        });
      });
      this.state.lastUpdated.set('quotes', Date.now());
    });
  }

  // Update single quote
  updateQuote(symbol, quote) {
    this.batch(() => {
      this.state.quotes.set(symbol, {
        ...quote,
        lastUpdate: Date.now()
      });
      this.state.lastUpdated.set('quotes', Date.now());
    });
  }

  // Update scanner results
  updateScanner(type, results) {
    this.batch(() => {
      this.state.scanners.set(type, {
        results,
        lastUpdate: Date.now()
      });
      this.state.lastUpdated.set('scanners', Date.now());
    });
  }

  // Update news
  updateNews(newsItems) {
    this.batch(() => {
      newsItems.forEach(item => {
        this.state.news.set(item.id, {
          ...item,
          lastUpdate: Date.now()
        });
      });
      this.state.lastUpdated.set('news', Date.now());
    });
  }

  // Add to watchlist
  addToWatchlist(symbol) {
    this.batch(() => {
      this.state.watchlist.add(symbol);
    });
  }

  // Remove from watchlist
  removeFromWatchlist(symbol) {
    this.batch(() => {
      this.state.watchlist.delete(symbol);
    });
  }

  // Update ticker resolution
  updateTickerResolution(symbol, resolution) {
    this.batch(() => {
      this.state.tickMap.set(symbol, {
        ...resolution,
        lastUpdate: Date.now()
      });
    });
  }

  // Update status
  updateStatus(updates) {
    this.batch(() => {
      Object.assign(this.state.status, updates);
    });
  }

  // Update UI state
  updateUI(updates) {
    this.batch(() => {
      Object.assign(this.state.ui, updates);
    });
  }

  // Get quotes for symbols
  getQuotes(symbols) {
    return symbols.map(symbol => this.state.quotes.get(symbol)).filter(Boolean);
  }

  // Get news for symbol
  getNewsForSymbol(symbol, limit = 50) {
    const allNews = Array.from(this.state.news.values());
    return allNews
      .filter(item => item.primaryTicker === symbol)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);
  }

  // Get scanner results
  getScannerResults(type) {
    const scanner = this.state.scanners.get(type);
    return scanner ? scanner.results : [];
  }

  // Check if data is stale
  isStale(dataType, maxAge = 300000) { // 5 minutes default
    const lastUpdate = this.state.lastUpdated.get(dataType);
    if (!lastUpdate) return true;
    return Date.now() - lastUpdate > maxAge;
  }

  // Get data age in seconds
  getDataAge(dataType) {
    const lastUpdate = this.state.lastUpdated.get(dataType);
    if (!lastUpdate) return null;
    return Math.floor((Date.now() - lastUpdate) / 1000);
  }

  // Get market status
  getMarketStatus() {
    const { marketOpen, afterHours } = this.state.status;
    if (marketOpen) return 'market';
    if (afterHours) return 'after-hours';
    return 'closed';
  }

  // Get watchlist symbols
  getWatchlistSymbols() {
    return Array.from(this.state.watchlist);
  }

  // Clear old data
  cleanup(maxAge = 86400000) { // 24 hours
    const cutoff = Date.now() - maxAge;
    
    this.batch(() => {
      // Clean old news
      for (const [id, item] of this.state.news) {
        if (item.lastUpdate < cutoff) {
          this.state.news.delete(id);
        }
      }
      
      // Clean old quotes (keep last 1000)
      if (this.state.quotes.size > 1000) {
        const sortedQuotes = Array.from(this.state.quotes.entries())
          .sort((a, b) => b[1].lastUpdate - a[1].lastUpdate)
          .slice(0, 1000);
        
        this.state.quotes.clear();
        sortedQuotes.forEach(([symbol, quote]) => {
          this.state.quotes.set(symbol, quote);
        });
      }
    });
  }
}

// Export singleton
export const appState = new AppState();

// Cleanup old data every hour
setInterval(() => {
  appState.cleanup();
}, 3600000);
