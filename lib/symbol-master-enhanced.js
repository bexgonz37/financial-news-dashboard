// Enhanced Symbol Master - Professional Day Trading Dashboard
// Loads comprehensive US market data from multiple providers with retry logic

let symbolMaster = null;
let symbolMasterTime = 0;
const SYMBOL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// NO HARDCODED ALIASES - Use live symbol master only to prevent mega-cap bias

// Load comprehensive symbol master from multiple sources with retry logic
export async function loadSymbolMaster() {
  const now = Date.now();
  if (symbolMaster && (now - symbolMasterTime) < SYMBOL_CACHE_DURATION) {
    return symbolMaster;
  }

  console.log('🔄 Loading comprehensive symbol master from live sources...');
  
  const symbols = new Map();
  const errors = [];
  const exchangeCounts = { NASDAQ: 0, NYSE: 0, AMEX: 0, ETF: 0, OTHER: 0 };
  const maxRetries = 3;
  
  // Helper function to retry API calls with exponential backoff
  async function retryApiCall(apiCall, providerName, retries = maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`  ${providerName} attempt ${attempt}/${retries}...`);
        const result = await apiCall();
        if (result && result.length > 0) {
          console.log(`  ✅ ${providerName} success: ${result.length} symbols`);
          return result;
        }
      } catch (error) {
        console.warn(`  ⚠️ ${providerName} attempt ${attempt} failed:`, error.message);
        if (attempt === retries) {
          errors.push(`${providerName}: ${error.message}`);
        } else {
          // Exponential backoff: 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    return [];
  }
  
  try {
    // Try FMP first for comprehensive data
    if (process.env.FMP_KEY) {
      const fmpSymbols = await retryApiCall(async () => {
        const response = await fetch(`https://financialmodelingprep.com/api/v3/stock/list?apikey=${process.env.FMP_KEY}`, { 
          cache: 'no-store',
          headers: {
            'User-Agent': 'FinancialNewsDashboard/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format');
        }
        
        return data.filter(stock => 
          stock.symbol && 
          stock.exchange && 
          ['NASDAQ', 'NYSE', 'AMEX', 'NYSEARCA', 'NYSEMKT'].includes(stock.exchange) &&
          stock.type === 'stock' && 
          stock.isActivelyTrading
        );
      }, 'FMP');
      
      fmpSymbols.forEach(stock => {
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
      });
    }
    
    // Try Finnhub as backup
    if (process.env.FINNHUB_KEY) {
      const finnhubSymbols = await retryApiCall(async () => {
        const response = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${process.env.FINNHUB_KEY}`, { 
          cache: 'no-store',
          headers: {
            'User-Agent': 'FinancialNewsDashboard/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format');
        }
        
        return data.filter(stock => 
          stock.symbol && 
          stock.description && 
          stock.type &&
          ['Common Stock', 'ETF', 'REIT', 'ADR'].includes(stock.type)
        );
      }, 'Finnhub');
      
      finnhubSymbols.forEach(stock => {
        const symbol = stock.symbol.toUpperCase();
        const exchange = stock.mic || 'UNKNOWN';
        
        // Only add if not already added by FMP or if it's a different type
        if (!symbols.has(symbol) || symbols.get(symbol).type !== stock.type) {
          symbols.set(symbol, {
            symbol,
            companyName: stock.description,
            exchange,
            isActive: true,
            aliases: generateAliases(stock.description),
            sector: 'Unknown',
            industry: 'Unknown',
            type: stock.type,
            source: 'Finnhub'
          });
          exchangeCounts[exchange] = (exchangeCounts[exchange] || 0) + 1;
        }
      });
    }
    
    // Convert to array and sort
    const symbolArray = Array.from(symbols.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
    
    // NO FALLBACK DATA - If no symbols loaded, throw error
    if (symbolArray.length === 0) {
      const error = new Error(`No symbols loaded from any provider. Errors: ${errors.join(', ')}`);
      console.error('❌ Symbol master loading failed completely:', error);
      throw error;
    }
    
    symbolMaster = symbolArray;
    symbolMasterTime = now;
    
    // Comprehensive health logging
    console.log(`✅ Symbol master loaded: ${symbolMaster.length} symbols total`);
    
    // Log breakdown by exchange
    console.log('📊 Exchange breakdown:', exchangeCounts);
    
    // Log breakdown by source
    const sourceBreakdown = symbolMaster.reduce((acc, s) => {
      acc[s.source] = (acc[s.source] || 0) + 1;
      return acc;
    }, {});
    console.log('🔗 Source breakdown:', sourceBreakdown);
    
    // Log breakdown by type
    const typeBreakdown = symbolMaster.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {});
    console.log('📈 Type breakdown:', typeBreakdown);
    
    if (errors.length > 0) {
      console.warn('⚠️ Provider errors (partial data):', errors);
    }
    
    return symbolMaster;
    
  } catch (error) {
    console.error('❌ Symbol master loading failed:', error);
    throw error;
  }
}

// Generate aliases from company name
function generateAliases(companyName, symbol) {
  if (!companyName) return [];
  
  const aliases = new Set();
  const name = companyName.trim();
  
  // Add the full company name
  aliases.add(name);
  
  // Add common variations
  const variations = [
    name.replace(/\s+(Inc|Corp|Corporation|Company|Co|Ltd|Limited|LLC|LP|L\.P\.|L\.L\.C\.)$/i, ''),
    name.replace(/\s+(Inc|Corp|Corporation|Company|Co|Ltd|Limited|LLC|LP|L\.P\.|L\.L\.C\.)$/i, '').replace(/\s+/g, ''),
    name.split(' ')[0], // First word
    name.split(' ').slice(0, 2).join(' '), // First two words
  ];
  
  variations.forEach(variation => {
    if (variation && variation.length > 2) {
      aliases.add(variation);
    }
  });
  
  // Add symbol if provided
  if (symbol) {
    aliases.add(symbol);
  }
  
  return Array.from(aliases);
}

// Get symbol by ticker
export function getSymbol(ticker) {
  if (!symbolMaster) return null;
  return symbolMaster.find(s => s.symbol === ticker.toUpperCase());
}

// Search symbols by name or ticker
export function searchSymbols(query, limit = 10) {
  if (!symbolMaster || !query) return [];
  
  const queryLower = query.toLowerCase();
  const results = [];
  
  for (const symbol of symbolMaster) {
    if (results.length >= limit) break;
    
    // Exact symbol match
    if (symbol.symbol.toLowerCase() === queryLower) {
      results.unshift(symbol);
      continue;
    }
    
    // Company name match
    if (symbol.companyName.toLowerCase().includes(queryLower)) {
      results.push(symbol);
      continue;
    }
    
    // Alias match
    if (symbol.aliases.some(alias => alias.toLowerCase().includes(queryLower))) {
      results.push(symbol);
      continue;
    }
  }
  
  return results;
}

// Get all symbols (for scanners)
export function getAllSymbols() {
  return symbolMaster || [];
}

// Get symbols by exchange
export function getSymbolsByExchange(exchange) {
  if (!symbolMaster) return [];
  return symbolMaster.filter(s => s.exchange === exchange);
}

// Get symbols by sector
export function getSymbolsBySector(sector) {
  if (!symbolMaster) return [];
  return symbolMaster.filter(s => s.sector === sector);
}

// Health check
export function getSymbolMasterHealth() {
  return {
    loaded: !!symbolMaster,
    count: symbolMaster ? symbolMaster.length : 0,
    lastUpdate: symbolMasterTime ? new Date(symbolMasterTime).toISOString() : null,
    age: symbolMasterTime ? Date.now() - symbolMasterTime : null,
    stale: symbolMasterTime ? (Date.now() - symbolMasterTime) > SYMBOL_CACHE_DURATION : true
  };
}

// Force refresh
export async function refreshSymbolMaster() {
  symbolMaster = null;
  symbolMasterTime = 0;
  return await loadSymbolMaster();
}

// Initialize symbol master
export async function initializeSymbolMaster() {
  if (!symbolMaster) {
    await loadSymbolMaster();
  }
  return symbolMaster;
}
