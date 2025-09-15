// Live Scanner Stream API - Continuous server-side scanning with real-time updates
import { unifiedProviderManager } from '../lib/unified-provider-manager.js';
import { comprehensiveSymbolMaster } from '../lib/comprehensive-symbol-master.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Scanner cache and state
const scannerCache = new Map(); // preset -> { data, timestamp, lastUpdate }
const SCAN_INTERVAL = 30000; // 30 seconds
const CACHE_TTL = 60000; // 1 minute
let isScanning = false;

// Scanner presets
const SCANNER_PRESETS = {
  momentum: {
    name: 'High Momentum',
    description: 'Strong price movement with volume',
    filters: {
      minChange: 2,
      minRvol: 1.5,
      minVolume: 100000
    }
  },
  hod_lod: {
    name: 'HOD/LOD Breakouts',
    description: 'Breaking high or low of day',
    filters: {
      minChange: 1,
      minRvol: 1.2,
      minVolume: 50000
    }
  },
  unusual_volume: {
    name: 'Unusual Volume',
    description: 'High relative volume activity',
    filters: {
      minRvol: 3,
      minVolume: 200000
    }
  },
  news_movers: {
    name: 'News Driven Movers',
    description: 'Price movement with recent news',
    filters: {
      minChange: 1,
      minRvol: 1.2,
      minVolume: 100000
    }
  },
  gappers: {
    name: 'Gap & Go',
    description: 'Significant gap with volume',
    filters: {
      minGap: 3,
      minRvol: 2,
      minVolume: 150000
    }
  }
};

// Technical indicators
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };
  
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);
  const macd = emaFast - emaSlow;
  
  // Simplified signal line (would need more data for proper calculation)
  const signal = macd * 0.9; // Placeholder
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

function calculateEMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1];
  
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

function calculateATR(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return 0;
  
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  
  return trs.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
}

function calculateVWAP(highs, lows, closes, volumes) {
  if (highs.length === 0) return 0;
  
  let totalVolume = 0;
  let totalValue = 0;
  
  for (let i = 0; i < highs.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    const volume = volumes[i] || 1;
    
    totalValue += typicalPrice * volume;
    totalVolume += volume;
  }
  
  return totalVolume > 0 ? totalValue / totalVolume : 0;
}

// Calculate comprehensive metrics for a stock
function calculateStockMetrics(quote, historicalData = []) {
  const price = quote.price || 0;
  const change = quote.change || 0;
  const changePercent = quote.changePercent || 0;
  const volume = quote.volume || 0;
  const avgVolume = quote.averageDailyVolume3Month || volume;
  const relativeVolume = avgVolume > 0 ? volume / avgVolume : 1;
  
  // Extract historical data
  const prices = historicalData.map(d => d.close || d.price).filter(p => p > 0);
  const highs = historicalData.map(d => d.high || d.price).filter(h => h > 0);
  const lows = historicalData.map(d => d.low || d.price).filter(l => l > 0);
  const volumes = historicalData.map(d => d.volume || 0).filter(v => v > 0);
  
  // Technical indicators
  const rsi = calculateRSI(prices);
  const macd = calculateMACD(prices);
  const atr = calculateATR(highs, lows, prices);
  const vwap = calculateVWAP(highs, lows, prices, volumes);
  
  // VWAP deviation
  const vwapDeviation = vwap > 0 ? ((price - vwap) / vwap) * 100 : 0;
  
  // Gap calculation (simplified)
  const gap = historicalData.length > 0 ? 
    ((price - (historicalData[0].close || historicalData[0].price)) / (historicalData[0].close || historicalData[0].price)) * 100 : 0;
  
  // High of day / Low of day
  const hod = Math.max(...highs, price);
  const lod = Math.min(...lows, price);
  const hodDistance = hod > 0 ? ((price - hod) / hod) * 100 : 0;
  const lodDistance = lod > 0 ? ((price - lod) / lod) * 100 : 0;
  
  // Volatility (ATR as percentage of price)
  const volatility = price > 0 ? (atr / price) * 100 : 0;
  
  // News impact (placeholder)
  const newsImpact = Math.random() * 100; // Would be calculated from actual news data
  
  // AI score (composite)
  const aiScore = calculateAIScore({
    changePercent,
    relativeVolume,
    rsi,
    vwapDeviation,
    volatility,
    newsImpact
  });
  
  return {
    // Basic data
    symbol: quote.symbol,
    name: quote.name,
    price,
    change,
    changePercent,
    volume,
    avgVolume,
    relativeVolume,
    
    // Technical indicators
    rsi,
    macd: macd.macd,
    atr,
    vwap,
    vwapDeviation,
    volatility,
    
    // Price action
    gap,
    hod,
    lod,
    hodDistance,
    lodDistance,
    
    // Additional metrics
    newsImpact,
    aiScore,
    
    // Timestamps
    lastUpdate: new Date().toISOString()
  };
}

// Calculate AI score
function calculateAIScore(metrics) {
  const weights = {
    momentum: 0.3,
    volume: 0.2,
    technical: 0.2,
    volatility: 0.1,
    news: 0.2
  };
  
  let score = 0;
  
  // Momentum score (0-100)
  const momentumScore = Math.min(Math.abs(metrics.changePercent) * 10, 100);
  score += momentumScore * weights.momentum;
  
  // Volume score (0-100)
  const volumeScore = Math.min(metrics.relativeVolume * 20, 100);
  score += volumeScore * weights.volume;
  
  // Technical score (0-100)
  const technicalScore = (metrics.rsi > 70 || metrics.rsi < 30 ? 80 : 40) + 
                        (Math.abs(metrics.vwapDeviation) > 2 ? 20 : 0);
  score += technicalScore * weights.technical;
  
  // Volatility score (0-100)
  const volatilityScore = Math.min(metrics.volatility * 10, 100);
  score += volatilityScore * weights.volatility;
  
  // News score (0-100)
  score += metrics.newsImpact * weights.news;
  
  return Math.min(Math.max(score, 0), 100);
}

// Apply scanner filters
function applyFilters(stocks, preset) {
  const presetConfig = SCANNER_PRESETS[preset];
  if (!presetConfig) return stocks;
  
  const { filters } = presetConfig;
  
  return stocks.filter(stock => {
    if (filters.minChange && Math.abs(stock.changePercent) < filters.minChange) return false;
    if (filters.minRvol && stock.relativeVolume < filters.minRvol) return false;
    if (filters.minVolume && stock.volume < filters.minVolume) return false;
    if (filters.minGap && Math.abs(stock.gap) < filters.minGap) return false;
    if (filters.minPrice && stock.price < filters.minPrice) return false;
    if (filters.maxPrice && stock.price > filters.maxPrice) return false;
    
    return true;
  });
}

// Sort stocks by preset
function sortStocks(stocks, preset) {
  switch (preset) {
    case 'momentum':
      return stocks.sort((a, b) => b.changePercent - a.changePercent);
    case 'hod_lod':
      return stocks.sort((a, b) => Math.abs(b.hodDistance) - Math.abs(a.hodDistance));
    case 'unusual_volume':
      return stocks.sort((a, b) => b.relativeVolume - a.relativeVolume);
    case 'news_movers':
      return stocks.sort((a, b) => b.newsImpact - a.newsImpact);
    case 'gappers':
      return stocks.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    default:
      return stocks.sort((a, b) => b.aiScore - a.aiScore);
  }
}

// Generate stock badges
function generateBadges(stock, rank) {
  const badges = [];
  
  if (rank < 5) badges.push('TOP PICK');
  if (stock.changePercent > 5) badges.push('HIGH MOMENTUM');
  if (stock.relativeVolume > 3) badges.push('UNUSUAL VOLUME');
  if (Math.abs(stock.gap) > 5) badges.push('GAP');
  if (stock.volatility > 10) badges.push('VOLATILE');
  if (stock.aiScore > 80) badges.push('STRONG SIGNAL');
  if (Math.abs(stock.vwapDeviation) > 2) badges.push('VWAP DEVIATION');
  if (stock.hodDistance > 0) badges.push('NEAR HOD');
  if (stock.lodDistance < 0) badges.push('NEAR LOD');
  
  return badges;
}

// Main scanner function
async function runScanner(preset = 'momentum', limit = 100) {
  if (isScanning) {
    console.log('Scanner already running, returning cached results');
    const cached = scannerCache.get(preset);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }
  }
  
  isScanning = true;
  console.log(`🔍 Running ${preset} scanner...`);
  
  try {
    // Get all active symbols
    const allSymbols = comprehensiveSymbolMaster.getAllActiveSymbols();
    const symbols = allSymbols.map(s => s.symbol);
    
    console.log(`📊 Scanning ${symbols.length} symbols`);
    
    // Get quotes in batches
    const batchSize = 100;
    const allQuotes = [];
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      try {
        const quotes = await unifiedProviderManager.getQuotes(batch);
        allQuotes.push(...quotes);
        
        // Rate limiting protection
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`Batch ${i}-${i + batchSize} failed:`, error.message);
      }
    }
    
    console.log(`✅ Retrieved ${allQuotes.length} quotes`);
    
    // Calculate metrics for each stock
    const processedStocks = [];
    
    for (const quote of allQuotes) {
      try {
        const symbol = comprehensiveSymbolMaster.getSymbol(quote.symbol);
        if (!symbol) continue;
        
        // Get historical data (placeholder - would fetch from provider)
        const historicalData = []; // Would be fetched from OHLC provider
        
        const metrics = calculateStockMetrics(quote, historicalData);
        
        processedStocks.push({
          ...metrics,
          exchange: symbol.exchange,
          sector: symbol.sector,
          industry: symbol.industry,
          marketCap: symbol.marketCap
        });
        
      } catch (error) {
        console.warn(`Error processing ${quote.symbol}:`, error.message);
      }
    }
    
    // Apply filters and sort
    const filteredStocks = applyFilters(processedStocks, preset);
    const sortedStocks = sortStocks(filteredStocks, preset);
    
    // Add badges and limit results
    const finalStocks = sortedStocks.slice(0, limit).map((stock, index) => ({
      ...stock,
      rank: index + 1,
      badges: generateBadges(stock, index + 1)
    }));
    
    const result = {
      stocks: finalStocks,
      count: finalStocks.length,
      preset,
      lastUpdate: new Date().toISOString(),
      totalScanned: processedStocks.length
    };
    
    // Cache result
    scannerCache.set(preset, {
      data: result,
      timestamp: Date.now()
    });
    
    console.log(`✅ Scanner complete: ${finalStocks.length} results`);
    return result;
    
  } catch (error) {
    console.error('Scanner error:', error);
    throw error;
  } finally {
    isScanning = false;
  }
}

// Start continuous scanning
setInterval(async () => {
  try {
    for (const preset of Object.keys(SCANNER_PRESETS)) {
      await runScanner(preset, 50);
    }
  } catch (error) {
    console.error('Continuous scanning error:', error);
  }
}, SCAN_INTERVAL);

// Main API handler
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const preset = searchParams.get('preset') || 'momentum';
    const limit = parseInt(searchParams.get('limit')) || 100;
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    // Check if preset is valid
    if (!SCANNER_PRESETS[preset]) {
      return Response.json({
        success: false,
        error: 'Invalid preset',
        message: `Available presets: ${Object.keys(SCANNER_PRESETS).join(', ')}`
      }, { status: 400 });
    }
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = scannerCache.get(preset);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return Response.json({
          success: true,
          data: cached.data
        });
      }
    }
    
    // Run scanner
    const result = await runScanner(preset, limit);
    
    return Response.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Live scanner error:', error);
    return Response.json({
      success: false,
      error: 'Scanner failed',
      message: error.message
    }, { status: 500 });
  }
}
