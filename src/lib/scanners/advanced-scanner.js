// Advanced scanner with sophisticated technical analysis and pattern recognition
import { appState } from '../../state/store.js';
import { marketHours } from '../time/marketHours.js';

class AdvancedScanner {
  constructor() {
    this.lastUpdate = 0;
    this.updateInterval = 2 * 60 * 1000; // 2 minutes
  }

  // Get all symbols with live tick data
  getAllSymbolsWithTicks() {
    return appState.getAllSymbolsWithTicks();
  }

  // Advanced technical indicators
  calculateRSI(ticks, period = 14) {
    if (ticks.length < period + 1) return 50;
    
    const prices = ticks.map(t => t.price);
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(ticks, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (ticks.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };
    
    const prices = ticks.map(t => t.price);
    const ema12 = this.calculateEMA(prices, fastPeriod);
    const ema26 = this.calculateEMA(prices, slowPeriod);
    
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([macd], signalPeriod);
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  calculateEMA(prices, period) {
    if (prices.length === 0) return 0;
    if (prices.length === 1) return prices[0];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  calculateBollingerBands(ticks, period = 20, stdDev = 2) {
    if (ticks.length < period) return { upper: 0, middle: 0, lower: 0, width: 0 };
    
    const prices = ticks.map(t => t.price);
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((a, b) => a + b, 0) / period;
    
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    const upper = sma + (stdDev * std);
    const lower = sma - (stdDev * std);
    const width = (upper - lower) / sma;
    
    return { upper, middle: sma, lower, width };
  }

  calculateVolumeProfile(ticks) {
    if (ticks.length < 10) return { vwap: 0, volumeWeightedPrice: 0 };
    
    let totalVolume = 0;
    let volumePriceSum = 0;
    
    for (const tick of ticks) {
      totalVolume += tick.volume;
      volumePriceSum += tick.price * tick.volume;
    }
    
    const vwap = totalVolume > 0 ? volumePriceSum / totalVolume : 0;
    const currentPrice = ticks[ticks.length - 1].price;
    const vwapDeviation = ((currentPrice - vwap) / vwap) * 100;
    
    return { vwap, volumeWeightedPrice: vwap, vwapDeviation };
  }

  calculateMomentum(ticks, period = 10) {
    if (ticks.length < period) return 0;
    
    const currentPrice = ticks[ticks.length - 1].price;
    const pastPrice = ticks[ticks.length - period].price;
    
    return ((currentPrice - pastPrice) / pastPrice) * 100;
  }

  calculateVolatility(ticks, period = 20) {
    if (ticks.length < period) return 0;
    
    const prices = ticks.slice(-period).map(t => t.price);
    const returns = [];
    
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * 100; // Annualized volatility
  }

  // Advanced pattern recognition
  detectBreakout(ticks, period = 20) {
    if (ticks.length < period) return { isBreakout: false, strength: 0 };
    
    const prices = ticks.map(t => t.price);
    const recentPrices = prices.slice(-period);
    const currentPrice = prices[prices.length - 1];
    
    const resistance = Math.max(...recentPrices);
    const support = Math.min(...recentPrices);
    const range = resistance - support;
    
    const breakoutAbove = currentPrice > resistance;
    const breakoutBelow = currentPrice < support;
    const strength = range > 0 ? Math.abs(currentPrice - (breakoutAbove ? resistance : support)) / range : 0;
    
    return {
      isBreakout: breakoutAbove || breakoutBelow,
      strength,
      direction: breakoutAbove ? 'up' : breakoutBelow ? 'down' : 'none',
      resistance,
      support
    };
  }

  detectGap(ticks) {
    if (ticks.length < 2) return { isGap: false, gapPercent: 0 };
    
    const firstTick = ticks[0];
    const secondTick = ticks[1];
    
    // Simple gap detection - in real implementation, you'd compare with previous close
    const gapPercent = ((secondTick.price - firstTick.price) / firstTick.price) * 100;
    const isGap = Math.abs(gapPercent) > 2; // 2% threshold
    
    return { isGap, gapPercent, direction: gapPercent > 0 ? 'up' : 'down' };
  }

  detectVolumeSpike(ticks, period = 20) {
    if (ticks.length < period) return { isSpike: false, spikeRatio: 1 };
    
    const recentVolume = ticks.slice(-5).reduce((sum, tick) => sum + tick.volume, 0) / 5;
    const averageVolume = ticks.slice(-period).reduce((sum, tick) => sum + tick.volume, 0) / period;
    
    const spikeRatio = averageVolume > 0 ? recentVolume / averageVolume : 1;
    const isSpike = spikeRatio > 2; // 2x average volume
    
    return { isSpike, spikeRatio };
  }

  // Advanced scoring system
  calculateAdvancedScore(symbol, ticks) {
    const rsi = this.calculateRSI(ticks);
    const macd = this.calculateMACD(ticks);
    const bb = this.calculateBollingerBands(ticks);
    const vp = this.calculateVolumeProfile(ticks);
    const momentum = this.calculateMomentum(ticks);
    const volatility = this.calculateVolatility(ticks);
    const breakout = this.detectBreakout(ticks);
    const gap = this.detectGap(ticks);
    const volumeSpike = this.detectVolumeSpike(ticks);
    
    let score = 0;
    
    // RSI scoring (30-70 range is good)
    if (rsi > 30 && rsi < 70) score += 20;
    else if (rsi > 20 && rsi < 80) score += 10;
    
    // MACD scoring
    if (macd.macd > macd.signal) score += 15;
    if (macd.histogram > 0) score += 10;
    
    // Bollinger Bands scoring
    if (bb.width > 0.1) score += 10; // High volatility
    if (symbol.price > bb.upper) score += 15; // Above upper band
    if (symbol.price < bb.lower) score += 15; // Below lower band
    
    // Volume profile scoring
    if (Math.abs(vp.vwapDeviation) > 2) score += 15;
    
    // Momentum scoring
    if (Math.abs(momentum) > 5) score += 20;
    else if (Math.abs(momentum) > 2) score += 10;
    
    // Breakout scoring
    if (breakout.isBreakout) score += 25;
    if (breakout.strength > 0.5) score += 15;
    
    // Gap scoring
    if (gap.isGap) score += 20;
    if (Math.abs(gap.gapPercent) > 5) score += 15;
    
    // Volume spike scoring
    if (volumeSpike.isSpike) score += 20;
    if (volumeSpike.spikeRatio > 3) score += 15;
    
    return Math.min(score, 100); // Cap at 100
  }

  // Advanced scanners
  async scanMomentumBreakouts(limit = 1000) {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .map(symbol => {
        const ticks = symbol.ticks || [];
        const breakout = this.detectBreakout(ticks);
        const momentum = this.calculateMomentum(ticks);
        const rsi = this.calculateRSI(ticks);
        const volumeSpike = this.detectVolumeSpike(ticks);
        
        return {
          ...symbol,
          breakout,
          momentum,
          rsi,
          volumeSpike,
          score: this.calculateAdvancedScore(symbol, ticks),
          scanner: 'momentum-breakouts'
        };
      })
      .filter(symbol => 
        symbol.breakout.isBreakout && 
        Math.abs(symbol.momentum) > 3 && 
        symbol.volumeSpike.isSpike
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async scanGapAndGo(limit = 1000) {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .map(symbol => {
        const ticks = symbol.ticks || [];
        const gap = this.detectGap(ticks);
        const volumeSpike = this.detectVolumeSpike(ticks);
        const rsi = this.calculateRSI(ticks);
        const bb = this.calculateBollingerBands(ticks);
        
        return {
          ...symbol,
          gap,
          volumeSpike,
          rsi,
          bollingerBands: bb,
          score: this.calculateAdvancedScore(symbol, ticks),
          scanner: 'gap-and-go'
        };
      })
      .filter(symbol => 
        symbol.gap.isGap && 
        symbol.gap.gapPercent > 3 && 
        symbol.volumeSpike.spikeRatio > 2 &&
        symbol.rsi < 80
      )
      .sort((a, b) => b.gap.gapPercent - a.gap.gapPercent)
      .slice(0, limit);
  }

  async scanVolumeSurge(limit = 1000) {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .map(symbol => {
        const ticks = symbol.ticks || [];
        const volumeSpike = this.detectVolumeSpike(ticks);
        const vp = this.calculateVolumeProfile(ticks);
        const momentum = this.calculateMomentum(ticks);
        const volatility = this.calculateVolatility(ticks);
        
        return {
          ...symbol,
          volumeSpike,
          volumeProfile: vp,
          momentum,
          volatility,
          score: this.calculateAdvancedScore(symbol, ticks),
          scanner: 'volume-surge'
        };
      })
      .filter(symbol => 
        symbol.volumeSpike.isSpike && 
        symbol.volumeSpike.spikeRatio > 3 &&
        Math.abs(symbol.momentum) > 2
      )
      .sort((a, b) => b.volumeSpike.spikeRatio - a.volumeSpike.spikeRatio)
      .slice(0, limit);
  }

  async scanTechnicalPatterns(limit = 1000) {
    const symbols = this.getAllSymbolsWithTicks();
    
    return symbols
      .map(symbol => {
        const ticks = symbol.ticks || [];
        const rsi = this.calculateRSI(ticks);
        const macd = this.calculateMACD(ticks);
        const bb = this.calculateBollingerBands(ticks);
        const breakout = this.detectBreakout(ticks);
        
        return {
          ...symbol,
          rsi,
          macd,
          bollingerBands: bb,
          breakout,
          score: this.calculateAdvancedScore(symbol, ticks),
          scanner: 'technical-patterns'
        };
      })
      .filter(symbol => 
        (symbol.rsi < 30 || symbol.rsi > 70) && // Oversold or overbought
        symbol.breakout.isBreakout &&
        symbol.bollingerBands.width > 0.1
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async scanAfterHoursMovers(limit = 1000) {
    const symbols = this.getAllSymbolsWithTicks();
    const isAfterHours = marketHours.isAfterHours();
    
    return symbols
      .map(symbol => {
        const ticks = symbol.ticks || [];
        const changePercent = this.calculateChangePercent(ticks);
        const volumeSpike = this.detectVolumeSpike(ticks);
        const momentum = this.calculateMomentum(ticks);
        
        return {
          ...symbol,
          changePercent,
          volumeSpike,
          momentum,
          score: this.calculateAdvancedScore(symbol, ticks),
          scanner: 'after-hours-movers'
        };
      })
      .filter(symbol => 
        Math.abs(symbol.changePercent) > 2 && 
        symbol.volumeSpike.isSpike &&
        Math.abs(symbol.momentum) > 3
      )
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, limit);
  }

  // Get all advanced scanner results
  async getAllAdvancedScannerResults() {
    const [momentumBreakouts, gapAndGo, volumeSurge, technicalPatterns, afterHoursMovers] = await Promise.all([
      this.scanMomentumBreakouts(500),
      this.scanGapAndGo(500),
      this.scanVolumeSurge(500),
      this.scanTechnicalPatterns(500),
      this.scanAfterHoursMovers(500)
    ]);

    return {
      'momentum-breakouts': momentumBreakouts,
      'gap-and-go': gapAndGo,
      'volume-surge': volumeSurge,
      'technical-patterns': technicalPatterns,
      'after-hours-movers': afterHoursMovers
    };
  }

  // Helper method for change percent calculation
  calculateChangePercent(ticks) {
    if (ticks.length < 2) return 0;
    
    const firstTick = ticks[0];
    const lastTick = ticks[ticks.length - 1];
    
    return ((lastTick.price - firstTick.price) / firstTick.price) * 100;
  }
}

export const advancedScanner = new AdvancedScanner();
