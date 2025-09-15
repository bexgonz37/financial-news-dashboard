// Comprehensive Symbol Master - All US-listed tickers and ETFs
import fetch from 'node-fetch';

let symbolMaster = null;
let symbolMasterTime = 0;
const SYMBOL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Company name aliases and common abbreviations
const COMPANY_ALIASES = {
  'AAPL': ['Apple', 'Apple Inc', 'Apple Computer', 'iPhone', 'iPad', 'Mac', 'iOS', 'App Store'],
  'MSFT': ['Microsoft', 'Microsoft Corp', 'Windows', 'Office', 'Azure', 'Xbox', 'LinkedIn', 'GitHub'],
  'GOOGL': ['Google', 'Alphabet', 'Alphabet Inc', 'YouTube', 'Android', 'Chrome', 'Gmail', 'Google Cloud'],
  'AMZN': ['Amazon', 'Amazon.com', 'AWS', 'Prime', 'Alexa', 'Amazon Web Services'],
  'TSLA': ['Tesla', 'Tesla Inc', 'Tesla Motors', 'Elon Musk', 'Model S', 'Model 3', 'Model X', 'Model Y', 'Cybertruck'],
  'META': ['Facebook', 'Meta', 'Meta Platforms', 'Instagram', 'WhatsApp', 'Oculus', 'Reality Labs'],
  'NVDA': ['NVIDIA', 'Nvidia', 'GPU', 'AI', 'Gaming', 'RTX', 'GeForce', 'CUDA', 'Data Center'],
  'NFLX': ['Netflix', 'Streaming', 'Netflix Inc'],
  'AMD': ['AMD', 'Advanced Micro Devices', 'Ryzen', 'Radeon', 'EPYC'],
  'INTC': ['Intel', 'Intel Corp', 'Core', 'Xeon', 'Pentium'],
  'JPM': ['JPMorgan', 'JPMorgan Chase', 'Chase', 'Bank', 'JPMorgan Chase & Co'],
  'JNJ': ['Johnson & Johnson', 'J&J', 'Johnson and Johnson'],
  'V': ['Visa', 'Credit Card', 'Visa Inc'],
  'PG': ['Procter & Gamble', 'P&G', 'Procter and Gamble'],
  'UNH': ['UnitedHealth', 'UnitedHealth Group', 'Health Insurance', 'Optum'],
  'HD': ['Home Depot', 'Hardware', 'Home Depot Inc'],
  'MA': ['Mastercard', 'Credit Card', 'Mastercard Inc'],
  'DIS': ['Disney', 'Walt Disney', 'ESPN', 'Hulu', 'Disney+', 'Marvel', 'Star Wars'],
  'PYPL': ['PayPal', 'Venmo', 'PayPal Holdings'],
  'ADBE': ['Adobe', 'Photoshop', 'PDF', 'Creative Suite', 'Adobe Inc'],
  'CRM': ['Salesforce', 'CRM', 'Salesforce Inc', 'Sales Cloud'],
  'NKE': ['Nike', 'Athletic', 'Shoes', 'Nike Inc', 'Air Jordan'],
  'ABT': ['Abbott', 'Medical', 'Abbott Laboratories'],
  'TMO': ['Thermo Fisher', 'Scientific', 'Thermo Fisher Scientific'],
  'ACN': ['Accenture', 'Consulting', 'Accenture Plc'],
  'COST': ['Costco', 'Wholesale', 'Costco Wholesale'],
  'DHR': ['Danaher', 'Life Sciences', 'Danaher Corp'],
  'VZ': ['Verizon', 'Wireless', 'Verizon Communications'],
  'NEE': ['NextEra', 'Energy', 'NextEra Energy', 'FPL'],
  'WMT': ['Walmart', 'Retail', 'Walmart Inc', 'Sam\'s Club'],
  'BAC': ['Bank of America', 'BofA', 'Bank of America Corp'],
  'XOM': ['Exxon', 'Mobil', 'Oil', 'Exxon Mobil'],
  'T': ['AT&T', 'Wireless', 'AT&T Inc', 'WarnerMedia'],
  'PFE': ['Pfizer', 'Pharmaceutical', 'Pfizer Inc'],
  'KO': ['Coca-Cola', 'Coke', 'Coca-Cola Co'],
  'PEP': ['PepsiCo', 'Pepsi', 'PepsiCo Inc', 'Frito-Lay'],
  'ABBV': ['AbbVie', 'Pharmaceutical', 'AbbVie Inc'],
  'CVX': ['Chevron', 'Oil', 'Chevron Corp'],
  'MRK': ['Merck', 'Pharmaceutical', 'Merck & Co'],
  'LLY': ['Eli Lilly', 'Lilly', 'Eli Lilly and Co'],
  'AVGO': ['Broadcom', 'Semiconductor', 'Broadcom Inc'],
  'TXN': ['Texas Instruments', 'TI', 'Texas Instruments Inc'],
  'QCOM': ['Qualcomm', 'Wireless', 'Qualcomm Inc'],
  'CHTR': ['Charter', 'Cable', 'Charter Communications'],
  'CMCSA': ['Comcast', 'Cable', 'Comcast Corp', 'NBC'],
  'COF': ['Capital One', 'Bank', 'Capital One Financial'],
  'GILD': ['Gilead', 'Biotech', 'Gilead Sciences'],
  'AMGN': ['Amgen', 'Biotech', 'Amgen Inc'],
  'HON': ['Honeywell', 'Industrial', 'Honeywell International'],
  'UNP': ['Union Pacific', 'Railroad', 'Union Pacific Corp'],
  'PLTR': ['Palantir', 'Data Analytics', 'Palantir Technologies'],
  'SOFI': ['SoFi', 'Fintech', 'SoFi Technologies'],
  'HOOD': ['Robinhood', 'Trading', 'Robinhood Markets'],
  'RBLX': ['Roblox', 'Gaming', 'Roblox Corp', 'Metaverse'],
  'COIN': ['Coinbase', 'Cryptocurrency', 'Coinbase Global', 'Bitcoin'],
  'SNOW': ['Snowflake', 'Data Cloud', 'Snowflake Inc'],
  'ZM': ['Zoom', 'Video Conferencing', 'Zoom Video Communications'],
  'DOCU': ['DocuSign', 'E-signature', 'DocuSign Inc'],
  'BB': ['BlackBerry', 'Security', 'BlackBerry Limited'],
  'NOK': ['Nokia', 'Telecommunications', 'Nokia Oyj', '5G']
};

// Load comprehensive symbol master from multiple sources
export async function loadSymbolMaster() {
  const now = Date.now();
  if (symbolMaster && (now - symbolMasterTime) < SYMBOL_CACHE_DURATION) {
    return symbolMaster;
  }

  console.log('Loading comprehensive symbol master...');
  
  const symbols = new Map();
  const errors = [];
  
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
                if (!symbols.has(symbol)) {
                  symbols.set(symbol, {
                    symbol,
                    companyName: stock.description || symbol,
                    exchange: stock.mic === 'XNAS' ? 'NASDAQ' : stock.mic === 'XNYS' ? 'NYSE' : 'AMEX',
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
      'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VEA', 'VWO', 'BND', 'TLT', 'GLD', 'SLV', 'USO', 'XLF', 'XLK', 'XLE', 'XLI', 'XLV', 'XLY', 'XLP', 'XLU', 'XLRE', 'XLB', 'XLC', 'XLK', 'XLY', 'XLP', 'XLU', 'XLRE', 'XLB', 'XLC'
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
      }
    }
    
    // Convert to array and sort
    const symbolArray = Array.from(symbols.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
    
    symbolMaster = symbolArray;
    symbolMasterTime = now;
    
    console.log(`Symbol master loaded: ${symbolArray.length} symbols (${errors.length} errors)`);
    if (errors.length > 0) {
      console.warn('Symbol loading errors:', errors);
    }
    
    return symbolArray;
    
  } catch (error) {
    console.error('Symbol master loading failed:', error);
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
  
  // Add predefined aliases
  if (COMPANY_ALIASES[symbol]) {
    COMPANY_ALIASES[symbol].forEach(alias => aliases.add(alias));
  }
  
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
