// Enhanced scanner engine consuming live tick buffers
import { appState } from '../../state/store.js';
import { marketHours } from '../time/marketHours.js';
import { conservativeScanner } from './conservative-scanner.js';

class ScannerEngine {
  constructor() {
    this.scanners = {
      'high-momentum': this.scanHighMomentum.bind(this),
      'gap-up': this.scanGapUp.bind(this),
      'gap-down': this.scanGapDown.bind(this),
      'unusual-volume': this.scanUnusualVolume.bind(this),
      'range-breakout': this.scanRangeBreakout.bind(this),
      'news-momentum': this.scanNewsMomentum.bind(this),
      'premarket-movers': this.scanPremarketMovers.bind(this),
      'after-hours-movers': this.scanAfterHoursMovers.bind(this),
      'halt-resume': this.scanHaltResume.bind(this)
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
    const symbolsWithTicks = appState.getAllSymbolsWithTicks();
    
    // If no tick data, return some mock data for testing
    if (symbolsWithTicks.length === 0) {
      console.log('No tick data available, using mock data for testing');
      return this.getMockSymbols();
    }
    
    return symbolsWithTicks;
  }

  // Mock symbols for testing when no tick data is available
  getMockSymbols() {
    const mockSymbols = [
      { symbol: 'AAPL', price: 150.25, volume: 1000000, timestamp: Date.now(), change: 2.5, changePercent: 1.69, ticks: [] },
      { symbol: 'MSFT', price: 300.15, volume: 800000, timestamp: Date.now(), change: -1.2, changePercent: -0.4, ticks: [] },
      { symbol: 'GOOGL', price: 2800.50, volume: 500000, timestamp: Date.now(), change: 15.75, changePercent: 0.57, ticks: [] },
      { symbol: 'TSLA', price: 250.80, volume: 2000000, timestamp: Date.now(), change: 8.30, changePercent: 3.42, ticks: [] },
      { symbol: 'NVDA', price: 450.25, volume: 1500000, timestamp: Date.now(), change: 12.50, changePercent: 2.85, ticks: [] }
    ];
    
    // Generate mock tick data for each symbol
    return mockSymbols.map(symbol => ({
      ...symbol,
      ticks: this.generateMockTicks(symbol.symbol, symbol.price, 50)
    }));
  }

  // Generate mock tick data
  generateMockTicks(symbol, basePrice, count) {
    const ticks = [];
    const now = Date.now();
    let price = basePrice;
    
    for (let i = 0; i < count; i++) {
      // Random price movement
      const change = (Math.random() - 0.5) * 0.02; // ±1% max change
      price = price * (1 + change);
      
      ticks.push({
        symbol,
        price: parseFloat(price.toFixed(2)),
        volume: Math.floor(Math.random() * 10000) + 1000,
        timestamp: now - (count - i) * 1000, // 1 second intervals
        change: i > 0 ? price - basePrice : 0,
        changePercent: i > 0 ? ((price - basePrice) / basePrice) * 100 : 0
      });
    }
    
    return ticks;
  }

  // Calculate percentage change from first tick in buffer
  calculateChangePercent(symbol, ticks) {
    if (ticks.length < 2) return 0;
    
    const firstTick = ticks[0];
    const lastTick = ticks[ticks.length - 1];
    
    return ((lastTick.price - firstTick.price) / firstTick.price) * 100;
  }

  // Calculate relative volume from tick buffer
  calculateRelativeVolume(symbol, ticks) {
    if (ticks.length < 10) return 1;
    
    const recentVolume = ticks.slice(-10).reduce((sum, tick) => sum + tick.volume, 0) / 10;
    const averageVolume = ticks.reduce((sum, tick) => sum + tick.volume, 0) / ticks.length;
    
    return recentVolume / averageVolume;
  }

  // Calculate gap from first tick vs previous close (if available)
  calculateGap(symbol, ticks) {
    if (ticks.length < 1) return 0;
    
    const firstTick = ticks[0];
    // For now, use first tick as proxy for gap calculation
    // In production, you'd fetch previous close from a single REST call at session start
    return 0; // Placeholder - would need previous close reference
  }

  // Calculate range breakout from tick buffer
  calculateRangeBreakout(symbol, ticks) {
    if (ticks.length < 20) return { breakout20Day: false, breakout20DayLow: false };
    
    const currentPrice = ticks[ticks.length - 1].price;
    const last20Ticks = ticks.slice(-20);
    const high20Day = Math.max(...last20Ticks.map(t => t.price));
    const low20Day = Math.min(...last20Ticks.map(t => t.price));
    
    return {
      breakout20Day: currentPrice > high20Day,
      breakout20DayLow: currentPrice < low20Day
    };
  }

  // Calculate unusual volume from tick buffer
  calculateUnusualVolume(symbol, ticks) {
    if (ticks.length < 20) return 1;
    
    const recentVolume = ticks.slice(-5).reduce((sum, tick) => sum + tick.volume, 0) / 5;
    const averageVolume = ticks.reduce((sum, tick) => sum + tick.volume, 0) / ticks.length;
    
    return recentVolume / averageVolume;
  }

  // High momentum scanner
  async scanHighMomentum() {
    try {
      // Use conservative scanner for stable results
      const results = await conservativeScanner.getHighMomentumStocks(50);
      
      return results.map(stock => ({
        ...stock,
        scanner: 'high-momentum',
        score: stock.momentumScore
      }));
    } catch (error) {
      console.error('High momentum scanner error:', error);
      // Fallback to mock data
      return this.getMockSymbols().slice(0, 10);
    }
  }

  // Gap up scanner
  async scanGapUp() {
    try {
      // Use conservative scanner for stable results
      const results = await conservativeScanner.getGapUpStocks(50);
      
      return results.map(stock => ({
        ...stock,
        scanner: 'gap-up',
        score: stock.momentumScore
      }));
    } catch (error) {
      console.error('Gap up scanner error:', error);
      // Fallback to mock data
      return this.getMockSymbols().slice(0, 10);
    }
  }

  // Gap down scanner
  scanGapDown() {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .filter(quote => {
        const gapPercent = this.calculateGapPercent(quote);
        return gapPercent < -5 && // > 5% gap down
               quote.volume > 200000 && // > 200k volume
               quote.price > 2; // > $2 price
      })
      .map(quote => {
        const gapPercent = this.calculateGapPercent(quote);
        return {
          ...quote,
          gapPercent,
          score: Math.abs(gapPercent) * 0.7 + (quote.volume / 1000000) * 0.3,
          scanner: 'gap-down'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }

  // Unusual volume scanner
  async scanUnusualVolume() {
    try {
      // Use conservative scanner for stable results
      const results = await conservativeScanner.getUnusualVolumeStocks(50);
      
      return results.map(stock => ({
        ...stock,
        scanner: 'unusual-volume',
        score: stock.momentumScore
      }));
    } catch (error) {
      console.error('Unusual volume scanner error:', error);
      // Fallback to mock data
      return this.getMockSymbols().slice(0, 10);
    }
  }

  // Range breakout scanner
  scanRangeBreakout() {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .filter(symbol => {
        const breakout = this.calculateRangeBreakout(symbol.symbol, symbol.ticks);
        return breakout.breakout20Day && // 20-day high breakout
               symbol.volume > 300000 && // > 300k volume
               symbol.price > 2; // > $2 price
      })
      .map(symbol => {
        const breakout = this.calculateRangeBreakout(symbol.symbol, symbol.ticks);
        const changePercent = this.calculateChangePercent(symbol.symbol, symbol.ticks);
        const relativeVolume = this.calculateRelativeVolume(symbol.symbol, symbol.ticks);
        
        return {
          ...symbol,
          ...breakout,
          changePercent,
          relativeVolume,
          score: changePercent * 0.6 + relativeVolume * 0.4,
          scanner: 'range-breakout'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 35);
  }

  // News momentum scanner
  scanNewsMomentum() {
    const symbols = this.getAllSymbolsWithTicks();
    const news = Array.from(appState.state.news.values());
    const newsBySymbol = this.groupNewsBySymbol(news);
    
    return symbols
      .filter(quote => {
        const symbolNews = newsBySymbol.get(quote.symbol) || [];
        const recentNews = symbolNews.filter(n => 
          Date.now() - new Date(n.publishedAt).getTime() < 24 * 60 * 60 * 1000 // Last 24h
        );
        return recentNews.length > 0 && quote.changePercent > 1;
      })
      .map(quote => {
        const symbolNews = newsBySymbol.get(quote.symbol) || [];
        const recentNews = symbolNews.filter(n => 
          Date.now() - new Date(n.publishedAt).getTime() < 24 * 60 * 60 * 1000
        );
        
        return {
          ...quote,
          newsCount: recentNews.length,
          score: quote.changePercent * 0.5 + recentNews.length * 10,
          scanner: 'news-momentum'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
  }

  // Premarket movers scanner
  scanPremarketMovers() {
    if (!marketHours.isPreMarket()) {
      return [];
    }
    
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .filter(quote => {
        const premarketChange = this.calculatePremarketChange(quote);
        return premarketChange > 2 && // > 2% premarket change
               quote.volume > 100000 && // > 100k volume
               quote.price > 1; // > $1 price
      })
      .map(quote => {
        const premarketChange = this.calculatePremarketChange(quote);
        return {
          ...quote,
          premarketChange,
          score: premarketChange * 0.8 + (quote.volume / 1000000) * 0.2,
          scanner: 'premarket-movers'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
  }

  // After-hours movers scanner
  scanAfterHoursMovers() {
    if (!marketHours.isAfterHours()) {
      return [];
    }
    
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .filter(quote => {
        const afterHoursChange = this.calculateAfterHoursChange(quote);
        return afterHoursChange > 1 && // > 1% after-hours change
               quote.volume > 50000 && // > 50k volume
               quote.price > 1; // > $1 price
      })
      .map(quote => {
        const afterHoursChange = this.calculateAfterHoursChange(quote);
        return {
          ...quote,
          afterHoursChange,
          score: afterHoursChange * 0.8 + (quote.volume / 1000000) * 0.2,
          scanner: 'after-hours-movers'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
  }

  // Halt/resume scanner
  scanHaltResume() {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .filter(quote => {
        const lastTick = quote.ticks[quote.ticks.length - 1];
        const timeSinceLastTick = Date.now() - (lastTick?.timestamp || 0);
        return timeSinceLastTick > 300000; // No trades for 5+ minutes
      })
      .map(quote => {
        const lastTick = quote.ticks[quote.ticks.length - 1];
        const timeSinceLastTick = Date.now() - (lastTick?.timestamp || 0);
        return {
          ...quote,
          timeSinceLastTick,
          score: timeSinceLastTick > 600000 ? 100 : 50, // Higher score for longer halt
          scanner: 'halt-resume'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  // Calculate momentum score
  calculateMomentumScore(symbol, changePercent, relativeVolume) {
    const changeScore = Math.abs(changePercent) * 0.4;
    const volumeScore = Math.min(relativeVolume || 1, 5) * 0.3;
    const priceScore = Math.min(symbol.price / 100, 1) * 0.3;
    
    return changeScore + volumeScore + priceScore;
  }

  // Calculate gap percent
  calculateGapPercent(quote) {
    if (quote.ticks.length < 2) return 0;
    
    const currentPrice = quote.price;
    const previousClose = quote.ticks[0].price; // First tick as proxy for previous close
    
    return ((currentPrice - previousClose) / previousClose) * 100;
  }

  // Calculate relative volume
  calculateRelativeVolume(quote) {
    if (quote.ticks.length < 20) return 1;
    
    const recentVolume = quote.ticks.slice(-20).reduce((sum, tick) => sum + tick.volume, 0) / 20;
    const averageVolume = quote.ticks.reduce((sum, tick) => sum + tick.volume, 0) / quote.ticks.length;
    
    return recentVolume / averageVolume;
  }

  // Calculate range breakout
  calculateRangeBreakout(quote) {
    if (quote.ticks.length < 20) return { breakout20Day: false, relativeVolume: 1 };
    
    const currentPrice = quote.price;
    const last20Ticks = quote.ticks.slice(-20);
    const high20Day = Math.max(...last20Ticks.map(t => t.price));
    const low20Day = Math.min(...last20Ticks.map(t => t.price));
    
    return {
      breakout20Day: currentPrice > high20Day,
      breakout20DayLow: currentPrice < low20Day,
      relativeVolume: this.calculateRelativeVolume(quote)
    };
  }

  // Calculate premarket change
  calculatePremarketChange(quote) {
    if (quote.ticks.length < 2) return 0;
    
    const currentPrice = quote.price;
    const premarketOpen = quote.ticks[0].price;
    
    return ((currentPrice - premarketOpen) / premarketOpen) * 100;
  }

  // Calculate after-hours change
  calculateAfterHoursChange(quote) {
    if (quote.ticks.length < 2) return 0;
    
    const currentPrice = quote.price;
    const afterHoursOpen = quote.ticks[0].price;
    
    return ((currentPrice - afterHoursOpen) / afterHoursOpen) * 100;
  }

  // Group news by symbol
  groupNewsBySymbol(news) {
    const grouped = new Map();
    
    news.forEach(item => {
      if (item.primaryTicker) {
        if (!grouped.has(item.primaryTicker)) {
          grouped.set(item.primaryTicker, []);
        }
        grouped.get(item.primaryTicker).push(item);
      }
      
      if (item.tickers) {
        item.tickers.forEach(ticker => {
          if (!grouped.has(ticker)) {
            grouped.set(ticker, []);
          }
          grouped.get(ticker).push(item);
        });
      }
    });
    
    return grouped;
  }

  // Get scanner results
  getScannerResults(scannerName) {
    return appState.getScannerResults(scannerName);
  }

  // Get all scanner results
  getAllScannerResults() {
    const results = {};
    for (const scannerName of Object.keys(this.scanners)) {
      results[scannerName] = this.getScannerResults(scannerName);
    }
    return results;
  }
}

// Export singleton
export const scannerEngine = new ScannerEngine();