// Comprehensive Symbol Master - All US-listed tickers and ETFs
import fetch from 'node-fetch';

let symbolMaster = null;
let symbolMasterTime = 0;
const SYMBOL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// NO HARDCODED ALIASES - Use live symbol master only to prevent mega-cap bias

// Load comprehensive symbol master from multiple sources
export async function loadSymbolMaster() {
  const now = Date.now();
  if (symbolMaster && (now - symbolMasterTime) < SYMBOL_CACHE_DURATION) {
    return symbolMaster;
  }

  console.log('Loading comprehensive symbol master...');
  
  const symbols = new Map();
  const errors = [];
  const exchangeCounts = { NASDAQ: 0, NYSE: 0, AMEX: 0, ETF: 0 };
  
  try {
    // Try FMP first for comprehensive data
    if (process.env.FMP_KEY) {
      try {
        const response = await fetch(`https://financialmodelingprep.com/api/v3/stock/list?apikey=${process.env.FMP_KEY}`, { 
          cache: 'no-store',
          timeout: 30000
        });
        
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            console.log(`FMP returned ${data.length} symbols`);
            
            for (const stock of data) {
              if (stock.symbol && stock.exchange && 
                  ['NASDAQ', 'NYSE', 'AMEX'].includes(stock.exchange) &&
                  stock.type === 'stock' && stock.isActivelyTrading) {
                
                const symbol = stock.symbol.toUpperCase();
                symbols.set(symbol, {
                  symbol,
                  companyName: stock.name || symbol,
                  exchange: stock.exchange,
                  isActive: stock.isActivelyTrading || true,
                  aliases: generateAliases(stock.name, symbol),
                  sector: stock.sector || 'Unknown',
                  industry: stock.industry || 'Unknown',
                  marketCap: stock.marketCap || null,
                  country: stock.country || 'US',
                  currency: stock.currency || 'USD',
                  type: 'stock',
                  source: 'FMP'
                });
                exchangeCounts[stock.exchange]++;
              }
            }
            console.log(`FMP processed: ${symbols.size} symbols`);
          }
        }
      } catch (error) {
        console.warn('FMP symbol loading failed:', error.message);
        errors.push(`FMP: ${error.message}`);
      }
    }
    
    // Try Finnhub for additional coverage
    if (process.env.FINNHUB_KEY) {
      try {
        const response = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${process.env.FINNHUB_KEY}`, { 
          cache: 'no-store',
          timeout: 30000
        });
        
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            console.log(`Finnhub returned ${data.length} symbols`);
            
            for (const stock of data) {
              if (stock.symbol && stock.type === 'Common Stock' && stock.mic && 
                  ['XNAS', 'XNYS', 'XASE'].includes(stock.mic)) {
                
                const symbol = stock.symbol.toUpperCase();
                const exchange = stock.mic === 'XNAS' ? 'NASDAQ' : stock.mic === 'XNYS' ? 'NYSE' : 'AMEX';
                
                if (!symbols.has(symbol)) {
                  symbols.set(symbol, {
                    symbol,
                    companyName: stock.description || symbol,
                    exchange: exchange,
                    isActive: true,
                    aliases: generateAliases(stock.description, symbol),
                    sector: 'Unknown',
                    industry: 'Unknown',
                    marketCap: null,
                    country: 'US',
                    currency: stock.currency || 'USD',
                    type: 'stock',
                    source: 'Finnhub'
                  });
                  exchangeCounts[exchange]++;
                }
              }
            }
            console.log(`Finnhub processed: ${symbols.size} total symbols`);
          }
        }
      } catch (error) {
        console.warn('Finnhub symbol loading failed:', error.message);
        errors.push(`Finnhub: ${error.message}`);
      }
    }
    
    // Add major ETFs
    const majorETFs = [
      'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VEA', 'VWO', 'BND', 'TLT', 'GLD', 'SLV', 'USO', 
      'XLF', 'XLK', 'XLE', 'XLI', 'XLV', 'XLY', 'XLP', 'XLU', 'XLRE', 'XLB', 'XLC'
    ];
    
    for (const etf of majorETFs) {
      if (!symbols.has(etf)) {
        symbols.set(etf, {
          symbol: etf,
          companyName: getETFName(etf),
          exchange: 'NYSE',
          isActive: true,
          aliases: [etf],
          sector: 'ETF',
          industry: 'Exchange Traded Fund',
          marketCap: null,
          country: 'US',
          currency: 'USD',
          type: 'etf',
          source: 'Manual'
        });
        exchangeCounts.ETF++;
      }
    }
    
    // Convert to array and sort
    const symbolArray = Array.from(symbols.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
    
    // NO FALLBACK DATA - If no symbols loaded, throw error
    if (symbolArray.length === 0) {
      const error = new Error('No symbols loaded from any provider');
      console.error('Symbol master loading failed completely:', error);
      throw error;
    }
    
    symbolMaster = symbolArray;
    
    symbolMasterTime = now;
    
    // Health logging
    console.log(`Symbol master loaded: ${symbolMaster.length} symbols total`);
    console.log(`Exchange breakdown: NASDAQ=${exchangeCounts.NASDAQ}, NYSE=${exchangeCounts.NYSE}, AMEX=${exchangeCounts.AMEX}, ETF=${exchangeCounts.ETF}`);
    console.log(`Sources: FMP=${process.env.FMP_KEY ? 'OK' : 'MISSING'}, Finnhub=${process.env.FINNHUB_KEY ? 'OK' : 'MISSING'}`);
    if (errors.length > 0) {
      console.warn('Symbol loading errors:', errors);
    }
    
    return symbolMaster;
    
  } catch (error) {
    console.error('Symbol master loading failed:', error);
    console.error('Error details:', error.message, error.stack);
    // Return empty array on complete failure
    return [];
  }
}

// Generate aliases for a company
function generateAliases(companyName, symbol) {
  const aliases = new Set([symbol]);
  
  if (companyName) {
    // Add full company name
    aliases.add(companyName);
    
    // Add common variations
    const variations = [
      companyName.replace(/[.,]/g, ''), // Remove punctuation
      companyName.replace(/\s+(Inc|Corp|Corporation|Company|Co|Ltd|Limited|LLC|LP|Holdings|Group|Technologies|Technologies Inc|Technologies Corp|Technologies Corporation|Technologies Company|Technologies Co|Technologies Ltd|Technologies Limited|Technologies LLC|Technologies LP|Technologies Holdings|Technologies Group)$/i, ''), // Remove common suffixes
      companyName.replace(/\s+/g, ''), // Remove spaces
      companyName.replace(/[^a-zA-Z0-9]/g, ''), // Remove all non-alphanumeric
    ];
    
    variations.forEach(variation => {
      if (variation && variation.length > 2) {
        aliases.add(variation);
      }
    });
  }
  
  // NO HARDCODED ALIASES - Use only generated aliases from company name
  
  return Array.from(aliases);
}

// Get ETF name
function getETFName(symbol) {
  const etfNames = {
    'SPY': 'SPDR S&P 500 ETF Trust',
    'QQQ': 'Invesco QQQ Trust',
    'IWM': 'iShares Russell 2000 ETF',
    'DIA': 'SPDR Dow Jones Industrial Average ETF Trust',
    'VTI': 'Vanguard Total Stock Market ETF',
    'VEA': 'Vanguard FTSE Developed Markets ETF',
    'VWO': 'Vanguard FTSE Emerging Markets ETF',
    'BND': 'Vanguard Total Bond Market ETF',
    'TLT': 'iShares 20+ Year Treasury Bond ETF',
    'GLD': 'SPDR Gold Trust',
    'SLV': 'iShares Silver Trust',
    'USO': 'United States Oil Fund LP',
    'XLF': 'Financial Select Sector SPDR Fund',
    'XLK': 'Technology Select Sector SPDR Fund',
    'XLE': 'Energy Select Sector SPDR Fund',
    'XLI': 'Industrial Select Sector SPDR Fund',
    'XLV': 'Health Care Select Sector SPDR Fund',
    'XLY': 'Consumer Discretionary Select Sector SPDR Fund',
    'XLP': 'Consumer Staples Select Sector SPDR Fund',
    'XLU': 'Utilities Select Sector SPDR Fund',
    'XLRE': 'Real Estate Select Sector SPDR Fund',
    'XLB': 'Materials Select Sector SPDR Fund',
    'XLC': 'Communication Services Select Sector SPDR Fund'
  };
  
  return etfNames[symbol] || `${symbol} ETF`;
}

// Get symbol by ticker
export function getSymbol(ticker) {
  if (!symbolMaster) return null;
  return symbolMaster.find(s => s.symbol === ticker.toUpperCase());
}

// Search symbols by name or ticker
export function searchSymbols(query) {
  if (!symbolMaster || !query) return [];
  
  const queryLower = query.toLowerCase();
  return symbolMaster.filter(symbol => 
    symbol.symbol.toLowerCase().includes(queryLower) ||
    symbol.companyName.toLowerCase().includes(queryLower) ||
    symbol.aliases.some(alias => alias.toLowerCase().includes(queryLower))
  );
}

// Get all active symbols
export function getAllActiveSymbols() {
  if (!symbolMaster) return [];
  return symbolMaster.filter(s => s.isActive);
}

// Get symbols by exchange
export function getSymbolsByExchange(exchange) {
  if (!symbolMaster) return [];
  return symbolMaster.filter(s => s.exchange === exchange && s.isActive);
}

// Get symbols by sector
export function getSymbolsBySector(sector) {
  if (!symbolMaster) return [];
  return symbolMaster.filter(s => s.sector === sector && s.isActive);
}
