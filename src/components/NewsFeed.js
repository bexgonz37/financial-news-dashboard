// News feed component with live ticker resolution and auto-subscription
import { appState } from '../state/store.js';
import { tickerResolver } from '../lib/tickers/resolve.js';
import { wsQuotes } from '../ws/quotes.js';
import { MiniChart } from './MiniChart.js';

class NewsFeed {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.unsubscribe = null;
    this.miniCharts = new Map(); // symbol -> MiniChart instance
    this.visibleItems = new Set(); // Track visible news items
    this.resolvedItems = new Map(); // Track resolved tickers
    
    if (this.container) {
      this.init();
    }
  }

  init() {
    this.render();
    this.subscribe();
    this.setupIntersectionObserver();
  }

  subscribe() {
    this.unsubscribe = appState.subscribe((state) => {
      this.render();
    });
  }

  setupIntersectionObserver() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const newsItem = entry.target;
          const newsId = newsItem.dataset.newsId;
          const symbol = newsItem.dataset.symbol;
          
          if (entry.isIntersecting) {
            this.visibleItems.add(newsId);
            if (symbol && symbol !== 'null') {
              this.subscribeToSymbol(symbol);
            }
          } else {
            this.visibleItems.delete(newsId);
            if (symbol && symbol !== 'null') {
              this.unsubscribeFromSymbol(symbol);
            }
          }
        });
      }, { threshold: 0.1 });
    }
  }

  async render() {
    if (!this.container) return;
    
    const news = Array.from(appState.state.news.values())
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 50);

    this.container.innerHTML = news.map(item => this.renderNewsItem(item)).join('');
    
    // Setup intersection observers for new items
    if (this.observer) {
      this.container.querySelectorAll('.news-item').forEach(item => {
        this.observer.observe(item);
      });
    }
  }

  renderNewsItem(item) {
    const resolution = appState.getTickerResolution(item.id);
    const hasResolution = resolution && resolution.ticker;
    const symbol = hasResolution ? resolution.ticker : null;
    
    return `
      <div class="news-item" data-news-id="${item.id}" data-symbol="${symbol || 'null'}">
        <div class="news-header">
          <h3 class="news-title">
            <a href="${item.url || '#'}" target="_blank" onclick="this.dispatchEvent(new CustomEvent('newsClick', {detail: {symbol: '${symbol}', timestamp: '${item.publishedAt}'}}))">
              ${item.title || 'No title'}
            </a>
          </h3>
          <div class="news-meta">
            <span class="news-source">${item.source || 'Unknown'}</span>
            <span class="news-time">${this.formatTime(item.publishedAt)}</span>
          </div>
        </div>
        
        <div class="news-content">
          <p class="news-summary">${item.summary || item.content || 'No summary available'}</p>
          
          <div class="news-ticker">
            ${this.renderTickerSection(item, resolution)}
          </div>
        </div>
        
        <div class="news-actions">
          <button class="btn-resolve" onclick="this.resolveTicker('${item.id}')">
            ${hasResolution ? 'Re-resolve' : 'Resolve Ticker'}
          </button>
        </div>
      </div>
    `;
  }

  renderTickerSection(item, resolution) {
    if (!resolution) {
      return '<div class="resolve-pill">Resolve</div>';
    }
    
    if (resolution.isGeneral) {
      return '<div class="general-pill">GENERAL</div>';
    }
    
    if (resolution.ticker) {
      return `
        <div class="ticker-section">
          <span class="ticker-chip" onclick="this.selectTicker('${resolution.ticker}')">
            $${resolution.ticker}
          </span>
          <div class="mini-chart-container" data-symbol="${resolution.ticker}"></div>
          <div class="confidence-badge" title="${resolution.reason}">
            ${Math.round(resolution.confidence * 100)}%
          </div>
        </div>
      `;
    }
    
    return '<div class="resolve-pill">Resolve</div>';
  }

  async resolveTicker(newsId) {
    const item = appState.state.news.get(newsId);
    if (!item) return;
    
    try {
      const resolution = await tickerResolver.resolveTicker(item);
      appState.updateTickerResolution(newsId, resolution);
      
      // Re-render the specific item
      const newsItem = this.container.querySelector(`[data-news-id="${newsId}"]`);
      if (newsItem) {
        newsItem.outerHTML = this.renderNewsItem(item);
        this.setupIntersectionObserver();
      }
      
      // Auto-subscribe if resolved
      if (resolution.ticker) {
        this.subscribeToSymbol(resolution.ticker);
      }
      
    } catch (error) {
      console.error('Ticker resolution failed:', error);
    }
  }

  subscribeToSymbol(symbol) {
    if (!symbol || symbol === 'null') return;
    
    wsQuotes.subscribe(symbol);
    
    // Create mini-chart if not exists
    if (!this.miniCharts.has(symbol)) {
      const container = this.container.querySelector(`[data-symbol="${symbol}"]`);
      if (container) {
        const miniChart = new MiniChart(container, { symbol });
        this.miniCharts.set(symbol, miniChart);
      }
    }
  }

  unsubscribeFromSymbol(symbol) {
    if (!symbol || symbol === 'null') return;
    
    wsQuotes.unsubscribe(symbol);
    
    // Clean up mini-chart
    if (this.miniCharts.has(symbol)) {
      const miniChart = this.miniCharts.get(symbol);
      miniChart.destroy();
      this.miniCharts.delete(symbol);
    }
  }

  async loadNews() {
    try {
      const response = await fetch('/api/news?limit=50');
      const data = await response.json();
      
      if (data.success && data.data?.news) {
        const newsItems = data.data.news;
        const meta = data.data.meta || {};
        
        console.log(`Loaded ${newsItems.length} news items`);
        console.log('Provider counts:', meta.counts);
        if (meta.errors && meta.errors.length > 0) {
          console.warn('Provider errors:', meta.errors);
        }
        
        // Store news in app state
        appState.updateNews(newsItems);
        
        // Resolve tickers for each news item
        newsItems.forEach(item => this.resolveNewsItem(item));
        
        return { items: newsItems, meta };
      } else {
        console.error('Failed to load news:', data.error);
        return { items: [], meta: { errors: [data.error || 'Unknown error'] } };
      }
    } catch (error) {
      console.error('Error loading news:', error);
      return { items: [], meta: { errors: [error.message] } };
    }
  }

  resolveNewsItem(item) {
    // Use provider symbols first, then fall back to resolver
    let resolution;
    if (item.symbols && item.symbols.length > 0) {
      resolution = {
        ticker: item.symbols[0].toUpperCase(),
        confidence: 0.95,
        reason: 'provider',
        isGeneral: false
      };
      appState.updateTickerResolution(item.id, resolution);
      if (resolution.ticker) {
        this.subscribeToSymbol(resolution.ticker);
      }
    } else {
      // Fall back to ticker resolver
      tickerResolver.resolveTicker(item).then(resolution => {
        appState.updateTickerResolution(item.id, resolution);
        if (resolution.ticker) {
          this.subscribeToSymbol(resolution.ticker);
        }
      });
    }
  }

  selectTicker(symbol) {
    // Dispatch event to parent or update UI
    const event = new CustomEvent('tickerSelected', { detail: { symbol } });
    document.dispatchEvent(event);
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Clean up all mini-charts
    this.miniCharts.forEach(miniChart => miniChart.destroy());
    this.miniCharts.clear();
  }
}

// Export class
export { NewsFeed };
