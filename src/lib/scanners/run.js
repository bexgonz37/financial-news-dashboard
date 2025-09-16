// Pure scanner functions over snapshot data
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
    const quotes = Array.from(appState.state.quotes.values());
    const news = Array.from(appState.state.news.values());
    
    const results = {};
    
    for (const [name, scanner] of Object.entries(this.scanners)) {
      try {
        results[name] = await scanner(quotes, news);
      } catch (error) {
        console.error(`Scanner ${name} failed:`, error);
        results[name] = [];
      }
    }
    
    return results;
  }

  // High momentum scanner
  scanHighMomentum(quotes, news) {
    return quotes
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
  scanGapUp(quotes, news) {
    return quotes
      .filter(quote => 
        quote.gapPercent > 5 && // > 5% gap up
        quote.volume > 200000 && // > 200k volume
        quote.price > 2 // > $2 price
      )
      .map(quote => ({
        ...quote,
        score: quote.gapPercent * 0.7 + (quote.volume / 1000000) * 0.3,
        scanner: 'gap-up'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }

  // Gap down scanner
  scanGapDown(quotes, news) {
    return quotes
      .filter(quote => 
        quote.gapPercent < -5 && // > 5% gap down
        quote.volume > 200000 && // > 200k volume
        quote.price > 2 // > $2 price
      )
      .map(quote => ({
        ...quote,
        score: Math.abs(quote.gapPercent) * 0.7 + (quote.volume / 1000000) * 0.3,
        scanner: 'gap-down'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }

  // Unusual volume scanner
  scanUnusualVolume(quotes, news) {
    return quotes
      .filter(quote => 
        quote.relativeVolume > 2 && // > 2x average volume
        quote.volume > 500000 && // > 500k volume
        quote.price > 1 // > $1 price
      )
      .map(quote => ({
        ...quote,
        score: quote.relativeVolume * 0.8 + (quote.volume / 1000000) * 0.2,
        scanner: 'unusual-volume'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
  }

  // Range breakout scanner
  scanRangeBreakout(quotes, news) {
    return quotes
      .filter(quote => 
        quote.breakout20Day && // 20-day high breakout
        quote.volume > 300000 && // > 300k volume
        quote.price > 2 // > $2 price
      )
      .map(quote => ({
        ...quote,
        score: quote.changePercent * 0.6 + quote.relativeVolume * 0.4,
        scanner: 'range-breakout'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 35);
  }

  // News momentum scanner
  scanNewsMomentum(quotes, news) {
    const newsBySymbol = this.groupNewsBySymbol(news);
    
    return quotes
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
  scanPremarketMovers(quotes, news) {
    if (!marketHours.isPreMarket()) {
      return [];
    }
    
    return quotes
      .filter(quote => 
        quote.premarketChange > 2 && // > 2% premarket change
        quote.volume > 100000 && // > 100k volume
        quote.price > 1 // > $1 price
      )
      .map(quote => ({
        ...quote,
        score: quote.premarketChange * 0.8 + (quote.volume / 1000000) * 0.2,
        scanner: 'premarket-movers'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
  }

  // After-hours movers scanner
  scanAfterHoursMovers(quotes, news) {
    if (!marketHours.isAfterHours()) {
      return [];
    }
    
    return quotes
      .filter(quote => 
        quote.afterHoursChange > 1 && // > 1% after-hours change
        quote.volume > 50000 && // > 50k volume
        quote.price > 1 // > $1 price
      )
      .map(quote => ({
        ...quote,
        score: quote.afterHoursChange * 0.8 + (quote.volume / 1000000) * 0.2,
        scanner: 'after-hours-movers'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
  }

  // Halt/resume scanner
  scanHaltResume(quotes, news) {
    return quotes
      .filter(quote => 
        quote.isHalted || quote.isResumed || // Halt/resume flags
        quote.lastTradeTime && (Date.now() - quote.lastTradeTime) > 300000 // No trades for 5+ minutes
      )
      .map(quote => ({
        ...quote,
        score: quote.isHalted ? 100 : quote.isResumed ? 90 : 50,
        scanner: 'halt-resume'
      }))
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
