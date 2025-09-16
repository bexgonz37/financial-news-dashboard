// Company master lookup for ticker resolution
import fmpLimiter from '../lib/fmp-limiter.js';

export const dynamic = 'force-dynamic';
export const revalidate = 21600; // Cache for 6 hours

let companyMaster = null;
let lastFetch = 0;
const CACHE_DURATION = 21600 * 1000; // 6 hours

async function fetchCompanyMaster() {
  const now = Date.now();
  
  // Return cached data if less than 6 hours old
  if (companyMaster && (now - lastFetch) < CACHE_DURATION) {
    return companyMaster;
  }
  
  try {
    const fmpKey = process.env.FMP_KEY;
    if (!fmpKey) {
      throw new Error('FMP_KEY not configured');
    }
    
    // Fetch company master list from FMP through limiter
    const url = `https://financialmodelingprep.com/api/v3/stock/list?apikey=${fmpKey}`;
    const response = await fmpLimiter.makeRequest(url);
    
    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Build lookup maps
    const symbolToName = new Map();
    const nameToSymbol = new Map();
    const symbolToExchange = new Map();
    
    data.forEach(company => {
      if (company.symbol && company.name) {
        const symbol = company.symbol.toUpperCase();
        const name = company.name.toLowerCase();
        const exchange = company.exchangeShortName || 'UNKNOWN';
        
        symbolToName.set(symbol, company.name);
        nameToSymbol.set(name, symbol);
        symbolToExchange.set(symbol, exchange);
        
        // Add common variations
        const shortName = company.name.split(' ')[0].toLowerCase();
        if (shortName !== name) {
          nameToSymbol.set(shortName, symbol);
        }
      }
    });
    
    companyMaster = {
      symbolToName,
      nameToSymbol,
      symbolToExchange,
      lastUpdate: now,
      totalCompanies: data.length
    };
    
    lastFetch = now;
    return companyMaster;
    
  } catch (error) {
    console.error('Failed to fetch company master from FMP:', error);
    
    // Try Finnhub fallback
    try {
      const finnhubKey = process.env.FINNHUB_KEY;
      if (finnhubKey) {
        console.log('Trying Finnhub fallback for company master...');
        const finnhubUrl = `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${finnhubKey}`;
        const finnhubResponse = await fetch(finnhubUrl);
        
        if (finnhubResponse.ok) {
          const finnhubData = await finnhubResponse.json();
          
          // Build minimal master from Finnhub
          const symbolToName = new Map();
          const nameToSymbol = new Map();
          const symbolToExchange = new Map();
          
          finnhubData.forEach(company => {
            if (company.symbol && company.description) {
              const symbol = company.symbol.toUpperCase();
              const name = company.description.toLowerCase();
              const exchange = company.exchange || 'UNKNOWN';
              
              symbolToName.set(symbol, company.description);
              nameToSymbol.set(name, symbol);
              symbolToExchange.set(symbol, exchange);
            }
          });
          
          companyMaster = {
            symbolToName,
            nameToSymbol,
            symbolToExchange,
            lastUpdate: now,
            totalCompanies: finnhubData.length,
            source: 'finnhub_fallback'
          };
          
          lastFetch = now;
          return companyMaster;
        }
      }
    } catch (finnhubError) {
      console.error('Finnhub fallback also failed:', finnhubError);
    }
    
    // Return empty fallback data
    return {
      symbolToName: new Map(),
      nameToSymbol: new Map(),
      symbolToExchange: new Map(),
      lastUpdate: now,
      totalCompanies: 0,
      error: error.message
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const master = await fetchCompanyMaster();
    
    // Convert Maps to objects for JSON serialization
    const response = {
      success: true,
      data: {
        symbolToName: Object.fromEntries(master.symbolToName),
        nameToSymbol: Object.fromEntries(master.nameToSymbol),
        symbolToExchange: Object.fromEntries(master.symbolToExchange),
        lastUpdate: master.lastUpdate,
        totalCompanies: master.totalCompanies,
        error: master.error || null
      }
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Company master API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch company master',
      message: error.message
    });
  }
}
