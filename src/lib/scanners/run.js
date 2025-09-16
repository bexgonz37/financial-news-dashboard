// Enhanced scanner engine consuming live tick buffers
import { appState } from '../../state/store.js';
import { marketHours } from '../time/marketHours.js';

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
    
    for (const [name, scanner] of Object.entries(this.scanners)) {
      try {
        results[name] = await scanner();
      } catch (error) {
        console.error(`Scanner ${name} failed:`, error);
        results[name] = [];
      }
    }
    
    return results;
  }

  // Get all symbols with tick data
  getAllSymbolsWithTicks() {
    const symbols = [];
    const state = appState.state;
    
    for (const [symbol, ticks] of state.ticks) {
      if (ticks.length > 0) {
        const latestTick = ticks[ticks.length - 1];
        const quote = state.quotes.get(symbol);
        
        if (quote) {
          symbols.push({
            symbol,
            price: latestTick.price,
            change: quote.change || 0,
            changePercent: quote.changePercent || 0,
            volume: latestTick.volume,
            timestamp: latestTick.timestamp,
            ticks: ticks.slice(-100) // Last 100 ticks for analysis
          });
        }
      }
    }
    
    return symbols;
  }

  // High momentum scanner
  scanHighMomentum() {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .filter(quote => 
        quote.changePercent > 2 && // > 2% change
        quote.volume > 100000 && // > 100k volume
        quote.price > 1 // > $1 price
      )
      .map(quote => ({
        ...quote,
        score: this.calculateMomentumScore(quote),
        scanner: 'high-momentum'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }

  // Gap up scanner
  scanGapUp() {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .filter(quote => {
        const gapPercent = this.calculateGapPercent(quote);
        return gapPercent > 5 && // > 5% gap up
               quote.volume > 200000 && // > 200k volume
               quote.price > 2; // > $2 price
      })
      .map(quote => {
        const gapPercent = this.calculateGapPercent(quote);
        return {
          ...quote,
          gapPercent,
          score: gapPercent * 0.7 + (quote.volume / 1000000) * 0.3,
          scanner: 'gap-up'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
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
  scanUnusualVolume() {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .filter(quote => {
        const relativeVolume = this.calculateRelativeVolume(quote);
        return relativeVolume > 2 && // > 2x average volume
               quote.volume > 500000 && // > 500k volume
               quote.price > 1; // > $1 price
      })
      .map(quote => {
        const relativeVolume = this.calculateRelativeVolume(quote);
        return {
          ...quote,
          relativeVolume,
          score: relativeVolume * 0.8 + (quote.volume / 1000000) * 0.2,
          scanner: 'unusual-volume'
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
  }

  // Range breakout scanner
  scanRangeBreakout() {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .filter(quote => {
        const breakout = this.calculateRangeBreakout(quote);
        return breakout.breakout20Day && // 20-day high breakout
               quote.volume > 300000 && // > 300k volume
               quote.price > 2; // > $2 price
      })
      .map(quote => {
        const breakout = this.calculateRangeBreakout(quote);
        return {
          ...quote,
          ...breakout,
          score: quote.changePercent * 0.6 + breakout.relativeVolume * 0.4,
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
  calculateMomentumScore(quote) {
    const changeScore = Math.abs(quote.changePercent) * 0.4;
    const volumeScore = Math.min(quote.relativeVolume || 1, 5) * 0.3;
    const priceScore = Math.min(quote.price / 100, 1) * 0.3;
    
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