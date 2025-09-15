// Advanced Scanner - Professional-grade signals covering full universe
import { loadSymbolMaster, getAllActiveSymbols } from './symbol-master.js';
import { providerManager } from './provider-manager.js';

let symbolMaster = null;
let quoteCache = new Map();
let cacheTime = 0;
const CACHE_DURATION = 15 * 1000; // 15 seconds

// Initialize symbol master
async function initializeSymbolMaster() {
  if (!symbolMaster) {
    symbolMaster = await loadSymbolMaster();
  }
  return symbolMaster;
}

// Get quotes with batching and caching
async function getQuotesBatched(symbols, batchSize = 50) {
  const now = Date.now();
  
  // Check cache first
  if (now - cacheTime < CACHE_DURATION) {
    const cachedQuotes = [];
    const missingSymbols = [];
    
    for (const symbol of symbols) {
      const cached = quoteCache.get(symbol);
      if (cached) {
        cachedQuotes.push(cached);
      } else {
        missingSymbols.push(symbol);
      }
    }
    
    if (missingSymbols.length === 0) {
      return cachedQuotes;
    }
    
    // Fetch missing quotes
    const newQuotes = await fetchQuotesInBatches(missingSymbols, batchSize);
    newQuotes.forEach(quote => quoteCache.set(quote.symbol, quote));
    
    return [...cachedQuotes, ...newQuotes];
  }
  
  // Fetch all quotes
  const quotes = await fetchQuotesInBatches(symbols, batchSize);
  quotes.forEach(quote => quoteCache.set(quote.symbol, quote));
  quoteCache = new Map(Array.from(quoteCache.entries()).slice(-1000)); // Keep last 1000
  cacheTime = now;
  
  return quotes;
}

// Fetch quotes in batches with error handling
async function fetchQuotesInBatches(symbols, batchSize) {
  const allQuotes = [];
  const errors = [];
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    try {
      const result = await providerManager.getQuotes(batch);
      allQuotes.push(...result.quotes);
      
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn(`Batch ${i}-${i + batchSize} failed:`, error.message);
      errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`);
    }
  }
  
  return allQuotes;
}

// Calculate technical indicators
function calculateTechnicalIndicators(quote, candles = []) {
  const price = quote.price || 0;
  const change = quote.change || 0;
  const changePercent = quote.changePercent || 0;
  const volume = quote.volume || 0;
  const avgVolume = quote.averageDailyVolume3Month || volume;
  const relativeVolume = avgVolume > 0 ? volume / avgVolume : 1;
  
  // RSI calculation (simplified)
  const rsi = calculateRSI(candles) || 50;
  
  // MACD calculation (simplified)
  const macd = calculateMACD(candles) || 0;
  
  // VWAP deviation (simplified)
  const vwap = calculateVWAP(candles) || price;
  const vwapDeviation = vwap > 0 ? ((price - vwap) / vwap) * 100 : 0;
  
  // Volatility (ATR-based)
  const volatility = calculateVolatility(candles) || 0;
  
  // Gap detection
  const gap = calculateGap(candles) || 0;
  
  return {
    rsi,
    macd,
    vwapDeviation,
    volatility,
    gap,
    relativeVolume
  };
}

// Calculate RSI (simplified)
function calculateRSI(candles) {
  if (candles.length < 14) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i < 14; i++) {
    const change = candles[i].close - candles[i-1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / 13;
  const avgLoss = losses / 13;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate MACD (simplified)
function calculateMACD(candles) {
  if (candles.length < 26) return 0;
  
  const ema12 = calculateEMA(candles.slice(-12), 12);
  const ema26 = calculateEMA(candles.slice(-26), 26);
  
  return ema12 - ema26;
}

// Calculate EMA
function calculateEMA(candles, period) {
  if (candles.length === 0) return 0;
  
  const multiplier = 2 / (period + 1);
  let ema = candles[0].close;
  
  for (let i = 1; i < candles.length; i++) {
    ema = (candles[i].close * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

// Calculate VWAP
function calculateVWAP(candles) {
  if (candles.length === 0) return 0;
  
  let totalVolume = 0;
  let totalValue = 0;
  
  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    totalValue += typicalPrice * candle.volume;
    totalVolume += candle.volume;
  }
  
  return totalVolume > 0 ? totalValue / totalVolume : 0;
}

// Calculate volatility (ATR-based)
function calculateVolatility(candles) {
  if (candles.length < 14) return 0;
  
  let atr = 0;
  
  for (let i = 1; i < 14; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i-1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    atr += tr;
  }
  
  return atr / 13;
}

// Calculate gap
function calculateGap(candles) {
  if (candles.length < 2) return 0;
  
  const currentOpen = candles[candles.length - 1].open;
  const prevClose = candles[candles.length - 2].close;
  
  return prevClose > 0 ? ((currentOpen - prevClose) / prevClose) * 100 : 0;
}

// Calculate composite score based on preset
function calculateScore(quote, technicals, preset) {
  let score = 0;
  const weights = getPresetWeights(preset);
  
  // Price change component
  const changeScore = Math.abs(quote.changePercent || 0) * weights.change;
  score += changeScore;
  
  // Volume component
  const volumeScore = Math.min(technical.relativeVolume * 10, 50) * weights.volume;
  score += volumeScore;
  
  // Technical component
  const technicalScore = calculateTechnicalScore(technicals) * weights.technical;
  score += technicalScore;
  
  // Momentum component
  const momentumScore = calculateMomentumScore(quote, technicals) * weights.momentum;
  score += momentumScore;
  
  // Volatility component
  const volatilityScore = Math.min(technical.volatility * 2, 20) * weights.volatility;
  score += volatilityScore;
  
  return Math.round(score);
}

// Get preset-specific weights
function getPresetWeights(preset) {
  const weights = {
    momentum: { change: 0.3, volume: 0.2, technical: 0.2, momentum: 0.2, volatility: 0.1 },
    volume: { change: 0.1, volume: 0.4, technical: 0.2, momentum: 0.2, volatility: 0.1 },
    breakout: { change: 0.2, volume: 0.3, technical: 0.3, momentum: 0.1, volatility: 0.1 },
    news: { change: 0.2, volume: 0.2, technical: 0.1, momentum: 0.2, volatility: 0.1, news: 0.2 },
    afterhours: { change: 0.3, volume: 0.2, technical: 0.2, momentum: 0.2, volatility: 0.1 },
    lowfloat: { change: 0.4, volume: 0.3, technical: 0.1, momentum: 0.1, volatility: 0.1 }
  };
  
  return weights[preset] || weights.momentum;
}

// Calculate technical score
function calculateTechnicalScore(technicals) {
  let score = 0;
  
  // RSI score
  if (technicals.rsi > 70) score += 10; // Overbought
  else if (technicals.rsi < 30) score += 10; // Oversold
  else score += 5; // Neutral
  
  // MACD score
  if (technicals.macd > 0) score += 5; // Bullish
  else score += 2; // Bearish
  
  // VWAP deviation score
  const vwapScore = Math.min(Math.abs(technicals.vwapDeviation) * 2, 15);
  score += vwapScore;
  
  return score;
}

// Calculate momentum score
function calculateMomentumScore(quote, technicals) {
  let score = 0;
  
  // Price change momentum
  const changePercent = Math.abs(quote.changePercent || 0);
  if (changePercent > 5) score += 15;
  else if (changePercent > 2) score += 10;
  else if (changePercent > 1) score += 5;
  
  // Gap momentum
  if (Math.abs(technicals.gap) > 5) score += 10;
  else if (Math.abs(technicals.gap) > 2) score += 5;
  
  return score;
}

// Main scanner function
export async function scanStocks(preset = 'momentum', limit = 50, filters = {}) {
  await initializeSymbolMaster();
  
  if (!symbolMaster || symbolMaster.length === 0) {
    console.error('Symbol master is empty or failed to load');
    return { stocks: [], errors: ['No symbol master available'], universeSize: 0 };
  }
  
  console.log(`Scanner universe size: ${symbolMaster.length} symbols`);
  
  console.log(`Starting ${preset} scan with ${symbolMaster.length} symbols in universe`);
  
  // Log exchange breakdown
  const exchangeCounts = symbolMaster.reduce((acc, symbol) => {
    acc[symbol.exchange] = (acc[symbol.exchange] || 0) + 1;
    return acc;
  }, {});
  console.log(`Universe breakdown:`, exchangeCounts);
  
  // Apply filters
  let filteredSymbols = symbolMaster.filter(symbol => {
    if (!symbol.isActive) return false;
    if (filters.minPrice && symbol.marketCap && symbol.marketCap < filters.minPrice * 1000000) return false;
    if (filters.exchange && symbol.exchange !== filters.exchange) return false;
    if (filters.sector && symbol.sector !== filters.sector) return false;
    return true;
  });
  
  console.log(`After filters: ${filteredSymbols.length} symbols`);
  
  // Get quotes in batches
  const symbols = filteredSymbols.map(s => s.symbol);
  const quotes = await getQuotesBatched(symbols, 50);
  
  console.log(`Retrieved ${quotes.length} quotes`);
  
  // Process quotes and calculate scores
  const processedStocks = [];
  
  for (const quote of quotes) {
    try {
      // Get technical indicators (simplified for now)
      const technicals = calculateTechnicalIndicators(quote);
      
      // Calculate composite score
      const score = calculateScore(quote, technicals, preset);
      
      // Get symbol info
      const symbolInfo = symbolMaster.find(s => s.symbol === quote.symbol);
      
      processedStocks.push({
        symbol: quote.symbol,
        companyName: symbolInfo?.companyName || quote.symbol,
        price: quote.price || 0,
        change: quote.change || 0,
        changePercent: quote.changePercent || 0,
        volume: quote.volume || 0,
        relativeVolume: technicals.relativeVolume,
        marketCap: quote.marketCap || symbolInfo?.marketCap || 0,
        sector: symbolInfo?.sector || 'Unknown',
        exchange: symbolInfo?.exchange || 'Unknown',
        score: score,
        rsi: technicals.rsi,
        macd: technicals.macd,
        vwapDeviation: technicals.vwapDeviation,
        volatility: technicals.volatility,
        gap: technicals.gap,
        lastUpdate: new Date().toISOString(),
        provider: quote.provider || 'unknown'
      });
    } catch (error) {
      console.warn(`Error processing ${quote.symbol}:`, error.message);
    }
  }
  
  // Sort by score and return top N
  const sortedStocks = processedStocks
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  console.log(`Returning ${sortedStocks.length} stocks for ${preset} preset`);
  
  return {
    stocks: sortedStocks,
    totalProcessed: processedStocks.length,
    universeSize: symbolMaster.length,
    preset: preset,
    lastUpdate: new Date().toISOString()
  };
}
