// Live Scanner API - Real Financial Data from Multiple Providers
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { providerQueue } from '../lib/provider-queue.js';
import { sharedCache } from '../lib/shared-cache.js';
import { comprehensiveSymbolMaster } from '../lib/comprehensive-symbol-master.js';
import { scannerEngine } from '../src/lib/scanners/run.js';

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

// Fetch quotes from providers with failover
async function fetchQuotesFromProviders(symbols) {
  const quotes = [];
  const errors = [];
  
  // Try FMP first
  try {
    if (providerQueue.canMakeRequest('fmp')) {
      const fmpQuotes = await fetchFMPQuotes(symbols);
      quotes.push(...fmpQuotes);
      providerQueue.handleResponse('fmp', true);
      console.log(`FMP: ${fmpQuotes.length} quotes`);
    }
  } catch (error) {
    providerQueue.handleResponse('fmp', false, error);
    errors.push(`FMP: ${error.message}`);
  }
  
  // Try Finnhub if we need more quotes
  if (quotes.length < symbols.length * 0.5) {
    try {
      if (providerQueue.canMakeRequest('finnhub')) {
        const finnhubQuotes = await fetchFinnhubQuotes(symbols);
        quotes.push(...finnhubQuotes);
        providerQueue.handleResponse('finnhub', true);
        console.log(`Finnhub: ${finnhubQuotes.length} quotes`);
      }
    } catch (error) {
      providerQueue.handleResponse('finnhub', false, error);
      errors.push(`Finnhub: ${error.message}`);
    }
  }
  
  // Try AlphaVantage as last resort
  if (quotes.length < symbols.length * 0.3) {
    try {
      if (providerQueue.canMakeRequest('alphavantage')) {
        const avQuotes = await fetchAlphaVantageQuotes(symbols.slice(0, 5)); // Very limited
        quotes.push(...avQuotes);
        providerQueue.handleResponse('alphavantage', true);
        console.log(`AlphaVantage: ${avQuotes.length} quotes`);
      }
    } catch (error) {
      providerQueue.handleResponse('alphavantage', false, error);
      errors.push(`AlphaVantage: ${error.message}`);
    }
  }
  
  if (quotes.length === 0 && errors.length > 0) {
    throw new Error(`All providers failed: ${errors.join(', ')}`);
  }
  
  return quotes;
}

// Fetch quotes from FMP
async function fetchFMPQuotes(symbols) {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) throw new Error('FMP_KEY not configured');
  
  const symbolList = symbols.join(',');
  const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${symbolList}?apikey=${apiKey}`, {
    cache: 'no-store',
    timeout: 10000
  });
  
  if (!response.ok) {
    throw new Error(`FMP API error: ${response.status}`);
  }
  
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  
  return data.map(item => ({
    symbol: item.symbol,
    name: item.name,
    price: item.price,
    change: item.change,
    changePercent: item.changesPercentage,
    volume: item.volume,
    averageDailyVolume3Month: item.avgVolume
  }));
}

// Fetch quotes from Finnhub
async function fetchFinnhubQuotes(symbols) {
  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) throw new Error('FINNHUB_KEY not configured');
  
  const quotes = [];
  
  for (const symbol of symbols.slice(0, 100)) { // Limit for rate limits
    try {
      const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`, {
        cache: 'no-store',
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.c && data.c > 0) {
          quotes.push({
            symbol: symbol,
            name: symbol,
            price: data.c,
            change: data.d || 0,
            changePercent: data.dp || 0,
            volume: data.v || 0,
            averageDailyVolume3Month: data.v || 0
          });
        }
      }
      
      // Rate limiting protection
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.warn(`Finnhub quote failed for ${symbol}:`, error.message);
    }
  }
  
  return quotes;
}

// Fetch quotes from AlphaVantage
async function fetchAlphaVantageQuotes(symbols) {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) throw new Error('ALPHAVANTAGE_KEY not configured');
  
  const quotes = [];
  
  for (const symbol of symbols) {
    try {
      const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`, {
        cache: 'no-store',
        timeout: 15000
      });
      
      if (response.ok) {
        const data = await response.json();
        const quote = data['Global Quote'];
        if (quote && quote['05. price']) {
          quotes.push({
            symbol: symbol,
            name: symbol,
            price: parseFloat(quote['05. price']),
            change: parseFloat(quote['09. change']),
            changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
            volume: parseInt(quote['06. volume']),
            averageDailyVolume3Month: parseInt(quote['06. volume'])
          });
        }
      }
      
      // AlphaVantage rate limiting
      await new Promise(resolve => setTimeout(resolve, 12000));
    } catch (error) {
      console.warn(`AlphaVantage quote failed for ${symbol}:`, error.message);
    }
  }
  
  return quotes;
}

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
    
    // Process symbols in batches with progressive results
    const batchSize = 200; // Larger batches for better performance
    const allQuotes = [];
    const errors = [];
    let providerStatus = 'offline';
    let processedBatches = 0;
    const maxBatches = Math.min(Math.ceil(symbols.length / batchSize), 5); // Process up to 5 batches (1000 symbols)
    
    for (let i = 0; i < Math.min(symbols.length, maxBatches * batchSize); i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      processedBatches++;
      
      try {
        // Check cache first
        const cachedQuotes = sharedCache.getQuotesBatch(batch);
        if (cachedQuotes.length > 0) {
          allQuotes.push(...cachedQuotes);
          console.log(`Using ${cachedQuotes.length} cached quotes for batch ${processedBatches}/${maxBatches}`);
        } else {
          // Fetch from providers
          const quotes = await fetchQuotesFromProviders(batch);
          allQuotes.push(...quotes);
          
          // Cache the quotes
          sharedCache.setQuotesBatch(quotes);
          console.log(`Fetched ${quotes.length} quotes for batch ${processedBatches}/${maxBatches}`);
        }
        
        // Rate limiting protection
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`Batch ${processedBatches}/${maxBatches} failed:`, error.message);
        errors.push(`Batch ${processedBatches}: ${error.message}`);
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
    
    // Use the new tick-based scanner engine
    const result = await scannerEngine.runAllScanners();
    const stocks = result[preset] || [];
    
    console.log(`Tick-based scanner returned ${stocks.length} stocks for preset ${preset}`);
    
    // Comprehensive logging for observability
    console.log(`scanner_results=${stocks.length} preset=${preset} tick_based=true`);

    // If no stocks, show partial results or error state
    if (stocks.length === 0) {
      if (result.providerStatus === 'offline') {
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
      } else {
        // Providers are working but no stocks match filters - show message
        return res.status(200).json({
          success: true,
          data: {
            refreshInterval: 30000,
            stocks: [{
              symbol: 'NO_MATCH',
              name: 'No stocks match current filters',
              price: 0,
              change: 0,
              changePercent: 0,
              volume: 0,
              avgVolume: 0,
              relativeVolume: 0,
              gapPercent: 0,
              exchange: 'INFO',
              sector: 'System',
              industry: 'Info',
              marketCap: 0,
              lastUpdate: new Date().toISOString(),
              isInfo: true,
              infoMessage: 'Try broadening your filters to see more results'
            }],
            totalProcessed: result.totalProcessed,
            universeSize: result.universeSize,
            preset: result.preset,
            filters: result.filters,
            providerStatus: result.providerStatus,
            lastUpdate: new Date().toISOString(),
            errors: result.errors || []
          }
        });
      }
    }

    return res.status(200).json({ 
      success: true, 
      data: { 
        refreshInterval: 30000,
        stocks: stocks.slice(0, parseInt(limit)), 
        totalProcessed: stocks.length,
        universeSize: stocks.length,
        preset: preset,
        filters: filters,
        providerStatus: 'live',
        lastUpdate: new Date().toISOString(),
        errors: []
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
