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
  if (!IEX_CLOUD_KEY) throw new Error('IEX Cloud key not available');
  
  const quotes = [];
  const batchSize = 100;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const symbolsStr = batch.join(',');
    
    try {
      const response = await fetch(`https://cloud.iexapis.com/stable/stock/market/batch?symbols=${symbolsStr}&types=quote&token=${IEX_CLOUD_KEY}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        for (const [symbol, stockData] of Object.entries(data)) {
          if (stockData.quote) {
            const q = stockData.quote;
            quotes.push({
              symbol: symbol,
              name: q.companyName || symbol,
              price: q.latestPrice || 0,
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
    } catch (error) {
      console.warn(`IEX batch ${i}-${i + batchSize} failed:`, error.message);
    }
  }
  
  console.log(`IEX returned ${quotes.length} quotes`);
  return quotes;
}

async function quotesFromFinnhub(symbols) {
  if (!FINNHUB_KEY) throw new Error('Finnhub key not available');
  
  const quotes = [];
  
  for (const symbol of symbols.slice(0, 50)) { // Limit to 50 for rate limits
    try {
      const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`, { cache: 'no-store' });
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
      }
    } catch (error) {
      console.warn(`Finnhub quote for ${symbol} failed:`, error.message);
    }
  }
  
  console.log(`Finnhub returned ${quotes.length} quotes`);
  return quotes;
}

async function quotesFromFMP(symbols) {
  if (!FMP_KEY) throw new Error('FMP key not available');
  
  const quotes = [];
  const batchSize = 100;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const symbolsStr = batch.join(',');
    
    try {
      const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${symbolsStr}?apikey=${FMP_KEY}`, { cache: 'no-store' });
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
      }
    } catch (error) {
      console.warn(`FMP batch ${i}-${i + batchSize} failed:`, error.message);
    }
  }
  
  console.log(`FMP returned ${quotes.length} quotes`);
  return quotes;
}

// Score stocks by preset
function scoreByPreset(quotes, preset) {
  return quotes.map(quote => {
    let score = 0;
    const changePercent = Math.abs(quote.changePercent || 0);
    const volume = quote.volume || 0;
    const relativeVolume = quote.relativeVolume || 1;
    
    switch (preset) {
      case 'momentum':
        score = changePercent * 10 + (relativeVolume > 2 ? 50 : 0) + (volume > 1000000 ? 20 : 0);
        break;
      case 'volume':
        score = volume / 1000000 + (relativeVolume > 3 ? 100 : 0) + changePercent * 5;
        break;
      case 'earnings':
        score = changePercent * 15 + (relativeVolume > 1.5 ? 30 : 0) + (volume > 500000 ? 25 : 0);
        break;
      case 'gaps':
        score = changePercent * 20 + (relativeVolume > 2 ? 40 : 0) + (volume > 2000000 ? 30 : 0);
        break;
      case 'meme':
        score = changePercent * 25 + (relativeVolume > 5 ? 100 : 0) + (volume > 5000000 ? 50 : 0);
        break;
      default:
        score = changePercent * 10 + (relativeVolume > 1 ? 20 : 0) + (volume > 100000 ? 10 : 0);
    }
    
    return { ...quote, score };
  });
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

    // Build universe (all tradable tickers) – cache for 1 day
    const universe = await loadUniverse();
    console.log(`Universe loaded: ${universe.length} symbols`);

    // Pick a provider fallback chain for quotes
    const providers = [];
    
    if (IEX_CLOUD_KEY) providers.push(() => quotesFromIEX(universe));
    if (FINNHUB_KEY) providers.push(() => quotesFromFinnhub(universe));
    if (FMP_KEY) providers.push(() => quotesFromFMP(universe));

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