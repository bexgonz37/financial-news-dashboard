// Live Scanner API - Real Financial Data from Multiple Providers
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { unifiedProviderManager } from '../lib/unified-provider-manager.js';
import { comprehensiveSymbolMaster } from '../lib/comprehensive-symbol-master.js';

// Scanner presets - BROAD FILTERS for maximum coverage
const SCANNER_PRESETS = {
  'high-momentum': {
    name: 'High Momentum',
    description: 'Stocks with strong price momentum and volume',
    filters: {
      minChangePercent: 0.5, // Very broad
      minRelativeVolume: 1.0, // Very broad
      minPrice: 0.5 // Very broad
    }
  },
  'breakouts': {
    name: 'Breakouts',
    description: 'Stocks breaking out of consolidation patterns',
    filters: {
      minChangePercent: 1.0, // Broad
      minRelativeVolume: 1.0, // Broad
      minPrice: 0.5 // Broad
    }
  },
  'gap-go': {
    name: 'Gap & Go',
    description: 'Stocks with significant gaps and early volume',
    filters: {
      minGapPercent: 2.0, // Broad
      minRelativeVolume: 1.0, // Broad
      minPrice: 0.5 // Broad
    }
  },
  'reversal': {
    name: 'Reversal Watch',
    description: 'Stocks showing potential reversal patterns',
    filters: {
      maxChangePercent: -0.5, // Broad
      minRelativeVolume: 1.0, // Broad
      minPrice: 0.5 // Broad
    }
  },
  'news-movers': {
    name: 'News Movers',
    description: 'Stocks with recent news and price reaction',
    filters: {
      minChangePercent: 0.1, // Very broad
      minRelativeVolume: 1.0, // Broad
      minPrice: 0.5 // Broad
    }
  },
  'all-movers': {
    name: 'All Movers',
    description: 'All stocks with any price movement',
    filters: {
      minChangePercent: 0.01, // Extremely broad
      minRelativeVolume: 0.5, // Very broad
      minPrice: 0.1 // Very broad
    }
  }
};

// Main scanner function
async function scanStocks(preset = 'high-momentum', limit = 100, customFilters = {}) {
  try {
    console.log(`🔍 Starting ${preset} scan with limit ${limit}`);
    
    // Get preset configuration
    const presetConfig = SCANNER_PRESETS[preset] || SCANNER_PRESETS['high-momentum'];
    const filters = { ...presetConfig.filters, ...customFilters };
    
    // Get all active symbols
    const allSymbols = comprehensiveSymbolMaster.getAllActiveSymbols();
    const symbols = allSymbols.map(s => s.symbol);
    
    console.log(`📊 Scanner universe size: ${symbols.length} symbols`);
    
    // Process symbols in batches to avoid rate limits
    const batchSize = 50;
    const allQuotes = [];
    const errors = [];
    let providerStatus = 'offline';
    
    for (let i = 0; i < Math.min(symbols.length, 1000); i += batchSize) { // Limit to 1000 for performance
      const batch = symbols.slice(i, i + batchSize);
      
      try {
        const quotes = await unifiedProviderManager.getQuotes(batch);
        allQuotes.push(...quotes);
        
        // Rate limiting protection
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.warn(`Batch ${i}-${i + batchSize} failed:`, error.message);
        errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`);
      }
    }
    
    // Determine provider status
    if (allQuotes.length > 0) {
      providerStatus = errors.length > 0 ? 'degraded' : 'healthy';
    } else if (errors.length > 0) {
      providerStatus = 'degraded';
    } else {
      providerStatus = 'offline';
    }
    
    console.log(`✅ Retrieved ${allQuotes.length} quotes, status: ${providerStatus}`);
    
    // Process quotes and calculate metrics
    const processedStocks = [];
    
    for (const quote of allQuotes) {
      try {
        const symbol = comprehensiveSymbolMaster.getSymbol(quote.symbol);
        if (!symbol) continue;
        
        // Calculate basic metrics
        const changePercent = quote.changePercent || 0;
        const volume = quote.volume || 0;
        const avgVolume = quote.averageDailyVolume3Month || volume;
        const relativeVolume = avgVolume > 0 ? volume / avgVolume : 1;
        
        // Calculate gap percentage (simplified)
        const gapPercent = quote.preMarketChangePercent || 0;
        
        processedStocks.push({
          symbol: quote.symbol,
          name: quote.name || symbol.companyName,
          price: quote.price,
          change: quote.change,
          changePercent,
          volume,
          avgVolume,
          relativeVolume,
          gapPercent,
          exchange: symbol.exchange,
          sector: symbol.sector,
          industry: symbol.industry,
          marketCap: symbol.marketCap,
          lastUpdate: new Date().toISOString()
        });
        
      } catch (error) {
        console.warn(`Error processing ${quote.symbol}:`, error.message);
      }
    }
    
    // Apply filters
    let filtered = processedStocks;
    
    if (filters.minPrice) {
      filtered = filtered.filter(s => s.price >= filters.minPrice);
    }
    if (filters.minChangePercent) {
      filtered = filtered.filter(s => s.changePercent >= filters.minChangePercent);
    }
    if (filters.minRelativeVolume) {
      filtered = filtered.filter(s => s.relativeVolume >= filters.minRelativeVolume);
    }
    if (filters.minGapPercent) {
      filtered = filtered.filter(s => s.gapPercent >= filters.minGapPercent);
    }
    if (filters.maxChangePercent) {
      filtered = filtered.filter(s => s.changePercent <= filters.maxChangePercent);
    }
    
    // Sort by change percent (descending)
    filtered.sort((a, b) => b.changePercent - a.changePercent);
    
    // Limit results
    const limited = filtered.slice(0, limit);
    
    return {
      stocks: limited,
      totalProcessed: processedStocks.length,
      universeSize: symbols.length,
      preset: presetConfig.name,
      filters: filters,
      providerStatus,
      errors: errors
    };
    
  } catch (error) {
    console.error('Scanner error:', error);
    return {
      stocks: [],
      totalProcessed: 0,
      universeSize: 0,
      preset: 'Error',
      filters: {},
      errors: [error.message]
    };
  }
}

// Main API handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      preset = 'high-momentum', 
      limit = 100,
      minPrice,
      exchange,
      sector
    } = req.query;

    console.log('Scanner request:', { preset, limit, minPrice, exchange, sector });

    // Use advanced scanner
    const filters = {};
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (exchange) filters.exchange = exchange;
    if (sector) filters.sector = sector;
    
    const result = await scanStocks(preset, parseInt(limit), filters);
    
    console.log(`Advanced scanner returned ${result.stocks.length} stocks from ${result.totalProcessed} processed (universe: ${result.universeSize})`);
    
    // Comprehensive logging for observability
    const rateLimited = result.errors && result.errors.some(err => err.includes('429') || err.includes('rate limit'));
    console.log(`scanner_universe=${result.universeSize} processed=${result.totalProcessed} rate_limited=${rateLimited}`);
    console.log(`scanner_results=${result.stocks.length} preset=${preset} errors=[${(result.errors || []).join(',')}]`);

    // If no stocks and providers are failing, show error state
    if (result.stocks.length === 0 && result.providerStatus === 'offline') {
      return res.status(200).json({
        success: true,
        data: {
          refreshInterval: 30000,
          stocks: [{
            symbol: 'ERROR',
            name: 'Scanner providers temporarily unavailable',
            price: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            avgVolume: 0,
            relativeVolume: 0,
            gapPercent: 0,
            exchange: 'ERROR',
            sector: 'System',
            industry: 'Error',
            marketCap: 0,
            lastUpdate: new Date().toISOString(),
            isError: true,
            errorMessage: 'All providers are offline. Retrying automatically...'
          }],
          totalProcessed: 0,
          universeSize: result.universeSize,
          preset: result.preset,
          filters: result.filters,
          providerStatus: result.providerStatus,
          lastUpdate: new Date().toISOString(),
          errors: result.errors || []
        }
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: { 
        refreshInterval: 30000,
        stocks: result.stocks, 
        totalProcessed: result.totalProcessed,
        universeSize: result.universeSize,
        preset: result.preset,
        filters: result.filters,
        providerStatus: result.providerStatus,
        lastUpdate: new Date().toISOString(),
        errors: result.errors || []
      }
    });

  } catch (error) {
    console.error('Scanner API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message,
      data: { stocks: [] }
    });
  }
}
