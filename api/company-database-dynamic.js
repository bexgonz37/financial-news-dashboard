// Dynamic Company Database API
// Fetches real-time company data from multiple financial APIs
// Covers ALL publicly traded companies automatically

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (req.method === 'GET') {
      const { ticker, name, sector, exchange } = req.query;
      
      if (ticker) {
        const company = await findCompanyByTicker(ticker);
        return res.status(200).json({ success: true, company });
      }
      
      if (name) {
        const companies = await findCompaniesByName(name);
        return res.status(200).json({ success: true, companies });
      }
      
      if (sector || exchange) {
        const companies = await filterCompaniesByCriteria({ sector, exchange });
        return res.status(200).json({ success: true, companies });
      }
      
      // Return all companies if no filters
      const allCompanies = await getAllCompanies();
      return res.status(200).json({ success: true, companies: allCompanies });
    }
    
    if (req.method === 'POST') {
      const { action, data } = req.body;
      
      if (action === 'search') {
        const results = await searchCompanies(data.query);
        return res.status(200).json({ success: true, results });
      }
      
      if (action === 'suggest') {
        const suggestions = await getSuggestions(data.partial);
        return res.status(200).json({ success: true, suggestions });
      }
      
      return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (err) {
    console.error('Company database error:', err);
    return res.status(500).json({ error: 'Company database error', message: err.message });
  }
}

// Cache for performance (stores company data for 1 hour)
const companyCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// API Keys (use environment variables)
const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_KEY;
const FMP_KEY = process.env.FMP_KEY;
const IEXCLOUD_KEY = process.env.IEXCLOUD_KEY;

// Dynamic company search functions
async function findCompanyByTicker(ticker) {
  if (!ticker) return null;

  const upperTicker = ticker.toUpperCase();
  
  // Check cache first
  const cached = companyCache.get(upperTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    // Try multiple APIs to get company info
    let company = await searchYahooFinance(upperTicker);
    
    if (!company) {
      company = await searchAlphaVantage(upperTicker);
    }
    
    if (!company) {
      company = await searchFinancialModelingPrep(upperTicker);
    }
    
    if (!company) {
      company = await searchIEXCloud(upperTicker);
    }
    
    if (company) {
      // Cache the result
      companyCache.set(upperTicker, {
        data: company,
        timestamp: Date.now()
      });
      return company;
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding company by ticker ${ticker}:`, error);
    return null;
  }
}

async function findCompaniesByName(name) {
  if (!name) return [];
  
  try {
    const results = [];
    
    // Search across multiple APIs
    const yahooResults = await searchYahooFinance(name);
    if (yahooResults) results.push(yahooResults);
    
    if (ALPHAVANTAGE_KEY) {
      const avResults = await searchAlphaVantage(name);
      if (avResults) results.push(avResults);
    }
    
    if (FMP_KEY) {
      const fmpResults = await searchFinancialModelingPrep(name);
      if (fmpResults) results.push(fmpResults);
    }
    
    if (IEXCLOUD_KEY) {
      const iexResults = await searchIEXCloud(name);
      if (iexResults) results.push(iexResults);
    }
    
    // Remove duplicates and return
    return removeDuplicates(results);
  } catch (error) {
    console.error(`Error finding companies by name ${name}:`, error);
    return [];
  }
}

async function searchYahooFinance(query) {
  try {
    // Yahoo Finance search (free, no API key needed)
    const response = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.quotes && data.quotes.length > 0) {
      const quote = data.quotes[0];
      return {
        ticker: quote.symbol,
        name: quote.shortname || quote.longname,
        sector: quote.sector || 'Unknown',
        exchange: quote.exchange || 'Unknown',
        marketCap: quote.marketCap ? formatMarketCap(quote.marketCap) : 'Unknown',
        aliases: [quote.shortname, quote.longname, quote.symbol].filter(Boolean)
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Yahoo Finance search failed:', error);
    return null;
  }
}

async function searchAlphaVantage(query) {
  if (!ALPHAVANTAGE_KEY) return null;
  
  try {
    const response = await fetch(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${ALPHAVANTAGE_KEY}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.bestMatches && data.bestMatches.length > 0) {
      const match = data.bestMatches[0];
      return {
        ticker: match['1. symbol'],
        name: match['2. name'],
        sector: match['3. type'] || 'Unknown',
        exchange: match['4. region'] || 'Unknown',
        marketCap: 'Unknown',
        aliases: [match['2. name'], match['1. symbol']]
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Alpha Vantage search failed:', error);
    return null;
  }
}

async function searchFinancialModelingPrep(query) {
  if (!FMP_KEY) return null;
  
  try {
    const response = await fetch(`https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&apikey=${FMP_KEY}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const match = data[0];
      return {
        ticker: match.symbol,
        name: match.name,
        sector: match.sector || 'Unknown',
        exchange: match.exchange || 'Unknown',
        marketCap: match.marketCap ? formatMarketCap(match.marketCap) : 'Unknown',
        aliases: [match.name, match.symbol]
      };
    }
    
    return null;
  } catch (error) {
    console.warn('FMP search failed:', error);
    return null;
  }
}

async function searchIEXCloud(query) {
  if (!IEXCLOUD_KEY) return null;
  
  try {
    const response = await fetch(`https://cloud.iexapis.com/stable/search/${encodeURIComponent(query)}?token=${IEXCLOUD_KEY}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const match = data[0];
      return {
        ticker: match.symbol,
        name: match.securityName,
        sector: match.sector || 'Unknown',
        exchange: match.exchange || 'Unknown',
        marketCap: 'Unknown',
        aliases: [match.securityName, match.symbol]
      };
    }
    
    return null;
  } catch (error) {
    console.warn('IEX Cloud search failed:', error);
    return null;
  }
}

async function filterCompaniesByCriteria({ sector, exchange }) {
  // This would require a comprehensive company list API
  // For now, return empty array
  return [];
}

async function getAllCompanies() {
  // This would require a comprehensive company list API
  // For now, return empty array
  return [];
}

async function searchCompanies(query) {
  if (!query) return [];
  
  try {
    const results = await findCompaniesByName(query);
    return results;
  } catch (error) {
    console.error('Company search failed:', error);
    return [];
  }
}

async function getSuggestions(partial) {
  if (!partial || partial.length < 2) return [];
  
  try {
    const results = await findCompaniesByName(partial);
    return results.slice(0, 10).map(company => ({
      ticker: company.ticker,
      name: company.name,
      display: `${company.ticker} - ${company.name}`
    }));
  } catch (error) {
    console.error('Suggestions failed:', error);
    return [];
  }
}

// Helper functions
function formatMarketCap(marketCap) {
  if (!marketCap) return 'Unknown';

  const num = parseFloat(marketCap);
  if (isNaN(num)) return 'Unknown';

  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;

  return num.toString();
}

function removeDuplicates(companies) {
  const seen = new Set();
  return companies.filter(company => {
    const key = company.ticker;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Export for use in other modules
export { findCompanyByTicker, findCompaniesByName, searchCompanies };
