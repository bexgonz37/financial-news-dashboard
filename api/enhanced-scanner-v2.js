// Enhanced Scanner API v2 - Professional Day Trading Dashboard
// Advanced scanners stronger than momoscreener.com with full universe coverage

import { loadSymbolMaster } from '../lib/symbol-master.js';
import { providerManager } from '../lib/provider-manager.js';
import { sharedDataCache } from '../lib/shared-data-cache.js';

// Calculate advanced technical indicators
function calculateTechnicalIndicators(quote, historicalData = []) {
  const price = quote.price || 0;
  const change = quote.change || 0;
  const changePercent = quote.changePercent || 0;
  const volume = quote.volume || 0;
  const avgVolume = quote.averageDailyVolume3Month || 0;
  
  // Relative Volume (RVOL)
  const rvol = avgVolume > 0 ? volume / avgVolume : 1;
  
  // VWAP Distance (simplified - would need intraday data for real VWAP)
  const vwapDev = changePercent; // Placeholder
  
  // RSI (simplified calculation)
  const rsi = calculateRSI(historicalData);
  
  // MACD (simplified)
  const macd = calculateMACD(historicalData);
  
  // ATR (simplified)
  const atr = calculateATR(historicalData);
  
  // Gap calculation (simplified)
  const gap = changePercent; // Placeholder - would need previous close
  
  return {
    rvol: Math.round(rvol * 100) / 100,
    vwapDev: Math.round(vwapDev * 100) / 100,
    rsi: Math.round(rsi * 100) / 100,
    macd: Math.round(macd * 100) / 100,
    atr: Math.round(atr * 100) / 100,
    gap: Math.round(gap * 100) / 100,
    volatility: Math.round(Math.abs(changePercent) * 100) / 100
  };
}

// Calculate RSI (simplified)
function calculateRSI(historicalData) {
  if (historicalData.length < 14) return 50; // Neutral RSI
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i < Math.min(15, historicalData.length); i++) {
    const change = historicalData[i].close - historicalData[i-1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate MACD (simplified)
function calculateMACD(historicalData) {
  if (historicalData.length < 26) return 0;
  
  // Simplified MACD calculation
  const ema12 = calculateEMA(historicalData, 12);
  const ema26 = calculateEMA(historicalData, 26);
  
  return ema12 - ema26;
}

// Calculate EMA
function calculateEMA(data, period) {
  if (data.length < period) return data[data.length - 1]?.close || 0;
  
  const multiplier = 2 / (period + 1);
  let ema = data[0].close;
  
  for (let i = 1; i < data.length; i++) {
    ema = (data[i].close * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

// Calculate ATR
function calculateATR(historicalData) {
  if (historicalData.length < 14) return 0;
  
  let atr = 0;
  
  for (let i = 1; i < Math.min(15, historicalData.length); i++) {
    const high = historicalData[i].high;
    const low = historicalData[i].low;
    const prevClose = historicalData[i-1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    atr += tr;
  }
  
  return atr / 14;
}

// Calculate news heat score
function calculateNewsHeat(ticker, newsData) {
  if (!newsData || newsData.length === 0) return 0;
  
  const now = Date.now();
  const thirtyMinutesAgo = now - (30 * 60 * 1000);
  const oneHourAgo = now - (60 * 60 * 1000);
  const twoHoursAgo = now - (120 * 60 * 1000);
  
  const recentNews = newsData.filter(article => {
    const articleTime = new Date(article.publishedAt).getTime();
    return articleTime > twoHoursAgo && 
           article.tickers && 
           article.tickers.includes(ticker);
  });
  
  const news30m = recentNews.filter(article => 
    new Date(article.publishedAt).getTime() > thirtyMinutesAgo
  ).length;
  
  const news60m = recentNews.filter(article => 
    new Date(article.publishedAt).getTime() > oneHourAgo
  ).length;
  
  const news120m = recentNews.length;
  
  return {
    news30m,
    news60m,
    news120m,
    heatScore: (news30m * 3) + (news60m * 2) + news120m
  };
}

// Apply scanner filters
function applyScannerFilters(stocks, preset, filters) {
  let filtered = [...stocks];
  
  switch (preset) {
    case 'momentum':
      filtered = filtered.filter(stock => 
        Math.abs(stock.changePercent) >= (filters.minChange || 2) &&
        stock.technicals.rvol >= (filters.minRvol || 1.5) &&
        stock.technicals.vwapDev > 0
      );
      break;
      
    case 'news_movers':
      filtered = filtered.filter(stock => 
        stock.newsHeat.heatScore >= (filters.minNewsHeat || 3) &&
        Math.abs(stock.changePercent) >= (filters.minChange || 1)
      );
      break;
      
    case 'gap_and_go':
      filtered = filtered.filter(stock => 
        Math.abs(stock.technicals.gap) >= (filters.minGap || 3) &&
        stock.technicals.rvol >= (filters.minRvol || 2) &&
        stock.technicals.vwapDev > 0
      );
      break;
      
    case 'reversal_watch':
      filtered = filtered.filter(stock => 
        stock.technicals.rsi >= (filters.minRsi || 70) &&
        stock.changePercent < -2 &&
        stock.technicals.rvol >= (filters.minRvol || 1.2)
      );
      break;
      
    case 'high_volume':
      filtered = filtered.filter(stock => 
        stock.technicals.rvol >= (filters.minRvol || 3) &&
        stock.volume >= (filters.minVolume || 1000000)
      );
      break;
  }
  
  // Apply additional filters
  if (filters.minPrice) {
    filtered = filtered.filter(stock => stock.price >= filters.minPrice);
  }
  
  if (filters.maxPrice) {
    filtered = filtered.filter(stock => stock.price <= filters.maxPrice);
  }
  
  if (filters.exchange) {
    filtered = filtered.filter(stock => stock.exchange === filters.exchange);
  }
  
  if (filters.sector) {
    filtered = filtered.filter(stock => stock.sector === filters.sector);
  }
  
  return filtered;
}

// Sort stocks by criteria
function sortStocks(stocks, sortBy) {
  switch (sortBy) {
    case 'change':
      return stocks.sort((a, b) => b.changePercent - a.changePercent);
    case 'rvol':
      return stocks.sort((a, b) => b.technicals.rvol - a.technicals.rvol);
    case 'volume':
      return stocks.sort((a, b) => b.volume - a.volume);
    case 'news_heat':
      return stocks.sort((a, b) => b.newsHeat.heatScore - a.newsHeat.heatScore);
    case 'rsi':
      return stocks.sort((a, b) => b.technicals.rsi - a.technicals.rsi);
    case 'vwap_dev':
      return stocks.sort((a, b) => b.technicals.vwapDev - a.technicals.vwapDev);
    default:
      return stocks.sort((a, b) => b.changePercent - a.changePercent);
  }
}

// Main scanner function
async function scanStocks(preset = 'momentum', limit = 50, filters = {}) {
  console.log(`🔍 Starting ${preset} scan with filters:`, filters);
  
  // Initialize symbol master
  const symbolMaster = await loadSymbolMaster();
  
  if (!symbolMaster || symbolMaster.length === 0) {
    console.error('❌ Symbol master is empty or failed to load');
    return { 
      stocks: [], 
      errors: ['No symbol master available - all providers failed'], 
      universeSize: 0,
      totalProcessed: 0,
      lastUpdate: new Date().toISOString()
    };
  }
  
  console.log(`📊 Scanner universe size: ${symbolMaster.length} symbols`);
  
  // Get all active symbols
  const activeSymbols = symbolMaster
    .filter(s => s.isActive)
    .map(s => s.symbol);
  
  console.log(`📈 Processing ${activeSymbols.length} active symbols using shared cache...`);
  
  // Use shared cache to get quotes and OHLC data
  const cacheData = await sharedDataCache.getScannerData(activeSymbols, []);
  const allQuotes = cacheData.quotes;
  
  console.log(`✅ Retrieved ${allQuotes.length} quotes from shared cache`);
  
  // Process quotes and calculate advanced metrics
  const processedStocks = [];
  
  for (const quote of allQuotes) {
    try {
      const symbol = symbolMaster.find(s => s.symbol === quote.symbol);
      if (!symbol) continue;
      
      // Get OHLC data for this symbol
      const ohlcData = cacheData.ohlcData.find(o => o.symbol === quote.symbol);
      
      // Calculate technical indicators with OHLC data
      const technicals = calculateTechnicalIndicators(quote, ohlcData ? [ohlcData] : []);
      
      // Get news heat for this symbol
      const newsHeat = cacheData.newsHeat.find(n => n.symbol === quote.symbol) || {
        symbol: quote.symbol,
        mentions: 0,
        heatScore: 0
      };
      
      // Calculate AI score based on multiple factors
      const aiScore = calculateAIScore(quote, technicals, newsHeat);
      
      processedStocks.push({
        symbol: quote.symbol,
        name: quote.name || symbol.companyName,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        avgVolume: quote.averageDailyVolume3Month,
        marketCap: quote.marketCap,
        exchange: symbol.exchange,
        sector: symbol.sector,
        industry: symbol.industry,
        technicals,
        newsHeat,
        aiScore,
        lastUpdate: new Date().toISOString()
      });
      
    } catch (error) {
      console.warn(`Error processing ${quote.symbol}:`, error.message);
    }
  }
  
  // Apply filters
  const filteredStocks = applyScannerFilters(processedStocks, preset, filters);
  
  // Sort results
  const sortedStocks = sortStocks(filteredStocks, filters.sortBy || 'change');
  
  // Limit results
  const limitedStocks = sortedStocks.slice(0, parseInt(limit));
  
  // Generate badges for top performers
  limitedStocks.forEach((stock, index) => {
    stock.badges = generateStockBadges(stock, index);
  });
  
  console.log(`🎯 Scanner complete: ${limitedStocks.length} results from ${processedStocks.length} processed stocks`);
  
  return {
    stocks: limitedStocks,
    total: limitedStocks.length,
    universeSize: symbolMaster.length,
    totalProcessed: processedStocks.length,
    rateLimited,
    preset,
    filters,
    lastUpdate: new Date().toISOString()
  };
}

// Calculate AI score
function calculateAIScore(quote, technical, newsHeat) {
  let score = 0;
  
  // Price momentum (40% weight)
  const momentumScore = Math.min(Math.abs(quote.changePercent) * 2, 100);
  score += momentumScore * 0.4;
  
  // Volume strength (25% weight)
  const volumeScore = Math.min(technical.rvol * 20, 100);
  score += volumeScore * 0.25;
  
  // Technical indicators (20% weight)
  const technicalScore = (technical.rsi + technical.macd + technical.atr) / 3;
  score += technicalScore * 0.2;
  
  // News heat (15% weight)
  const newsScore = Math.min(newsHeat.heatScore * 10, 100);
  score += newsScore * 0.15;
  
  return Math.round(score);
}

// Generate stock badges
function generateStockBadges(stock, rank) {
  const badges = [];
  
  if (rank < 5) badges.push('TOP PICK');
  if (stock.changePercent > 5) badges.push('HIGH MOMENTUM');
  if (stock.technicals.rvol > 3) badges.push('HIGH VOLUME');
  if (Math.abs(stock.technicals.gap) > 5) badges.push('GAP');
  if (stock.technicals.volatility > 10) badges.push('VOLATILE');
  if (stock.aiScore > 80) badges.push('STRONG SIGNAL');
  else if (stock.aiScore > 60) badges.push('GOOD SIGNAL');
  if (stock.technicals.vwapDev > 2) badges.push('VWAP DEVIATION');
  
  return badges;
}

// Main API handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { 
      preset = 'momentum',
      limit = 50,
      minChange = null,
      minRvol = null,
      minPrice = null,
      maxPrice = null,
      exchange = null,
      sector = null,
      sortBy = 'change'
    } = req.query;
    
    console.log('🔍 Enhanced Scanner API v2 request:', { 
      preset, limit, minChange, minRvol, minPrice, maxPrice, exchange, sector, sortBy 
    });
    
    const filters = {
      minChange: minChange ? parseFloat(minChange) : null,
      minRvol: minRvol ? parseFloat(minRvol) : null,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      exchange,
      sector,
      sortBy
    };
    
    const result = await scanStocks(preset, parseInt(limit), filters);
    
    // Provider health status
    const providerStatus = providerManager.getProviderStatus();
    const healthStatus = providerStatus.scanner === 'live' ? 'LIVE' : 
                        providerStatus.scanner === 'degraded' ? 'DEGRADED' : 'OFFLINE';
    
    return res.status(200).json({
      success: true,
      data: {
        ...result,
        healthStatus,
        providerStatus
      }
    });
    
  } catch (error) {
    console.error('❌ Enhanced Scanner API v2 error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to scan stocks',
      message: error.message,
      data: { stocks: [] }
    });
  }
}
