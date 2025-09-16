// Conservative scanner that starts with a small set of popular stocks
import { providerQueue } from '../../lib/provider-queue.js';
import { sharedCache } from '../../lib/shared-cache.js';

class ConservativeScanner {
  constructor() {
    this.popularStocks = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD',
      'INTC', 'CRM', 'ADBE', 'PYPL', 'ORCL', 'CSCO', 'IBM', 'QCOM', 'TXN', 'AVGO',
      'AMAT', 'MU', 'ADI', 'LRCX', 'KLAC', 'MCHP', 'SNPS', 'CDNS', 'MRVL', 'SWKS',
      'SPOT', 'UBER', 'LYFT', 'SQ', 'ROKU', 'ZM', 'PTON', 'DOCU', 'SNOW', 'PLTR',
      'CRWD', 'OKTA', 'ZS', 'NET', 'DDOG', 'MDB', 'TWLO', 'ESTC', 'WDAY', 'NOW'
    ];
    
    this.lastUpdate = 0;
    this.updateInterval = 2 * 60 * 1000; // 2 minutes
    this.cachedResults = null;
  }

  // Get quotes for popular stocks
  async getPopularStocksQuotes() {
    try {
      console.log('Fetching quotes for popular stocks...');
      const quotes = await providerQueue.getQuotes(this.popularStocks);
      return quotes || [];
    } catch (error) {
      console.error('Error fetching popular stocks quotes:', error);
      return [];
    }
  }

  // Calculate metrics for a stock
  calculateMetrics(quote) {
    if (!quote || !quote.symbol) return null;

    const changePercent = quote.changePercent || 0;
    const volume = quote.volume || 0;
    const price = quote.price || 0;
    const marketCap = quote.marketCap || 0;

    // Calculate relative volume (simplified)
    const avgVolume = quote.avgVolume || volume;
    const relativeVolume = avgVolume > 0 ? volume / avgVolume : 1;

    // Calculate momentum score
    const momentumScore = this.calculateMomentumScore(changePercent, relativeVolume, volume, price);

    return {
      symbol: quote.symbol,
      name: quote.name || quote.symbol,
      price: price,
      change: quote.change || 0,
      changePercent: changePercent,
      volume: volume,
      avgVolume: avgVolume,
      relativeVolume: relativeVolume,
      marketCap: marketCap,
      exchange: quote.exchange || 'NASDAQ',
      sector: quote.sector || 'Technology',
      industry: quote.industry || 'Software',
      momentumScore: momentumScore,
      timestamp: Date.now()
    };
  }

  // Calculate momentum score
  calculateMomentumScore(changePercent, relativeVolume, volume, price) {
    const changeScore = Math.abs(changePercent) * 0.4;
    const volumeScore = Math.min(relativeVolume, 5) * 0.3;
    const priceScore = Math.min(price / 100, 1) * 0.2;
    const volumeMagnitudeScore = Math.min(Math.log10(volume + 1) / 6, 1) * 0.1;
    
    return changeScore + volumeScore + priceScore + volumeMagnitudeScore;
  }

  // Get high momentum stocks
  async getHighMomentumStocks(limit = 50) {
    try {
      // For now, just return fallback stocks to avoid API issues
      console.log('Using fallback stocks for high momentum scanner');
      return this.getFallbackStocks();
      
      // TODO: Re-enable API calls once provider issues are resolved
      /*
      const quotes = await this.getPopularStocksQuotes();
      if (quotes.length === 0) {
        return this.getFallbackStocks();
      }

      const results = quotes
        .map(quote => this.calculateMetrics(quote))
        .filter(stock => stock !== null)
        .filter(stock => 
          stock.changePercent > 1 && // > 1% change
          stock.relativeVolume > 1.2 && // > 20% above average volume
          stock.volume > 100000 && // > 100k volume
          stock.price > 5 // > $5 price
        )
        .sort((a, b) => b.momentumScore - a.momentumScore)
        .slice(0, limit);

      console.log(`High momentum scanner: Found ${results.length} stocks`);
      return results;
      */

    } catch (error) {
      console.error('High momentum scanner error:', error);
      return this.getFallbackStocks();
    }
  }

  // Get gap up stocks
  async getGapUpStocks(limit = 50) {
    try {
      // For now, just return fallback stocks to avoid API issues
      console.log('Using fallback stocks for gap up scanner');
      return this.getFallbackStocks();
    } catch (error) {
      console.error('Gap up scanner error:', error);
      return this.getFallbackStocks();
    }
  }

  // Get unusual volume stocks
  async getUnusualVolumeStocks(limit = 50) {
    try {
      // For now, just return fallback stocks to avoid API issues
      console.log('Using fallback stocks for unusual volume scanner');
      return this.getFallbackStocks();
    } catch (error) {
      console.error('Unusual volume scanner error:', error);
      return this.getFallbackStocks();
    }
  }

  // Fallback stocks when everything fails
  getFallbackStocks() {
    const fallbackStocks = [
      { symbol: 'AAPL', name: 'Apple Inc.', price: 150.25, change: 2.5, changePercent: 1.69, volume: 1000000, relativeVolume: 1.2, marketCap: 2500000000000, exchange: 'NASDAQ', sector: 'Technology', industry: 'Consumer Electronics', momentumScore: 0.85 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', price: 300.15, change: -1.2, changePercent: -0.4, volume: 800000, relativeVolume: 0.9, marketCap: 2200000000000, exchange: 'NASDAQ', sector: 'Technology', industry: 'Software', momentumScore: 0.65 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 2800.50, change: 15.75, changePercent: 0.57, volume: 500000, relativeVolume: 1.1, marketCap: 1800000000000, exchange: 'NASDAQ', sector: 'Technology', industry: 'Internet', momentumScore: 0.75 },
      { symbol: 'TSLA', name: 'Tesla Inc.', price: 250.80, change: 8.30, changePercent: 3.42, volume: 2000000, relativeVolume: 2.1, marketCap: 800000000000, exchange: 'NASDAQ', sector: 'Consumer Discretionary', industry: 'Auto Manufacturers', momentumScore: 0.95 },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 450.25, change: 12.50, changePercent: 2.85, volume: 1500000, relativeVolume: 1.8, marketCap: 1100000000000, exchange: 'NASDAQ', sector: 'Technology', industry: 'Semiconductors', momentumScore: 0.90 }
    ];
    
    console.log('Using fallback stocks:', fallbackStocks.length);
    return fallbackStocks;
  }
}

export const conservativeScanner = new ConservativeScanner();
