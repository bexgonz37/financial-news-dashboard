// Symbols API - returns full US listed universe
import { FMPProvider } from '../lib/providers/fmp.js';
import { FinnhubProvider } from '../lib/providers/finnhub.js';

let universeCache = null;
let universeCacheTime = 0;
const UNIVERSE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function loadUniverse() {
  const now = Date.now();
  if (universeCache && (now - universeCacheTime) < UNIVERSE_CACHE_DURATION) {
    return universeCache;
  }

  console.log('Loading full US listed universe...');
  
  try {
    // Try FMP first for comprehensive list
    if (process.env.FMP_KEY) {
      const fmp = new FMPProvider(process.env.FMP_KEY);
      const response = await fetch(`https://financialmodelingprep.com/api/v3/stock/list?apikey=${process.env.FMP_KEY}`, { 
        cache: 'no-store' 
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const symbols = data
            .filter(stock => 
              stock.symbol && 
              stock.exchange && 
              ['NASDAQ', 'NYSE', 'AMEX'].includes(stock.exchange) &&
              stock.type === 'stock' &&
              stock.isActivelyTrading
            )
            .map(stock => ({
              symbol: stock.symbol,
              name: stock.name,
              exchange: stock.exchange,
              sector: stock.sector || 'Unknown',
              industry: stock.industry || 'Unknown',
              marketCap: stock.marketCap || null,
              price: stock.price || null,
              volume: stock.volume || 0,
              avgVolume: stock.avgVolume || 0,
              float: stock.sharesFloat || null,
              isActivelyTrading: stock.isActivelyTrading || false
            }))
            .slice(0, 5000); // Limit to 5000 for performance
          
          universeCache = symbols;
          universeCacheTime = now;
          console.log(`Loaded universe: ${symbols.length} symbols from FMP`);
          return symbols;
        }
      }
    }

    // Try Finnhub as fallback
    if (process.env.FINNHUB_KEY) {
      console.log('FMP failed, trying Finnhub for universe...');
      const response = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${process.env.FINNHUB_KEY}`, { 
        cache: 'no-store' 
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const symbols = data
            .filter(stock => 
              stock.symbol && 
              stock.type === 'Common Stock' &&
              stock.mic &&
              ['XNAS', 'XNYS', 'XASE'].includes(stock.mic)
            )
            .map(stock => ({
              symbol: stock.symbol,
              name: stock.description || stock.symbol,
              exchange: stock.mic === 'XNAS' ? 'NASDAQ' : 
                       stock.mic === 'XNYS' ? 'NYSE' : 
                       stock.mic === 'XASE' ? 'AMEX' : 'Unknown',
              sector: 'Unknown',
              industry: 'Unknown',
              marketCap: null,
              price: null,
              volume: 0,
              avgVolume: 0,
              float: null,
              isActivelyTrading: true
            }))
            .slice(0, 3000); // Limit to 3000 for performance
          
          universeCache = symbols;
          universeCacheTime = now;
          console.log(`Loaded universe: ${symbols.length} symbols from Finnhub`);
          return symbols;
        }
      }
    }
    
    // NO FALLBACK DATA - All providers failed
    console.error('All API providers failed, no symbols available');
    throw new Error('No live symbol data available from any provider');
  } catch (error) {
    console.error('Failed to load universe:', error);
    throw error; // Re-throw the original error
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { 
      limit = 1000,
      exchange = null,
      sector = null,
      minMarketCap = null,
      maxMarketCap = null
    } = req.query;

    const universe = await loadUniverse();
    
    // Apply filters
    let filtered = universe;
    
    if (exchange) {
      filtered = filtered.filter(s => s.exchange === exchange);
    }
    
    if (sector) {
      filtered = filtered.filter(s => s.sector === sector);
    }
    
    if (minMarketCap) {
      const min = parseFloat(minMarketCap);
      filtered = filtered.filter(s => s.marketCap && s.marketCap >= min);
    }
    
    if (maxMarketCap) {
      const max = parseFloat(maxMarketCap);
      filtered = filtered.filter(s => s.marketCap && s.marketCap <= max);
    }
    
    // Limit results
    const limited = filtered.slice(0, parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: {
        symbols: limited,
        total: limited.length,
        filters: {
          limit: parseInt(limit),
          exchange,
          sector,
          minMarketCap,
          maxMarketCap
        },
        lastUpdate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Symbols API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load symbols',
      message: error.message,
      data: { symbols: [] }
    });
  }
}
