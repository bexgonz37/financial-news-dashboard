// Financial News Data API - Enhanced with Comprehensive Company Matching
import { findCompanyMatches } from './company-matcher.js';
import { findCompanyByTicker, findCompaniesByName } from './company-database-dynamic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, search } = req.query;
    const { title, summary, text } = req.body || {};

    // Get news data
    const newsData = await fetchNewsData(ticker, search);
    
    // Process news with enhanced company matching
    const processedNews = await processNewsWithCompanyMatching(newsData, title, summary, text);

    return res.status(200).json({
      success: true,
      data: {
        news: processedNews,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch data',
      message: error.message 
    });
  }
}

async function fetchNewsData(ticker, search) {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) {
    throw new Error('Alpha Vantage API key not configured');
  }

  let url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${apiKey}&limit=200`;
  
  if (ticker) {
    url += `&tickers=${ticker}`;
  }
  
  if (search) {
    url += `&topics=${search}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage API error: ${response.status}`);
  }

  const data = await response.json();
  return data.feed || [];
}

async function processNewsWithCompanyMatching(newsData, title, summary, text) {
  const processedNews = [];

  for (const news of newsData) {
    try {
      let ticker = 'GENERAL';
      let category = 'General';
      let sentimentScore = 0;

      // Try to get ticker from Alpha Vantage's ticker_sentiment first
      if (news.ticker_sentiment && news.ticker_sentiment.length > 0) {
        const bestTicker = news.ticker_sentiment[0];
        ticker = bestTicker.ticker;
        sentimentScore = parseFloat(bestTicker.relevance_score) || 0;
      } else {
        // Enhanced company matching logic
        const articleText = `${news.title} ${news.summary}`;
        const companies = await findCompaniesByName(articleText);
        
        if (companies && companies.length > 0) {
          // Check if multiple companies are mentioned
          const companyCount = companies.length;
          
          if (companyCount === 1) {
            // Single company found - check confidence
            const company = companies[0];
            const matchScore = calculateExactMatchScore(articleText, company);
            
            if (matchScore >= 0.7) {
              ticker = company.ticker;
              sentimentScore = 0.5; // Default sentiment for matched companies
            } else {
              ticker = 'GENERAL'; // Low confidence match
            }
          } else {
            // Multiple companies mentioned - mark as GENERAL
            ticker = 'GENERAL';
          }
        } else {
          // Try dynamic company matching
          const matches = await findCompanyMatches(articleText);
          
          if (matches && matches.length > 0) {
            const companyCount = matches.length;
            
            if (companyCount === 1) {
              const match = matches[0];
              if (match.confidence >= 0.7) {
                ticker = match.ticker;
                sentimentScore = match.confidence;
              } else {
                ticker = 'GENERAL';
              }
            } else {
              ticker = 'GENERAL';
            }
          } else {
            // Fallback to regex extraction
            ticker = extractTickerFromTitle(news.title);
          }
        }
      }

      // Categorize news
      category = categorizeNews(news.title, news.summary);

      processedNews.push({
        title: news.title,
        summary: news.summary,
        url: news.url,
        publishedAt: news.time_published,
        source: news.source,
        ticker: ticker,
        category: category,
        sentimentScore: sentimentScore
      });

    } catch (error) {
      console.error('Error processing news item:', error);
      // Add news item with default values
      processedNews.push({
        title: news.title,
        summary: news.summary,
        url: news.url,
        publishedAt: news.time_published,
        source: news.source,
        ticker: 'GENERAL',
        category: 'General',
        sentimentScore: 0
      });
    }
  }

  return processedNews;
}

function extractTickerFromTitle(title) {
  if (!title) return 'GENERAL';

  // First, look for tickers in parentheses (most reliable)
  const parenMatch = title.match(/\(([A-Z]{1,5})\)/);
  if (parenMatch) {
    const ticker = parenMatch[1];
    if (!isCommonWord(ticker)) {
      return ticker;
    }
  }

  // Look for ticker patterns
  const tickerMatch = title.match(/\b([A-Z]{1,5})\b/g);
  if (tickerMatch) {
    for (const match of tickerMatch) {
      if (!isCommonWord(match)) {
        return match;
      }
    }
  }

  return 'GENERAL';
}

function isCommonWord(word) {
  const commonWords = new Set([
    'CEO', 'USA', 'NYSE', 'NASDAQ', 'AI', 'FDA', 'EPS', 'IPO', 'SPAC', 'M&A',
    'SEC', 'IRS', 'GDP', 'CPI', 'PCE', 'FOMC', 'ETF', 'IRA', '401K', 'ROI',
    'P/E', 'P/B', 'EV', 'EBITDA', 'CFO', 'CTO', 'COO', 'CFO', 'VP', 'SVP'
  ]);
  return commonWords.has(word);
}

function categorizeNews(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  
  if (text.includes('earnings') || text.includes('eps') || text.includes('revenue')) return 'Earnings';
  if (text.includes('fda') || text.includes('approval') || text.includes('clinical')) return 'FDA';
  if (text.includes('merger') || text.includes('acquisition') || text.includes('m&a')) return 'Merger';
  if (text.includes('insider') || text.includes('executive') || text.includes('ceo')) return 'Insider';
  if (text.includes('short') || text.includes('squeeze') || text.includes('hedge')) return 'Short Interest';
  if (text.includes('options') || text.includes('call') || text.includes('put')) return 'Options';
  if (text.includes('analyst') || text.includes('rating') || text.includes('upgrade')) return 'Analyst';
  if (text.includes('sec') || text.includes('filing') || text.includes('regulatory')) return 'SEC';
  if (text.includes('dividend') || text.includes('payout') || text.includes('yield')) return 'Dividend';
  if (text.includes('bankruptcy') || text.includes('chapter') || text.includes('liquidation')) return 'Bankruptcy';
  if (text.includes('ipo') || text.includes('spac') || text.includes('debut')) return 'IPO/SPAC';
  if (text.includes('crypto') || text.includes('bitcoin') || text.includes('blockchain')) return 'Crypto';
  if (text.includes('meme') || text.includes('reddit') || text.includes('social')) return 'Meme Stock';
  if (text.includes('biotech') || text.includes('pharma') || text.includes('drug')) return 'Biotech';
  if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning')) return 'AI';
  if (text.includes('ev') || text.includes('electric vehicle') || text.includes('tesla')) return 'EV';
  if (text.includes('cannabis') || text.includes('marijuana') || text.includes('weed')) return 'Cannabis';
  if (text.includes('gaming') || text.includes('esports') || text.includes('console')) return 'Gaming';
  if (text.includes('social media') || text.includes('facebook') || text.includes('twitter')) return 'Social Media';
  if (text.includes('retail') || text.includes('ecommerce') || text.includes('amazon')) return 'Retail';
  
  return 'General';
}

// ---------- Helpers ----------
function extractCompanyNames(text) {
  if (!text) return [];
  
  // More strict regex patterns for company names
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
        if (isValidCompanyName(match) && !isCommonFalsePositive(match)) {
          companies.add(match);
        }
      });
    }
  });
  
  return Array.from(companies).filter(company => company.length >= 3);
}

function isValidCompanyName(name) {
  if (!name || name.length < 3) return false;
  
  // Filter out common false positives
  const falsePositives = [
    'United States', 'New York', 'Los Angeles', 'San Francisco', 'Wall Street',
    'Federal Reserve', 'White House', 'Congress', 'Senate', 'House',
    'Department of', 'Ministry of', 'Central Bank', 'European Union'
  ];
  
  return !falsePositives.some(fp => name.toLowerCase().includes(fp.toLowerCase()));
}

function isCommonFalsePositive(word) {
  const falsePositives = [
    'Market', 'Trading', 'Investment', 'Financial', 'Economic', 'Business',
    'Company', 'Corporation', 'Inc', 'Ltd', 'LLC', 'Group', 'Holdings',
    'International', 'Global', 'American', 'European', 'Asian', 'Pacific'
  ];
  
  return falsePositives.some(fp => word.toLowerCase().includes(fp.toLowerCase()));
}

function calculateExactMatchScore(text, company) {
  const textLower = text.toLowerCase();
  const companyNameLower = company.name.toLowerCase();
  const tickerLower = company.ticker.toLowerCase();
  
  let score = 0;
  
  // Exact name match gets highest score
  if (textLower.includes(companyNameLower)) {
    score += 0.8;
  }
  
  // Partial name match
  const nameWords = companyNameLower.split(' ');
  const matchedWords = nameWords.filter(word => textLower.includes(word));
  if (matchedWords.length > 0) {
    score += (matchedWords.length / nameWords.length) * 0.4;
  }
  
  // Ticker match
  if (textLower.includes(tickerLower)) {
    score += 0.3;
  }
  
  // Alias matches
  if (company.aliases) {
    const aliasMatches = company.aliases.filter(alias => 
      alias && textLower.includes(alias.toLowerCase())
    );
    if (aliasMatches.length > 0) {
      score += 0.2;
    }
  }
  
  return Math.min(1.0, score);
}
