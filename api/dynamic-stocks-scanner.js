// Full Universe Scanner - All NYSE/Nasdaq/AMEX Stocks
const fetch = require('node-fetch');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// API Keys
const FMP_KEY = process.env.FMP_KEY;

// Cache for universe and quotes
let universeCache = {
  symbols: [],
  lastUpdate: 0
};

let quotesCache = {
  data: new Map(),
  lastUpdate: 0
};

const UNIVERSE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const QUOTES_CACHE_DURATION = 10 * 1000; // 10 seconds

// Fetch full universe of stocks
async function fetchFullUniverse() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (universeCache.symbols.length > 0 && (now - universeCache.lastUpdate) < UNIVERSE_CACHE_DURATION) {
    console.log(`Using cached universe: ${universeCache.symbols.length} symbols`);
    return universeCache.symbols;
  }

  console.log('Fetching full universe of stocks...');
  const allSymbols = new Set();

  try {
    if (FMP_KEY) {
      // Fetch from FMP - all exchanges
      const exchanges = ['nasdaq', 'nyse', 'amex'];
      
      for (const exchange of exchanges) {
        try {
          const response = await fetch(`https://financialmodelingprep.com/api/v3/${exchange}_constituent?apikey=${FMP_KEY}`, {
            cache: 'no-store'
          });
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              data.forEach(stock => {
                if (stock.symbol && stock.name && stock.type === 'stock') {
                  allSymbols.add(stock.symbol);
                }
              });
              console.log(`${exchange.toUpperCase()}: ${data.length} stocks`);
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch ${exchange} stocks:`, error.message);
        }
      }
    } else {
      // Fallback: Use a comprehensive list of major stocks
      const majorStocks = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'BRK-B', 'UNH', 'JNJ',
        'V', 'PG', 'JPM', 'MA', 'HD', 'DIS', 'PYPL', 'ADBE', 'NFLX', 'CRM',
        'INTC', 'CMCSA', 'PFE', 'TMO', 'ABT', 'COST', 'PEP', 'CSCO', 'AVGO', 'ACN',
        'WMT', 'DHR', 'VZ', 'NKE', 'ADBE', 'TXN', 'QCOM', 'NEE', 'HON', 'UNP',
        'IBM', 'LMT', 'AMGN', 'T', 'SPGI', 'RTX', 'ORCL', 'CAT', 'GS', 'AXP',
        'BA', 'MMM', 'CVX', 'XOM', 'JNJ', 'KO', 'MCD', 'WBA', 'CL', 'KMB',
        'GE', 'F', 'GM', 'BAC', 'C', 'WFC', 'JPM', 'USB', 'PNC', 'TFC',
        'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VEA', 'VWO', 'BND', 'TLT', 'GLD'
      ];
      
      majorStocks.forEach(symbol => allSymbols.add(symbol));
      console.log(`Fallback: Using ${majorStocks.length} major stocks`);
    }

    // Convert to array and sort
    const symbols = Array.from(allSymbols).sort();
    
    // Update cache
    universeCache = {
      symbols: symbols,
      lastUpdate: now
    };

    console.log(`Full universe loaded: ${symbols.length} symbols`);
    return symbols;

  } catch (error) {
    console.error('Universe fetch error:', error.message);
    
    // Return fallback if all else fails
    const fallbackSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'];
    universeCache = {
      symbols: fallbackSymbols,
      lastUpdate: now
    };
    return fallbackSymbols;
  }
}

// Fetch quotes for multiple symbols in batches
async function fetchQuotesBatch(symbols) {
  const now = Date.now();
  
  // Check cache first
  if (quotesCache.data.size > 0 && (now - quotesCache.lastUpdate) < QUOTES_CACHE_DURATION) {
    const cachedQuotes = [];
    symbols.forEach(symbol => {
      if (quotesCache.data.has(symbol)) {
        cachedQuotes.push(quotesCache.data.get(symbol));
      }
    });
    if (cachedQuotes.length > 0) {
      console.log(`Using cached quotes: ${cachedQuotes.length}/${symbols.length}`);
      return cachedQuotes;
    }
  }

  console.log(`Fetching quotes for ${symbols.length} symbols...`);
  
  try {
    // Yahoo Finance allows up to 200 symbols per request
    const batchSize = 200;
    const batches = [];
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      batches.push(symbols.slice(i, i + batchSize));
    }

    const allQuotes = [];
    
    for (const batch of batches) {
      try {
        const symbolsStr = batch.join(',');
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolsStr)}`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          cache: 'no-store'
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.quoteResponse && data.quoteResponse.result) {
            const quotes = data.quoteResponse.result.map(quote => {
              const price = quote.regularMarketPrice || quote.preMarketPrice || quote.postMarketPrice || 0;
              const previousClose = quote.regularMarketPreviousClose || price;
              const change = price - previousClose;
              const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
              const volume = quote.regularMarketVolume || 0;
              const avgVolume = quote.averageDailyVolume3Month || 0;
              const relativeVolume = avgVolume > 0 ? volume / avgVolume : 0;
              
              // Determine market state
              let marketState = 'REGULAR';
              if (quote.marketState === 'PRE' || quote.preMarketPrice) {
                marketState = 'PRE';
              } else if (quote.marketState === 'POST' || quote.postMarketPrice) {
                marketState = 'POST';
              } else if (quote.marketState === 'CLOSED') {
                marketState = 'CLOSED';
              }

              const quoteData = {
                symbol: quote.symbol,
                name: quote.longName || quote.shortName || quote.symbol,
                price: Number(price.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: Math.floor(volume),
                averageDailyVolume3Month: Math.floor(avgVolume),
                relativeVolume: Number(relativeVolume.toFixed(2)),
                marketState: marketState,
                marketCap: quote.marketCap || null,
                pe: quote.trailingPE || null,
                high52Week: quote.fiftyTwoWeekHigh || null,
                low52Week: quote.fiftyTwoWeekLow || null,
                lastUpdate: new Date().toISOString()
              };

              // Cache the quote
              quotesCache.data.set(quote.symbol, quoteData);
              
              return quoteData;
            });

            allQuotes.push(...quotes);
            console.log(`Batch processed: ${quotes.length} quotes`);
          }
        }
      } catch (error) {
        console.warn(`Batch fetch error:`, error.message);
      }
    }

    // Update cache timestamp
    quotesCache.lastUpdate = now;

    console.log(`Total quotes fetched: ${allQuotes.length}`);
    return allQuotes;

  } catch (error) {
    console.error('Quotes fetch error:', error.message);
    return [];
  }
}

// Calculate advanced metrics and score stocks
function calculateAdvancedMetrics(quotes) {
  return quotes.map(quote => {
    const score = Math.abs(quote.changePercent) + (quote.relativeVolume * 0.1);
    
    return {
      ...quote,
      score: Number(score.toFixed(2)),
      // Additional metrics
      isGainer: quote.changePercent > 0,
      isLoser: quote.changePercent < 0,
      isHighVolume: quote.relativeVolume > 2,
      isOversold: quote.changePercent < -5,
      isOverbought: quote.changePercent > 5,
      isBreakout: quote.changePercent > 3,
      isShortSqueeze: quote.relativeVolume > 2 && quote.changePercent > 5
    };
  });
}

// Apply scanner presets
function applyPreset(quotes, preset, limit) {
  let filtered = [...quotes];

  switch (preset) {
    case 'momentum':
      filtered = filtered
        .filter(q => Math.abs(q.changePercent) > 0.5) // At least 0.5% change
        .sort((a, b) => b.score - a.score);
      break;
      
    case 'volume':
      filtered = filtered
        .filter(q => q.volume > 100000) // At least 100k volume
        .sort((a, b) => b.volume - a.volume);
      break;
      
    case 'gainers':
      filtered = filtered
        .filter(q => q.changePercent > 0.5)
        .sort((a, b) => b.changePercent - a.changePercent);
      break;
      
    case 'losers':
      filtered = filtered
        .filter(q => q.changePercent < -0.5)
        .sort((a, b) => a.changePercent - b.changePercent);
      break;
      
    case 'oversold':
      filtered = filtered
        .filter(q => q.changePercent < -2 && q.relativeVolume > 1)
        .sort((a, b) => a.changePercent - b.changePercent);
      break;
      
    case 'breakout':
      filtered = filtered
        .filter(q => q.changePercent > 3 && q.relativeVolume > 1.5)
        .sort((a, b) => b.changePercent - a.changePercent);
      break;
      
    case 'after_hours':
      filtered = filtered
        .filter(q => q.marketState === 'POST' || q.marketState === 'PRE')
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
      break;
      
    case 'short_squeeze':
      filtered = filtered
        .filter(q => q.relativeVolume > 2 && q.changePercent > 5)
        .sort((a, b) => b.score - a.score);
      break;
      
    default:
      // Default to momentum
      filtered = filtered
        .filter(q => Math.abs(q.changePercent) > 0.5)
        .sort((a, b) => b.score - a.score);
  }

  return filtered.slice(0, limit);
}

// Main scanner function
async function fetchLiveScannerData(preset, limit) {
  try {
    console.log(`=== FULL UNIVERSE SCANNER: ${preset} ===`);
    
    // Get full universe
    const universe = await fetchFullUniverse();
    console.log(`Universe size: ${universe.length} symbols`);
    
    // For performance, limit to top symbols if universe is too large
    const symbolsToScan = universe.length > 1000 ? universe.slice(0, 1000) : universe;
    console.log(`Scanning ${symbolsToScan.length} symbols`);
    
    // Fetch quotes
    const quotes = await fetchQuotesBatch(symbolsToScan);
    console.log(`Quotes fetched: ${quotes.length}`);
    
    if (quotes.length === 0) {
      throw new Error('No quotes available');
    }
    
    // Calculate advanced metrics
    const enhancedQuotes = calculateAdvancedMetrics(quotes);
    
    // Apply preset filtering
    const filteredQuotes = applyPreset(enhancedQuotes, preset, limit);
    
    console.log(`Filtered results: ${filteredQuotes.length} stocks`);
    return filteredQuotes;
    
  } catch (error) {
    console.error('Scanner error:', error.message);
    throw error;
  }
}

export default async function handler(req, res) {
  try {
    const { preset = 'momentum', limit = 50 } = req.query;
    
    console.log('=== FULL UNIVERSE SCANNER API ===');
    console.log('Request params:', { preset, limit });

    // Fetch live scanner data
    const stocks = await fetchLiveScannerData(preset, parseInt(limit));
    
    console.log(`Generated ${stocks.length} stocks`);
    console.log('Sample stocks:', stocks.slice(0, 3));

    return res.status(200).json({
      success: true,
      data: {
        stocks: stocks,
        preset: preset,
        count: stocks.length,
        lastUpdate: new Date().toISOString(),
        refreshInterval: 15000 // 15 seconds
      }
    });

  } catch (error) {
    console.error('Scanner API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}