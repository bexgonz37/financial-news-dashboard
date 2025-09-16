// WS-driven scanner engine using only tick buffer data
import { appState } from '../state/store.js';

class ScannerEngine {
  constructor() {
    this.scannerResults = new Map();
    this.lastRun = 0;
    this.marketHours = this.getMarketHours();
    this.cadence = this.getCadence();
  }

  // Get market hours status
  getMarketHours() {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hour = et.getHours();
    const day = et.getDay();
    
    // Weekend
    if (day === 0 || day === 6) {
      return { status: 'closed', mode: 'weekend' };
    }
    
    // Market hours: 9:30 AM - 4:00 PM ET
    if (hour >= 9 && hour < 16) {
      if (hour === 9 && et.getMinutes() < 30) {
        return { status: 'premarket', mode: 'premarket' };
      }
      return { status: 'open', mode: 'regular' };
    }
    
    // After hours: 4:00 PM - 9:30 AM ET
    return { status: 'afterhours', mode: 'afterhours' };
  }

  // Get scanner cadence based on market status
  getCadence() {
    const market = this.getMarketHours();
    return market.mode === 'regular' ? 20000 : 90000; // 20s market / 90s AH
  }

  // Build dynamic universe from news symbols + watchlist + top movers
  buildUniverse() {
    const universe = new Set();
    
    // 1. Resolved news symbols from last 60-90 minutes
    const newsSymbols = this.getRecentNewsSymbols();
    newsSymbols.forEach(symbol => universe.add(symbol));
    
    // 2. User watchlist (from localStorage or state)
    const watchlist = this.getUserWatchlist();
    watchlist.forEach(symbol => universe.add(symbol));
    
    // 3. Top movers seed (liquid names)
    const topMovers = this.getTopMoversSeed();
    topMovers.forEach(symbol => universe.add(symbol));
    
    return Array.from(universe);
  }

  // Get recent news symbols (last 60-90 minutes)
  getRecentNewsSymbols() {
    const symbols = new Set();
    const now = Date.now();
    const cutoff = now - (90 * 60 * 1000); // 90 minutes ago
    
    // Get from appState or localStorage
    const newsData = window.newsData || [];
    newsData.forEach(item => {
      if (item.symbols && item.symbols.length > 0) {
        const published = new Date(item.published_at).getTime();
        if (published > cutoff) {
          item.symbols.forEach(symbol => symbols.add(symbol));
        }
      }
    });
    
    return Array.from(symbols);
  }

  // Get user watchlist
  getUserWatchlist() {
    try {
      const watchlist = localStorage.getItem('watchlist');
      return watchlist ? JSON.parse(watchlist) : [];
    } catch {
      return [];
    }
  }

  // Get top movers seed
  getTopMoversSeed() {
    return [
      'AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'AMD', 'INTC',
      'SPY', 'QQQ', 'IWM', 'VTI', 'ARKK', 'TQQQ', 'SOXL', 'TMF', 'UPRO', 'TNA'
    ];
  }

  // Calculate momentum signals from tick buffer
  calculateMomentum(symbol, ticks) {
    if (ticks.length < 2) return { momentum1m: 0, momentum5m: 0 };
    
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    const currentPrice = ticks[ticks.length - 1].price;
    const price1mAgo = this.getPriceAtTime(ticks, oneMinuteAgo);
    const price5mAgo = this.getPriceAtTime(ticks, fiveMinutesAgo);
    
    const momentum1m = price1mAgo ? ((currentPrice - price1mAgo) / price1mAgo) * 100 : 0;
    const momentum5m = price5mAgo ? ((currentPrice - price5mAgo) / price5mAgo) * 100 : 0;
    
    return { momentum1m, momentum5m };
  }

  // Get price at specific time from tick buffer
  getPriceAtTime(ticks, timestamp) {
    for (let i = ticks.length - 1; i >= 0; i--) {
      if (ticks[i].timestamp <= timestamp) {
        return ticks[i].price;
      }
    }
    return ticks[0]?.price;
  }

  // Calculate volume signals
  calculateVolumeSignals(symbol, ticks) {
    if (ticks.length < 10) return { rvol: 1, unusualVol: false };
    
    const recentTicks = ticks.slice(-10);
    const avgVolume = recentTicks.reduce((sum, tick) => sum + (tick.volume || 0), 0) / recentTicks.length;
    const currentVolume = recentTicks[recentTicks.length - 1].volume || 0;
    
    const rvol = avgVolume > 0 ? currentVolume / avgVolume : 1;
    const unusualVol = rvol > 2.0; // 2x average volume
    
    return { rvol, unusualVol };
  }

  // Calculate gap signals
  calculateGapSignals(symbol, ticks) {
    if (ticks.length < 2) return { gap: 0, gapUp: false, gapDown: false };
    
    const currentPrice = ticks[ticks.length - 1].price;
    const prevClose = this.getPrevClose(symbol); // This would need to be implemented
    
    if (!prevClose) return { gap: 0, gapUp: false, gapDown: false };
    
    const gap = ((currentPrice - prevClose) / prevClose) * 100;
    const gapUp = gap > 2; // 2% gap up
    const gapDown = gap < -2; // 2% gap down
    
    return { gap, gapUp, gapDown };
  }

  // Get previous close (simplified - would need real implementation)
  getPrevClose(symbol) {
    // This would typically fetch from a prev-close API
    // For now, return a mock value
    return 100; // Mock previous close
  }

  // Calculate range break signals
  calculateRangeBreak(symbol, ticks) {
    if (ticks.length < 20) return { rangeBreak: false, hod: false, lod: false };
    
    const recentTicks = ticks.slice(-20);
    const prices = recentTicks.map(tick => tick.price);
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const currentPrice = prices[prices.length - 1];
    
    const hod = currentPrice === high; // New high of day
    const lod = currentPrice === low; // New low of day
    const rangeBreak = hod || lod;
    
    return { rangeBreak, hod, lod };
  }

  // Calculate news momentum
  calculateNewsMomentum(symbol, ticks) {
    if (ticks.length < 2) return { newsMomentum: 0 };
    
    const now = Date.now();
    const recentNews = this.getRecentNewsForSymbol(symbol, 30 * 60 * 1000); // Last 30 minutes
    const currentPrice = ticks[ticks.length - 1].price;
    const price30mAgo = this.getPriceAtTime(ticks, now - (30 * 60 * 1000));
    
    if (!price30mAgo || recentNews.length === 0) return { newsMomentum: 0 };
    
    const priceChange = ((currentPrice - price30mAgo) / price30mAgo) * 100;
    const newsMomentum = priceChange * Math.log(recentNews.length + 1); // Weight by news count
    
    return { newsMomentum };
  }

  // Get recent news for symbol
  getRecentNewsForSymbol(symbol, timeWindow) {
    const now = Date.now();
    const cutoff = now - timeWindow;
    
    const newsData = window.newsData || [];
    return newsData.filter(item => {
      const published = new Date(item.published_at).getTime();
      return published > cutoff && item.symbols && item.symbols.includes(symbol);
    });
  }

  // Run scanner for all symbols in universe
  runScanner() {
    const universe = this.buildUniverse();
    const results = [];
    
    universe.forEach(symbol => {
      const ticks = appState.getTicks(symbol);
      if (!ticks || ticks.length < 2) return;
      
      const momentum = this.calculateMomentum(symbol, ticks);
      const volume = this.calculateVolumeSignals(symbol, ticks);
      const gap = this.calculateGapSignals(symbol, ticks);
      const range = this.calculateRangeBreak(symbol, ticks);
      const news = this.calculateNewsMomentum(symbol, ticks);
      
      const currentPrice = ticks[ticks.length - 1].price;
      const sessionOpen = this.getSessionOpen(symbol, ticks);
      const percentChange = sessionOpen ? ((currentPrice - sessionOpen) / sessionOpen) * 100 : 0;
      
      // Calculate overall score
      const score = this.calculateScore({
        momentum,
        volume,
        gap,
        range,
        news,
        percentChange
      });
      
      // Determine category
      const category = this.categorizeSignal({
        momentum,
        volume,
        gap,
        range,
        news,
        percentChange
      });
      
      results.push({
        symbol,
        price: currentPrice,
        percentChange,
        momentum1m: momentum.momentum1m,
        momentum5m: momentum.momentum5m,
        rvol: volume.rvol,
        unusualVol: volume.unusualVol,
        gap: gap.gap,
        gapUp: gap.gapUp,
        gapDown: gap.gapDown,
        rangeBreak: range.rangeBreak,
        hod: range.hod,
        lod: range.lod,
        newsMomentum: news.newsMomentum,
        score,
        category,
        lastUpdate: Date.now()
      });
    });
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    this.scannerResults.set('all', results);
    this.lastRun = Date.now();
    
    return results;
  }

  // Get session open price
  getSessionOpen(symbol, ticks) {
    // Find first tick after market open (9:30 AM ET)
    const marketOpen = new Date();
    marketOpen.setHours(9, 30, 0, 0);
    const marketOpenTime = marketOpen.getTime();
    
    for (let i = 0; i < ticks.length; i++) {
      if (ticks[i].timestamp >= marketOpenTime) {
        return ticks[i].price;
      }
    }
    
    return ticks[0]?.price;
  }

  // Calculate overall score
  calculateScore(signals) {
    let score = 0;
    
    // Momentum weight
    score += Math.abs(signals.momentum.momentum1m) * 0.3;
    score += Math.abs(signals.momentum.momentum5m) * 0.2;
    
    // Volume weight
    score += (signals.volume.rvol - 1) * 0.2;
    
    // Gap weight
    score += Math.abs(signals.gap.gap) * 0.15;
    
    // Range break weight
    if (signals.range.rangeBreak) score += 0.1;
    
    // News momentum weight
    score += Math.abs(signals.news.newsMomentum) * 0.05;
    
    return Math.max(0, score);
  }

  // Categorize signal
  categorizeSignal(signals) {
    if (signals.momentum.momentum1m > 2 && signals.volume.unusualVol) return 'momentum';
    if (signals.volume.unusualVol && signals.volume.rvol > 3) return 'volume';
    if (signals.gap.gapUp) return 'gap_up';
    if (signals.gap.gapDown) return 'gap_down';
    if (signals.range.hod) return 'hod';
    if (signals.range.lod) return 'lod';
    if (signals.news.newsMomentum > 1) return 'news_momentum';
    
    return 'other';
  }

  // Get scanner results by category
  getResults(category = 'all', limit = 50) {
    const results = this.scannerResults.get('all') || [];
    
    if (category === 'all') {
      return results.slice(0, limit);
    }
    
    return results
      .filter(item => item.category === category)
      .slice(0, limit);
  }

  // Start scanner with market-aware cadence
  start() {
    // Run immediately
    this.runScanner();
    
    // Set up interval
    setInterval(() => {
      this.runScanner();
    }, this.cadence);
  }
}

// Singleton instance
const scannerEngine = new ScannerEngine();

export default scannerEngine;
