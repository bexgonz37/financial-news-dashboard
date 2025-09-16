// Market-wide scanner for comprehensive stock universe
import { providerQueue } from '../../lib/provider-queue.js';
import { sharedCache } from '../../lib/shared-cache.js';
import { comprehensiveSymbolMaster } from '../../lib/comprehensive-symbol-master.js';

class MarketWideScanner {
  constructor() {
    this.symbolMaster = null;
    this.lastUpdate = 0;
    this.updateInterval = 5 * 60 * 1000; // 5 minutes
    this.maxSymbolsPerBatch = 100; // API rate limits
    this.batchDelay = 1000; // 1 second between batches
  }

  // Get comprehensive stock universe
  async getStockUniverse() {
    try {
      // Get symbols from comprehensive symbol master
      const symbols = await comprehensiveSymbolMaster.getAllActiveSymbols();
      
      // Filter for tradeable stocks (exclude ETFs, mutual funds, etc.)
      const tradeableStocks = symbols.filter(symbol => {
        return symbol.type === 'Common Stock' && 
               symbol.exchange && 
               symbol.exchange !== 'OTC' &&
               symbol.price > 1 && // Minimum price filter
               symbol.marketCap > 10000000; // Minimum market cap $10M
      });

      console.log(`Market-wide scanner: Found ${tradeableStocks.length} tradeable stocks`);
      return tradeableStocks;
    } catch (error) {
      console.error('Error getting stock universe:', error);
      return [];
    }
  }

  // Fetch quotes for a batch of symbols
  async fetchQuotesBatch(symbols) {
    try {
      const quotes = await providerQueue.getQuotes(symbols);
      return quotes || [];
    } catch (error) {
      console.error('Error fetching quotes batch:', error);
      return [];
    }
  }

  // Fetch quotes for all symbols in batches
  async fetchAllQuotes(symbols) {
    const allQuotes = [];
    const batches = [];
    
    // Split symbols into batches
    for (let i = 0; i < symbols.length; i += this.maxSymbolsPerBatch) {
      batches.push(symbols.slice(i, i + this.maxSymbolsPerBatch));
    }

    console.log(`Fetching quotes for ${symbols.length} symbols in ${batches.length} batches`);

    // Process batches with delay
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} symbols)`);
      
      try {
        const quotes = await this.fetchQuotesBatch(batch);
        allQuotes.push(...quotes);
        
        // Delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.batchDelay));
        }
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
      }
    }

    return allQuotes;
  }

  // Calculate scanner metrics for a stock
  calculateMetrics(stock, quotes) {
    const quote = quotes.find(q => q.symbol === stock.symbol);
    if (!quote) return null;

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
      symbol: stock.symbol,
      name: stock.name || stock.symbol,
      price: price,
      change: quote.change || 0,
      changePercent: changePercent,
      volume: volume,
      avgVolume: avgVolume,
      relativeVolume: relativeVolume,
      marketCap: marketCap,
      exchange: stock.exchange,
      sector: stock.sector,
      industry: stock.industry,
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

  // Run comprehensive market scan
  async runMarketScan() {
    try {
      console.log('Starting comprehensive market scan...');
      
      // Get stock universe
      const stocks = await this.getStockUniverse();
      if (stocks.length === 0) {
        console.log('No stocks found in universe');
        return [];
      }

      // Fetch quotes for all stocks
      const quotes = await this.fetchAllQuotes(stocks);
      console.log(`Fetched quotes for ${quotes.length} stocks`);

      // Calculate metrics for each stock
      const results = [];
      for (const stock of stocks) {
        const metrics = this.calculateMetrics(stock, quotes);
        if (metrics) {
          results.push(metrics);
        }
      }

      console.log(`Market scan completed: ${results.length} stocks processed`);
      return results;

    } catch (error) {
      console.error('Market scan error:', error);
      return [];
    }
  }

  // Get high momentum stocks
  async getHighMomentumStocks(limit = 100) {
    const results = await this.runMarketScan();
    
    return results
      .filter(stock => 
        stock.changePercent > 1 && // > 1% change
        stock.relativeVolume > 1.2 && // > 20% above average volume
        stock.volume > 100000 && // > 100k volume
        stock.price > 5 // > $5 price
      )
      .sort((a, b) => b.momentumScore - a.momentumScore)
      .slice(0, limit);
  }

  // Get gap up stocks
  async getGapUpStocks(limit = 100) {
    const results = await this.runMarketScan();
    
    return results
      .filter(stock => 
        stock.changePercent > 5 && // > 5% gap up
        stock.volume > 200000 && // > 200k volume
        stock.price > 10 // > $10 price
      )
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit);
  }

  // Get unusual volume stocks
  async getUnusualVolumeStocks(limit = 100) {
    const results = await this.runMarketScan();
    
    return results
      .filter(stock => 
        stock.relativeVolume > 2 && // > 2x average volume
        stock.volume > 500000 && // > 500k volume
        stock.price > 5 // > $5 price
      )
      .sort((a, b) => b.relativeVolume - a.relativeVolume)
      .slice(0, limit);
  }

  // Get all scanner results
  async getAllScannerResults() {
    const [highMomentum, gapUp, unusualVolume] = await Promise.all([
      this.getHighMomentumStocks(50),
      this.getGapUpStocks(50),
      this.getUnusualVolumeStocks(50)
    ]);

    return {
      'high-momentum': highMomentum,
      'gap-up': gapUp,
      'unusual-volume': unusualVolume
    };
  }
}

export const marketWideScanner = new MarketWideScanner();
