// Dynamic Company Matcher - Covers ALL publicly traded companies
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (req.method === 'POST') {
      const { title, summary, text } = req.body;
      
      if (!title && !summary && !text) {
        return res.status(400).json({ error: 'Title, summary, or text is required' });
      }

      const fullText = `${title || ''} ${summary || ''} ${text || ''}`.trim();
      const matches = await findCompanyMatches(fullText);

      return res.status(200).json({
        success: true,
        matches,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'GET') {
      const { query } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
      }

      const matches = await findCompanyMatches(query);

      return res.status(200).json({
        success: true,
        matches,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Company Matcher Error:', error);
    return res.status(500).json({ 
      error: 'Company matching failed',
      message: error.message 
    });
  }
}

async function findCompanyMatches(text) {
  if (!text) return [];

  try {
    const results = [];
    
    // Extract potential company names from text
    const companyNames = extractCompanyNames(text);
    
    // Search for each potential company name
    for (const companyName of companyNames) {
      const company = await searchCompany(companyName);
      if (company) {
        results.push({
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          exchange: company.exchange,
          marketCap: company.marketCap,
          confidence: company.confidence || 0.5,
          matchedTerm: companyName
        });
      }
    }
    
    // Also try to find ticker symbols directly in the text
    const tickers = findTickerSymbols(text);
    for (const ticker of tickers) {
      const company = await getCompanyByTicker(ticker);
      if (company) {
        results.push({
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          exchange: company.exchange,
          marketCap: company.marketCap,
          confidence: 0.9, // High confidence for direct ticker matches
          matchedTerm: ticker
        });
      }
    }
    
    // Remove duplicates and calculate scores
    const uniqueResults = removeDuplicates(results);
    const scoredResults = uniqueResults.map(result => ({
      ...result,
      score: calculateScore(result, text)
    }));
    
    // Sort by score and return top 10
    return scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

  } catch (error) {
    console.error('Error in findCompanyMatches:', error);
    return [];
  }
}

async function searchCompany(companyName) {
  if (!companyName) return null;

  try {
    // Try multiple APIs in order of preference
    let company = await searchYahooFinance(companyName);
    
    if (!company && process.env.ALPHAVANTAGE_KEY) {
      company = await searchAlphaVantage(companyName);
    }
    
    if (!company && process.env.FMP_KEY) {
      company = await searchFinancialModelingPrep(companyName);
    }
    
    if (!company && process.env.IEXCLOUD_KEY) {
      company = await searchIEXCloud(companyName);
    }
    
    return company;
    
  } catch (error) {
    console.error(`Error searching for company ${companyName}:`, error);
    return null;
  }
}

async function searchYahooFinance(query) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`
    );

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
        confidence: 0.8,
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
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${apiKey}`
    );

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
        confidence: 0.7,
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
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&apikey=${apiKey}`
    );

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
        confidence: 0.7,
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
  const apiKey = process.env.IEXCLOUD_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://cloud.iexapis.com/stable/search/${encodeURIComponent(query)}?token=${apiKey}`
    );

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
        confidence: 0.7,
        aliases: [match.securityName, match.symbol]
      };
    }

    return null;
  } catch (error) {
    console.warn('IEX Cloud search failed:', error);
    return null;
  }
}

async function getCompanyByTicker(ticker) {
  if (!ticker) return null;

  try {
    // Use Yahoo Finance to get company info by ticker
    const company = await searchYahooFinance(ticker);
    return company;
  } catch (error) {
    console.error(`Error getting company by ticker ${ticker}:`, error);
    return null;
  }
}

function findTickerSymbols(text) {
  if (!text) return [];
  
  // Look for ticker patterns (1-5 capital letters)
  const tickerPattern = /\b([A-Z]{1,5})\b/g;
  const matches = text.match(tickerPattern) || [];
  
  // Filter out common words that aren't tickers
  return matches.filter(ticker => !isCommonWord(ticker));
}

function isCommonWord(word) {
  const commonWords = new Set([
    'CEO', 'USA', 'NYSE', 'NASDAQ', 'AI', 'FDA', 'EPS', 'IPO', 'SPAC', 'M&A',
    'SEC', 'IRS', 'GDP', 'CPI', 'PCE', 'FOMC', 'ETF', 'IRA', '401K', 'ROI',
    'P/E', 'P/B', 'EV', 'EBITDA', 'CFO', 'CTO', 'COO', 'CFO', 'VP', 'SVP'
  ]);
  return commonWords.has(word);
}

function extractCompanyNames(text) {
  if (!text) return [];
  
  // Look for company name patterns
  const patterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g, // 2-4 word company names
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g, // 2 word company names
    /\b([A-Z][a-z]+)\b/g // Single word company names
  ];
  
  const companies = new Set();
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (isValidCompanyName(match)) {
          companies.add(match);
        }
      });
    }
  });
  
  return Array.from(companies);
}

function isValidCompanyName(name) {
  if (!name || name.length < 3) return false;
  
  // Filter out common false positives
  const falsePositives = [
    'United States', 'New York', 'Los Angeles', 'San Francisco', 'Wall Street',
    'Federal Reserve', 'White House', 'Congress', 'Senate', 'House'
  ];
  
  return !falsePositives.some(fp => name.toLowerCase().includes(fp.toLowerCase()));
}

function calculateScore(result, text) {
  let score = 0;
  
  // Base confidence score
  score += result.confidence * 10;
  
  // Market cap bonus (smaller companies get higher scores for day trading)
  if (result.marketCap && result.marketCap !== 'Unknown') {
    if (result.marketCap.includes('M')) score += 5;
    else if (result.marketCap.includes('B')) score += 3;
    else if (result.marketCap.includes('T')) score += 1;
  }
  
  // Name similarity bonus
  const nameSimilarity = calculateNameSimilarity(text, result.name);
  score += nameSimilarity * 5;
  
  return score;
}

function calculateNameSimilarity(text, companyName) {
  if (!text || !companyName) return 0;
  
  const textLower = text.toLowerCase();
  const nameLower = companyName.toLowerCase();
  
  // Check if company name appears in text
  if (textLower.includes(nameLower)) return 1.0;
  
  // Check for partial matches
  const nameWords = nameLower.split(' ');
  const matchedWords = nameWords.filter(word => textLower.includes(word));
  
  if (matchedWords.length === 0) return 0;
  
  return matchedWords.length / nameWords.length;
}

function removeDuplicates(results) {
  const seen = new Set();
  return results.filter(result => {
    const key = result.ticker;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
