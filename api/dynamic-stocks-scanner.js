// Live Scanner API - Real Financial Data from Multiple Providers
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// API Keys from environment variables
const FMP_KEY = process.env.FMP_KEY;
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const IEX_CLOUD_KEY = process.env.IEX_CLOUD_KEY;

// Cache for universe data (1 day)
let universeCache = null;
let universeCacheTime = 0;
const UNIVERSE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Load universe of all tradable tickers
async function loadUniverse() {
  const now = Date.now();
  if (universeCache && (now - universeCacheTime) < UNIVERSE_CACHE_DURATION) {
    return universeCache;
  }

  console.log('Loading universe of tradable tickers...');
  
  try {
    // Try FMP first for comprehensive list
    if (FMP_KEY) {
      const response = await fetch(`https://financialmodelingprep.com/api/v3/stock/list?apikey=${FMP_KEY}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const symbols = data
            .filter(stock => stock.symbol && stock.exchange && 
                   ['NASDAQ', 'NYSE', 'AMEX'].includes(stock.exchange))
            .map(stock => stock.symbol)
            .slice(0, 2000); // Limit to 2000 for performance
          
          universeCache = symbols;
          universeCacheTime = now;
          console.log(`Loaded universe: ${symbols.length} symbols from FMP`);
          return symbols;
        }
      }
    }

    // Fallback to hardcoded list of major tickers
    const fallbackSymbols = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'INTC',
      'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'PYPL', 'ADBE',
      'CRM', 'NKE', 'ABT', 'TMO', 'ACN', 'COST', 'DHR', 'VZ', 'NEE', 'WMT',
      'BAC', 'XOM', 'T', 'PFE', 'KO', 'PEP', 'ABBV', 'CVX', 'MRK', 'LLY',
      'AVGO', 'TXN', 'QCOM', 'CHTR', 'CMCSA', 'COF', 'GILD', 'AMGN', 'HON', 'UNP'
    ];
    
    universeCache = fallbackSymbols;
    universeCacheTime = now;
    console.log(`Using fallback universe: ${fallbackSymbols.length} symbols`);
    return fallbackSymbols;
  } catch (error) {
    console.error('Failed to load universe:', error);
    const fallbackSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'];
    universeCache = fallbackSymbols;
    universeCacheTime = now;
    return fallbackSymbols;
  }
}

// Provider functions
async function quotesFromIEX(symbols) {
  if (!IEX_CLOUD_KEY) {
    console.warn('IEX Cloud key not available');
    return [];
  }
  
  const quotes = [];
  const batchSize = 100;
  
  for (let i = 0; i < Math.min(symbols.length, 500); i += batchSize) { // Limit to 500 symbols
    const batch = symbols.slice(i, i + batchSize);
    const symbolsStr = batch.join(',');
    
    try {
      const response = await fetch(`https://cloud.iexapis.com/stable/stock/market/batch?symbols=${symbolsStr}&types=quote&token=${IEX_CLOUD_KEY}`, { 
        cache: 'no-store',
        timeout: 10000
      });
      
      if (response.ok) {
        const data = await response.json();
        for (const [symbol, stockData] of Object.entries(data)) {
          if (stockData.quote) {
            const q = stockData.quote;
            if (q.latestPrice && q.latestPrice > 0) {
              quotes.push({
                symbol: symbol,
                name: q.companyName || symbol,
                price: q.latestPrice,
                change: q.change || 0,
                changePercent: q.changePercent || 0,
                volume: q.volume || 0,
                averageDailyVolume3Month: q.avgTotalVolume || 0,
                relativeVolume: q.avgTotalVolume > 0 ? (q.volume || 0) / q.avgTotalVolume : 1,
                marketState: q.isUSMarketOpen ? 'REGULAR' : 'CLOSED',
                marketCap: q.marketCap || null,
                pe: q.peRatio || null,
                high52Week: q.week52High || null,
                low52Week: q.week52Low || null,
                lastUpdate: new Date().toISOString(),
                provider: 'iex'
              });
            }
          }
        }
      } else {
        console.warn(`IEX batch ${i}-${i + batchSize} failed with status: ${response.status}`);
      }
    } catch (error) {
      console.warn(`IEX batch ${i}-${i + batchSize} failed:`, error.message);
    }
  }
  
  console.log(`IEX returned ${quotes.length} quotes`);
  return quotes;
}

async function quotesFromFinnhub(symbols) {
  if (!FINNHUB_KEY) {
    console.warn('Finnhub key not available');
    return [];
  }
  
  const quotes = [];
  
  for (const symbol of symbols.slice(0, 100)) { // Limit to 100 for rate limits
    try {
      const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`, { 
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
            averageDailyVolume3Month: 0,
            relativeVolume: 1,
            marketState: 'REGULAR',
            marketCap: null,
            pe: null,
            high52Week: data.h || null,
            low52Week: data.l || null,
            lastUpdate: new Date().toISOString(),
            provider: 'finnhub'
          });
        }
      } else {
        console.warn(`Finnhub quote for ${symbol} failed with status: ${response.status}`);
      }
    } catch (error) {
      console.warn(`Finnhub quote for ${symbol} failed:`, error.message);
    }
  }
  
  console.log(`Finnhub returned ${quotes.length} quotes`);
  return quotes;
}

async function quotesFromFMP(symbols) {
  if (!FMP_KEY) {
    console.warn('FMP key not available');
    return [];
  }
  
  const quotes = [];
  const batchSize = 100;
  
  for (let i = 0; i < Math.min(symbols.length, 1000); i += batchSize) { // Limit to 1000 symbols
    const batch = symbols.slice(i, i + batchSize);
    const symbolsStr = batch.join(',');
    
    try {
      const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${symbolsStr}?apikey=${FMP_KEY}`, { 
        cache: 'no-store',
        timeout: 10000
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          for (const q of data) {
            if (q.price && q.price > 0) {
              quotes.push({
                symbol: q.symbol,
                name: q.name || q.symbol,
                price: q.price,
                change: q.change || 0,
                changePercent: q.changesPercentage || 0,
                volume: q.volume || 0,
                averageDailyVolume3Month: q.avgVolume || 0,
                relativeVolume: q.avgVolume > 0 ? (q.volume || 0) / q.avgVolume : 1,
                marketState: 'REGULAR',
                marketCap: q.marketCap || null,
                pe: q.pe || null,
                high52Week: q.yearHigh || null,
                low52Week: q.yearLow || null,
                lastUpdate: new Date().toISOString(),
                provider: 'fmp'
              });
            }
          }
        }
      } else {
        console.warn(`FMP batch ${i}-${i + batchSize} failed with status: ${response.status}`);
      }
    } catch (error) {
      console.warn(`FMP batch ${i}-${i + batchSize} failed:`, error.message);
    }
  }
  
  console.log(`FMP returned ${quotes.length} quotes`);
  return quotes;
}

// Advanced scoring system for different presets
function scoreByPreset(quotes, preset) {
  return quotes.map(quote => {
    let score = 0;
    const changePercent = Math.abs(quote.changePercent || 0);
    const volume = quote.volume || 0;
    const relativeVolume = quote.relativeVolume || 1;
    const marketCap = quote.marketCap || 0;
    const pe = quote.pe || 0;
    const price = quote.price || 0;
    
    // Base score components
    const momentumScore = changePercent * 10;
    const volumeScore = Math.log10(volume + 1) * 5;
    const rvolScore = relativeVolume > 1 ? Math.min(relativeVolume * 20, 100) : 0;
    const liquidityScore = volume > 100000 ? 20 : 0;
    const volatilityScore = changePercent > 5 ? 30 : changePercent > 2 ? 15 : 0;
    
    // Market cap categories
    const isLargeCap = marketCap > 10000000000; // > $10B
    const isMidCap = marketCap > 2000000000 && marketCap <= 10000000000; // $2B-$10B
    const isSmallCap = marketCap > 300000000 && marketCap <= 2000000000; // $300M-$2B
    const isMicroCap = marketCap <= 300000000; // < $300M
    
    switch (preset) {
      case 'momentum':
        // Strong price movement with volume confirmation
        score = momentumScore + rvolScore + liquidityScore + volatilityScore;
        if (changePercent > 10) score += 50; // Big movers
        if (relativeVolume > 3) score += 40; // High relative volume
        break;
        
      case 'volume':
        // High volume and relative volume
        score = volumeScore + rvolScore * 2 + liquidityScore;
        if (relativeVolume > 5) score += 80; // Extreme volume
        if (volume > 10000000) score += 50; // Very high absolute volume
        break;
        
      case 'oversold':
        // Negative change with potential bounce
        const negativeChange = quote.changePercent < 0 ? Math.abs(quote.changePercent) : 0;
        score = negativeChange * 15 + rvolScore + liquidityScore;
        if (negativeChange > 10) score += 60; // Oversold bounce potential
        if (relativeVolume > 2) score += 30; // Volume on decline
        break;
        
      case 'breakout':
        // High momentum with volume confirmation
        score = momentumScore * 1.5 + rvolScore + liquidityScore + volatilityScore;
        if (changePercent > 15) score += 70; // Strong breakout
        if (relativeVolume > 4) score += 50; // Volume confirmation
        break;
        
      case 'earnings':
        // Moderate movement with volume (earnings season)
        score = momentumScore + rvolScore + liquidityScore;
        if (changePercent > 5 && changePercent < 20) score += 40; // Earnings range
        if (relativeVolume > 2) score += 30; // Earnings volume
        break;
        
      case 'afterhours':
        // After hours movers
        score = momentumScore * 1.2 + rvolScore + liquidityScore;
        if (changePercent > 8) score += 50; // AH movers
        if (relativeVolume > 1.5) score += 30; // AH volume
        break;
        
      case 'ai':
        // AI-related stocks (placeholder - would need sector filtering)
        score = momentumScore + rvolScore + liquidityScore;
        if (changePercent > 5) score += 30; // AI momentum
        break;
        
      case 'insider':
        // Insider activity (placeholder - would need insider data)
        score = momentumScore + rvolScore + liquidityScore;
        if (changePercent > 3) score += 25; // Insider activity
        break;
        
      case 'shortsqueeze':
        // Short squeeze potential
        score = momentumScore * 1.3 + rvolScore * 1.5 + liquidityScore;
        if (changePercent > 20) score += 80; // Squeeze potential
        if (relativeVolume > 5) score += 60; // Squeeze volume
        break;
        
      case 'newlistings':
        // New listings and ticker changes
        score = momentumScore + rvolScore + liquidityScore;
        if (changePercent > 10) score += 40; // New listing momentum
        break;
        
      case 'highrvol':
        // High relative volume movers
        score = rvolScore * 2 + momentumScore + liquidityScore;
        if (relativeVolume > 3) score += 60; // High RVOL
        if (relativeVolume > 5) score += 40; // Extreme RVOL
        break;
        
      case 'gaps':
        // Gap up/down movers
        score = momentumScore * 1.5 + rvolScore + liquidityScore;
        if (changePercent > 15) score += 70; // Big gaps
        if (changePercent > 25) score += 50; // Huge gaps
        break;
        
      case 'earnings_pre':
        // Pre-earnings movers
        score = momentumScore + rvolScore + liquidityScore;
        if (changePercent > 5 && changePercent < 15) score += 30; // Pre-earnings range
        if (relativeVolume > 1.5) score += 25; // Pre-earnings volume
        break;
        
      case 'earnings_post':
        // Post-earnings movers
        score = momentumScore * 1.2 + rvolScore + liquidityScore;
        if (changePercent > 10) score += 50; // Post-earnings reaction
        if (relativeVolume > 2) score += 30; // Post-earnings volume
        break;
        
      case 'insider':
        // Insider activity (placeholder - would need insider data)
        score = momentumScore + rvolScore + liquidityScore;
        if (changePercent > 3) score += 25; // Insider activity
        if (relativeVolume > 1.2) score += 20; // Insider volume
        break;
        
      case 'shortsqueeze':
        // Short squeeze potential
        score = momentumScore * 1.3 + rvolScore * 1.5 + liquidityScore;
        if (changePercent > 20) score += 80; // Squeeze potential
        if (relativeVolume > 5) score += 60; // Squeeze volume
        break;
        
      case 'ai':
        // AI-related stocks (placeholder - would need sector filtering)
        score = momentumScore + rvolScore + liquidityScore;
        if (changePercent > 5) score += 30; // AI momentum
        break;
        
      case 'afterhours':
        // After hours movers
        score = momentumScore * 1.2 + rvolScore + liquidityScore;
        if (changePercent > 8) score += 50; // AH movers
        if (relativeVolume > 1.5) score += 30; // AH volume
        break;
        
      default:
        // General scoring
        score = momentumScore + rvolScore + liquidityScore + volatilityScore;
    }
    
    // Add market cap bonus/penalty
    if (isLargeCap) score += 10; // Large cap stability
    if (isMidCap) score += 15; // Mid cap sweet spot
    if (isSmallCap) score += 20; // Small cap opportunity
    if (isMicroCap) score += 25; // Micro cap high risk/reward
    
    // Add PE ratio consideration
    if (pe > 0 && pe < 20) score += 10; // Reasonable valuation
    if (pe > 50) score -= 10; // High valuation penalty
    
    // Ensure minimum score for any valid data
    if (price > 0) score = Math.max(score, 1);
    
    return { 
      ...quote, 
      score: Math.round(score),
      badges: generateBadges(quote, preset)
    };
  });
}

// Generate badges for different criteria
function generateBadges(quote, preset) {
  const badges = [];
  const changePercent = Math.abs(quote.changePercent || 0);
  const relativeVolume = quote.relativeVolume || 1;
  const volume = quote.volume || 0;
  const price = quote.price || 0;
  
  // Universal badges
  if (changePercent > 20) badges.push('BIG_MOVER');
  if (relativeVolume > 5) badges.push('HIGH_VOLUME');
  if (volume > 10000000) badges.push('MASSIVE_VOLUME');
  if (changePercent > 10 && relativeVolume > 2) badges.push('BREAKOUT');
  if (changePercent > 15) badges.push('GAP_MOVER');
  if (relativeVolume > 3) badges.push('UNUSUAL_VOLUME');
  
  // Preset-specific badges
  if (preset === 'earnings' || preset === 'earnings_pre' || preset === 'earnings_post') badges.push('EARNINGS');
  if (preset === 'ai') badges.push('AI');
  if (preset === 'insider') badges.push('INSIDER');
  if (preset === 'shortsqueeze') badges.push('SHORT_SQUEEZE');
  if (preset === 'newlistings') badges.push('NEW_LISTING');
  if (preset === 'afterhours') badges.push('AFTER_HOURS');
  if (preset === 'gaps') badges.push('GAP');
  if (preset === 'highrvol') badges.push('HIGH_RVOL');
  if (preset === 'breakout') badges.push('BREAKOUT');
  if (preset === 'oversold') badges.push('OVERSOLD');
  
  // Market cap badges
  if (price > 100) badges.push('HIGH_PRICE');
  if (price < 5) badges.push('PENNY_STOCK');
  
  // Volume badges
  if (volume > 50000000) badges.push('MEGA_VOLUME');
  if (volume < 100000) badges.push('LOW_VOLUME');
  
  return badges;
}

// Fallback function to fetch individual quotes using live-data API
async function fetchFallbackQuotes(symbols) {
  const quotes = [];
  
  for (const symbol of symbols) {
    try {
      const response = await fetch(`https://financial-news-dashboard-one.vercel.app/api/live-data?ticker=${symbol}&type=quote`, {
        cache: 'no-store',
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const q = data.data;
          quotes.push({
            symbol: symbol,
            name: symbol,
            price: q.price || 0,
            change: q.change || 0,
            changePercent: q.changePercent || 0,
            volume: q.volume || 0,
            averageDailyVolume3Month: 0,
            relativeVolume: 1,
            marketState: 'REGULAR',
            marketCap: null,
            pe: null,
            high52Week: null,
            low52Week: null,
            lastUpdate: new Date().toISOString(),
            provider: 'fallback'
          });
        }
      }
    } catch (error) {
      console.warn(`Fallback quote for ${symbol} failed:`, error.message);
    }
  }
  
  console.log(`Fallback returned ${quotes.length} quotes`);
  return quotes;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { preset = 'momentum', limit = 50 } = req.query;
    console.log(`Scanner request: preset=${preset}, limit=${limit}`);
    
    // Debug API keys
    console.log('API Keys available:');
    console.log('IEX_CLOUD_KEY:', IEX_CLOUD_KEY ? 'YES' : 'NO');
    console.log('FINNHUB_KEY:', FINNHUB_KEY ? 'YES' : 'NO');
    console.log('FMP_KEY:', FMP_KEY ? 'YES' : 'NO');

    // Build universe (all tradable tickers) – cache for 1 day
    const universe = await loadUniverse();
    console.log(`Universe loaded: ${universe.length} symbols`);

    // Pick a provider fallback chain for quotes
    const providers = [];
    
    if (IEX_CLOUD_KEY) {
      console.log('Adding IEX provider');
      providers.push(() => quotesFromIEX(universe));
    }
    if (FINNHUB_KEY) {
      console.log('Adding Finnhub provider');
      providers.push(() => quotesFromFinnhub(universe));
    }
    if (FMP_KEY) {
      console.log('Adding FMP provider');
      providers.push(() => quotesFromFMP(universe));
    }
    
    console.log(`Total providers available: ${providers.length}`);

    if (providers.length === 0) {
      return res.status(200).json({ 
        success: false, 
        error: 'No API keys available', 
        data: { stocks: [] } 
      });
    }

    // Try providers in parallel, use first that returns data
    let quotes = [];
    const errors = [];
    
    for (const provider of providers) {
      try {
        quotes = await provider();
        if (quotes && quotes.length > 0) {
          console.log(`Provider succeeded with ${quotes.length} quotes`);
          break;
        }
      } catch (error) {
        console.warn('Provider failed:', error.message);
        errors.push(error.message);
      }
    }

    // If all providers failed, try fallback with individual quotes
    if (!quotes || quotes.length === 0) {
      console.log('All providers failed, trying fallback with individual quotes...');
      quotes = await fetchFallbackQuotes(universe.slice(0, 50)); // Limit to 50 for fallback
    }

    if (!quotes || quotes.length === 0) {
      return res.status(200).json({ 
        success: false, 
        error: 'No provider data', 
        message: `All providers failed: ${errors.join(', ')}`,
        data: { stocks: [] } 
      });
    }

    // Score/sort by preset (momentum, volume, earnings, etc.)
    const scored = scoreByPreset(quotes, preset)
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(limit));

    console.log(`Returning ${scored.length} scored stocks for preset: ${preset}`);

    return res.status(200).json({ 
      success: true, 
      data: { 
        stocks: scored, 
        refreshInterval: 10000,
        preset: preset,
        totalScanned: quotes.length
      } 
    });
  } catch (err) {
    console.error('Scanner error:', err);
    return res.status(200).json({ 
      success: false, 
      error: 'Internal server error', 
      message: String(err?.message || err), 
      data: { stocks: [] } 
    });
  }
}