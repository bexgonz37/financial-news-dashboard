// Live scanner engine consuming tick buffers only
import { appState } from '../../state/store.js';
import { marketHours } from '../time/marketHours.js';

class ScannerEngine {
  constructor() {
    this.scanners = {
      'movers': this.scanMovers.bind(this),
      'rvol': this.scanRvol.bind(this),
      'unusual-volume': this.scanUnusualVolume.bind(this),
      'range-break': this.scanRangeBreak.bind(this),
      'news-momentum': this.scanNewsMomentum.bind(this)
    };
  }

  // Run all scanners
  async runAllScanners() {
    const results = {};
    
    // Run scanners in parallel for better performance
    const scannerPromises = Object.entries(this.scanners).map(async ([name, scanner]) => {
      try {
        const result = await scanner();
        return [name, result];
      } catch (error) {
        console.error(`Scanner ${name} failed:`, error);
        return [name, []];
      }
    });
    
    const scannerResults = await Promise.all(scannerPromises);
    
    // Convert array of [name, result] pairs to object
    for (const [name, result] of scannerResults) {
      results[name] = result;
    }
    
    return results;
  }

  // Get all symbols with tick data
  getAllSymbolsWithTicks() {
    return appState.getAllSymbolsWithTicks();
  }

  // Movers scanner - % change vs first tick in buffer
  scanMovers(thresholds = {}) {
    const symbols = this.getAllSymbolsWithTicks();
    const results = [];
    
    for (const { symbol, ticks, lastPrice } of symbols) {
      if (ticks.length < 2) continue;
      
      const firstPrice = ticks[0].price;
      const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
      
      const minChange = thresholds.minChange || 0;
      const maxChange = thresholds.maxChange || 1000;
      
      if (changePercent >= minChange && changePercent <= maxChange) {
        results.push({
          symbol,
          price: lastPrice,
          change: lastPrice - firstPrice,
          changePercent,
          volume: ticks.reduce((sum, tick) => sum + tick.volume, 0),
          score: Math.abs(changePercent),
          reason: `Moved ${changePercent.toFixed(2)}%`
        });
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  // Relative volume scanner - current volume vs average
  scanRvol(thresholds = {}) {
    const symbols = this.getAllSymbolsWithTicks();
    const results = [];
    
    for (const { symbol, ticks } of symbols) {
      if (ticks.length < 10) continue;
      
      const currentVolume = ticks[ticks.length - 1].volume;
      const avgVolume = ticks.reduce((sum, tick) => sum + tick.volume, 0) / ticks.length;
      const rvol = avgVolume > 0 ? currentVolume / avgVolume : 0;
      
      const minRvol = thresholds.minRvol || 1.5;
      
      if (rvol >= minRvol) {
        results.push({
          symbol,
          price: ticks[ticks.length - 1].price,
          volume: currentVolume,
          avgVolume,
          rvol,
          score: rvol,
          reason: `${rvol.toFixed(1)}x avg volume`
        });
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  // Unusual volume scanner - intraday vs buffer average
  scanUnusualVolume(thresholds = {}) {
    const symbols = this.getAllSymbolsWithTicks();
    const results = [];
    
    for (const { symbol, ticks } of symbols) {
      if (ticks.length < 20) continue;
      
      // Get recent ticks (last 10) vs older ticks
      const recentTicks = ticks.slice(-10);
      const olderTicks = ticks.slice(-20, -10);
      
      const recentVolume = recentTicks.reduce((sum, tick) => sum + tick.volume, 0);
      const olderVolume = olderTicks.reduce((sum, tick) => sum + tick.volume, 0);
      
      const recentAvg = recentVolume / recentTicks.length;
      const olderAvg = olderVolume / olderTicks.length;
      
      const volumeRatio = olderAvg > 0 ? recentAvg / olderAvg : 0;
      
      const minRatio = thresholds.minRatio || 2.0;
      
      if (volumeRatio >= minRatio) {
        results.push({
          symbol,
          price: ticks[ticks.length - 1].price,
          recentVolume,
          olderVolume,
          volumeRatio,
          score: volumeRatio,
          reason: `${volumeRatio.toFixed(1)}x volume spike`
        });
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  // Range break scanner - new HOD/LOD from buffer
  scanRangeBreak(thresholds = {}) {
    const symbols = this.getAllSymbolsWithTicks();
    const results = [];
    
    for (const { symbol, ticks } of symbols) {
      if (ticks.length < 10) continue;
      
      const prices = ticks.map(tick => tick.price);
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const current = prices[prices.length - 1];
      
      const range = high - low;
      const rangePercent = range / low * 100;
      
      const isBreakout = current >= high * 0.99 || current <= low * 1.01;
      const minRange = thresholds.minRange || 2.0;
      
      if (isBreakout && rangePercent >= minRange) {
        results.push({
          symbol,
          price: current,
          high,
          low,
          range,
          rangePercent,
          score: rangePercent,
          reason: `Range break: ${rangePercent.toFixed(1)}% range`
        });
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  // News momentum scanner - score based on news recency and price movement
  scanNewsMomentum(thresholds = {}) {
    const symbols = this.getAllSymbolsWithTicks();
    const results = [];
    
    for (const { symbol, ticks } of symbols) {
      if (ticks.length < 5) continue;
      
      // Get recent news for this symbol
      const recentNews = Array.from(appState.state.news.values())
        .filter(item => {
          const resolution = appState.getTickerResolution(item.id);
          return resolution && resolution.ticker === symbol;
        })
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
        .slice(0, 3);
      
      if (recentNews.length === 0) continue;
      
      const latestNews = recentNews[0];
      const newsAge = (Date.now() - new Date(latestNews.published_at).getTime()) / 1000 / 60; // minutes
      
      // Calculate price movement since news
      const newsTime = new Date(latestNews.published_at).getTime();
      const relevantTicks = ticks.filter(tick => tick.timestamp >= newsTime);
      
      if (relevantTicks.length < 2) continue;
      
      const startPrice = relevantTicks[0].price;
      const currentPrice = relevantTicks[relevantTicks.length - 1].price;
      const priceChange = ((currentPrice - startPrice) / startPrice) * 100;
      
      // Calculate volume surge
      const recentVolume = relevantTicks.reduce((sum, tick) => sum + tick.volume, 0);
      const avgVolume = ticks.reduce((sum, tick) => sum + tick.volume, 0) / ticks.length;
      const volumeRatio = avgVolume > 0 ? recentVolume / avgVolume : 0;
      
      // Score based on news recency, price movement, and volume
      const recencyScore = Math.max(0, 1 - (newsAge / 60)); // Decay over 1 hour
      const priceScore = Math.abs(priceChange) / 10; // Normalize to 0-1
      const volumeScore = Math.min(volumeRatio / 3, 1); // Cap at 3x
      
      const score = (recencyScore * 0.4 + priceScore * 0.4 + volumeScore * 0.2) * 100;
      
      const minScore = thresholds.minScore || 30;
      
      if (score >= minScore) {
        results.push({
          symbol,
          price: currentPrice,
          priceChange,
          volumeRatio,
          newsAge,
          newsCount: recentNews.length,
          score,
          reason: `News momentum: ${score.toFixed(1)} score`
        });
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }
}

// Export singleton
export const scannerEngine = new ScannerEngine();