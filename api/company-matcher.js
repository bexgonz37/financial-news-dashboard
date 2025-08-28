// Dynamic Company Matcher - Covers ALL publicly traded companies
// Uses real-time data sources and multiple search strategies

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { title, summary, text } = req.body;
    
    if (!title && !summary && !text) {
      return res.status(400).json({ error: 'Title, summary, or text required' });
    }

    const fullText = `${title || ''} ${summary || ''} ${text || ''}`;
    const matches = await findCompanyMatches(fullText);
    
    return res.status(200).json({ 
      success: true, 
      matches,
      confidence: matches.length > 0 ? 'high' : 'low'
    });

  } catch (err) {
    console.error('Company matcher error:', err);
    return res.status(500).json({ error: 'Company matcher error', message: err.message });
  }
}

// Multi-strategy company matching for ALL publicly traded companies
async function findCompanyMatches(text) {
  const matches = [];
  const lowerText = text.toLowerCase();
  
  // Strategy 1: Extract potential company names from text
  const potentialCompanies = extractCompanyNames(text);
  
  // Strategy 2: Search for each potential company
  for (const companyName of potentialCompanies) {
    try {
      const companyData = await searchCompany(companyName);
      if (companyData) {
        matches.push({
          ticker: companyData.ticker,
          company: companyData.name,
          score: calculateScore(companyName, companyData, lowerText),
          matchedNames: [companyName],
          sector: companyData.sector || 'Unknown',
          exchange: companyData.exchange || 'Unknown',
          confidence: 'high',
          marketCap: companyData.marketCap,
          isActive: companyData.isActive
        });
      }
    } catch (error) {
      console.warn(`Failed to search for company: ${companyName}`, error);
    }
  }
  
  // Strategy 3: Look for ticker symbols in text
  const tickerMatches = findTickerSymbols(text);
  for (const ticker of tickerMatches) {
    try {
      const companyData = await getCompanyByTicker(ticker);
      if (companyData) {
        matches.push({
          ticker: ticker,
          company: companyData.name,
          score: 150, // High score for direct ticker match
          matchedNames: [ticker],
          sector: companyData.sector || 'Unknown',
          exchange: companyData.exchange || 'Unknown',
          confidence: 'high',
          marketCap: companyData.marketCap,
          isActive: companyData.isActive
        });
      }
    } catch (error) {
      console.warn(`Failed to get company data for ticker: ${ticker}`, error);
    }
  }
  
  // Remove duplicates and sort by score
  const uniqueMatches = removeDuplicates(matches);
  return uniqueMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Return top 10 matches
}

// Extract potential company names from text
function extractCompanyNames(text) {
  const companies = new Set();
  
  // Look for capitalized company patterns
  const patterns = [
    // "Company Name Inc." pattern
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|Corp|Corporation|LLC|Ltd|Limited|Company|Co|Group|Holdings|Technologies|Systems|Solutions|Partners|Ventures|Enterprises|Industries|International|Global|America|USA|US))\b/g,
    
    // "Company Name" pattern (standalone)
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
    
    // "The Company Name" pattern
    /\bThe\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
    
    // Product-based company identification
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:announces|launches|reports|reveals|introduces|partners|acquires|merges|expands|invests)\b/gi
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const company = match[1] || match[0];
      if (isValidCompanyName(company)) {
        companies.add(company.trim());
      }
    }
  });
  
  return Array.from(companies);
}

// Validate if a name could be a company
function isValidCompanyName(name) {
  if (!name || name.length < 2) return false;
  
  // Common words that are unlikely to be company names
  const commonWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'announces', 'launches', 'reports', 'reveals', 'introduces', 'partners', 'acquires',
    'merges', 'expands', 'invests', 'said', 'will', 'has', 'had', 'have', 'been',
    'this', 'that', 'these', 'those', 'new', 'old', 'big', 'small', 'high', 'low',
    'first', 'last', 'next', 'previous', 'current', 'future', 'past', 'today',
    'yesterday', 'tomorrow', 'now', 'then', 'here', 'there', 'where', 'when',
    'what', 'why', 'how', 'who', 'which', 'whose', 'whom'
  ]);
  
  const words = name.toLowerCase().split(/\s+/);
  if (words.length === 1 && commonWords.has(words[0])) return false;
  
  // Must have at least one non-common word
  const hasValidWord = words.some(word => !commonWords.has(word) && word.length > 1);
  return hasValidWord;
}

// Search for company using multiple data sources
async function searchCompany(companyName) {
  // Try multiple search strategies
  const strategies = [
    () => searchYahooFinance(companyName),
    () => searchAlphaVantage(companyName),
    () => searchFinancialModelingPrep(companyName),
    () => searchIEXCloud(companyName)
  ];
  
  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result) return result;
    } catch (error) {
      console.warn(`Strategy failed for ${companyName}:`, error);
    }
  }
  
  return null;
}

// Search Yahoo Finance (free, no API key)
async function searchYahooFinance(companyName) {
  try {
    // Use Yahoo Finance search endpoint
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(companyName)}&quotesCount=5&newsCount=0`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.quotes || data.quotes.length === 0) return null;
    
    // Get the best match
    const bestMatch = data.quotes[0];
    
    // Get additional company info
    const companyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${bestMatch.symbol}`;
    const companyResponse = await fetch(companyUrl);
    
    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      const result = companyData.chart.result[0];
      
      return {
        ticker: bestMatch.symbol,
        name: bestMatch.shortname || bestMatch.longname || companyName,
        sector: result.meta?.sector || 'Unknown',
        exchange: result.meta?.exchangeName || 'Unknown',
        marketCap: result.meta?.marketCap || null,
        isActive: true
      };
    }
    
    return {
      ticker: bestMatch.symbol,
      name: bestMatch.shortname || bestMatch.longname || companyName,
      sector: 'Unknown',
      exchange: 'Unknown',
      marketCap: null,
      isActive: true
    };
    
  } catch (error) {
    console.warn(`Yahoo Finance search failed for ${companyName}:`, error);
    return null;
  }
}

// Search Alpha Vantage (if API key available)
async function searchAlphaVantage(companyName) {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) return null;
  
  try {
    const searchUrl = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(companyName)}&apikey=${apiKey}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.bestMatches || data.bestMatches.length === 0) return null;
    
    const bestMatch = data.bestMatches[0];
    
    return {
      ticker: bestMatch['1. symbol'],
      name: bestMatch['2. name'],
      sector: bestMatch['3. type'] || 'Unknown',
      exchange: bestMatch['4. region'] || 'Unknown',
      marketCap: null,
      isActive: true
    };
    
  } catch (error) {
    console.warn(`Alpha Vantage search failed for ${companyName}:`, error);
    return null;
  }
}

// Search Financial Modeling Prep (if API key available)
async function searchFinancialModelingPrep(companyName) {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) return null;
  
  try {
    const searchUrl = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(companyName)}&apikey=${apiKey}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    
    const bestMatch = data[0];
    
    return {
      ticker: bestMatch.symbol,
      name: bestMatch.name,
      sector: bestMatch.sector || 'Unknown',
      exchange: bestMatch.exchange || 'Unknown',
      marketCap: bestMatch.marketCap || null,
      isActive: true
    };
    
  } catch (error) {
    console.warn(`FMP search failed for ${companyName}:`, error);
    return null;
  }
}

// Search IEX Cloud (if API key available)
async function searchIEXCloud(companyName) {
  const apiKey = process.env.IEXCLOUD_KEY;
  if (!apiKey) return null;
  
  try {
    const searchUrl = `https://cloud.iexapis.com/stable/search/${encodeURIComponent(companyName)}?token=${apiKey}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    
    const bestMatch = data[0];
    
    return {
      ticker: bestMatch.symbol,
      name: bestMatch.name,
      sector: bestMatch.sector || 'Unknown',
      exchange: bestMatch.exchange || 'Unknown',
      marketCap: null,
      isActive: true
    };
    
  } catch (error) {
    console.warn(`IEX Cloud search failed for ${companyName}:`, error);
    return null;
  }
}

// Get company data by ticker symbol
async function getCompanyByTicker(ticker) {
  try {
    // Try Yahoo Finance first (free)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result || !result.meta) return null;
    
    return {
      ticker: ticker,
      name: result.meta.shortName || result.meta.longName || ticker,
      sector: result.meta.sector || 'Unknown',
      exchange: result.meta.exchangeName || 'Unknown',
      marketCap: result.meta.marketCap || null,
      isActive: true
    };
    
  } catch (error) {
    console.warn(`Failed to get company data for ticker ${ticker}:`, error);
    return null;
  }
}

// Find ticker symbols in text
function findTickerSymbols(text) {
  const tickers = new Set();
  
  // Look for ticker patterns: 1-5 uppercase letters
  const tickerPattern = /\b([A-Z]{1,5})\b/g;
  let match;
  
  while ((match = tickerPattern.exec(text)) !== null) {
    const ticker = match[1];
    // Filter out common words that look like tickers
    if (!isCommonWord(ticker)) {
      tickers.add(ticker);
    }
  }
  
  return Array.from(tickers);
}

// Check if a word is a common word (not a ticker)
function isCommonWord(word) {
  const commonWords = new Set([
    'CEO', 'CFO', 'CTO', 'COO', 'VP', 'DIR', 'INC', 'LLC', 'CORP', 'LTD', 'CO',
    'USA', 'NYSE', 'SEC', 'ETF', 'IPO', 'AI', 'FDA', 'EPS', 'QEQ', 'QOQ', 'YOY', 'USD',
    'THE', 'AND', 'FOR', 'NEW', 'TOP', 'BIG', 'LOW', 'HIGH', 'OPEN', 'CLOSE', 'VOLUME',
    'PRICE', 'STOCK', 'SHARE', 'MARKET', 'TRADING', 'INVESTMENT', 'FINANCIAL', 'BUSINESS',
    'COMPANY', 'REPORT', 'QUARTER', 'YEAR', 'MONTH', 'WEEK', 'DAY', 'TIME', 'DATE',
    'HOUR', 'MINUTE', 'SECOND', 'NOW', 'TODAY', 'YESTERDAY', 'TOMORROW', 'NEXT', 'LAST',
    'FIRST', 'BEST', 'WORST', 'GOOD', 'BAD', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'CENTER',
    'MIDDLE', 'START', 'END', 'BEGIN', 'FINISH', 'COMPLETE', 'DONE', 'READY', 'SET',
    'GO', 'STOP', 'PAUSE', 'PLAY', 'RECORD', 'DELETE', 'SAVE', 'LOAD', 'OPEN', 'CLOSE',
    'EXIT', 'ENTER', 'BACK', 'FORWARD', 'NEXT', 'PREVIOUS', 'CURRENT', 'FUTURE', 'PAST'
  ]);
  
  return commonWords.has(word);
}

// Calculate confidence score for a match
function calculateScore(companyName, companyData, text) {
  let score = 0;
  
  // Exact name match gets highest score
  if (text.includes(companyName.toLowerCase())) {
    score += 100;
  }
  
  // Company name similarity
  const nameSimilarity = calculateNameSimilarity(companyName, companyData.name);
  score += nameSimilarity * 50;
  
  // Market cap bonus (smaller companies get higher scores for day trading)
  if (companyData.marketCap) {
    if (companyData.marketCap < 1000000000) { // Under $1B
      score += 30;
    } else if (companyData.marketCap < 10000000000) { // Under $10B
      score += 20;
    }
  }
  
  // Exchange bonus (some exchanges are more popular for day trading)
  if (companyData.exchange === 'NASDAQ') score += 10;
  if (companyData.exchange === 'NYSE') score += 5;
  
  return Math.min(score, 200); // Cap at 200
}

// Calculate name similarity between search term and company name
function calculateNameSimilarity(searchTerm, companyName) {
  if (!searchTerm || !companyName) return 0;
  
  const search = searchTerm.toLowerCase().split(/\s+/);
  const company = companyName.toLowerCase().split(/\s+/);
  
  let matches = 0;
  let total = Math.max(search.length, company.length);
  
  for (const searchWord of search) {
    for (const companyWord of company) {
      if (companyWord.includes(searchWord) || searchWord.includes(companyWord)) {
        matches++;
        break;
      }
    }
  }
  
  return matches / total;
}

// Remove duplicate matches (same ticker)
function removeDuplicates(matches) {
  const seen = new Set();
  return matches.filter(match => {
    if (seen.has(match.ticker)) {
      return false;
    }
    seen.add(match.ticker);
    return true;
  });
}

// Export for testing
export { findCompanyMatches, extractCompanyNames, searchCompany };
