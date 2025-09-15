// Live News API - Real Financial News Aggregation
const fetch = require('node-fetch');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// API Keys from environment variables
const FMP_KEY = process.env.FMP_KEY;
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

// URL validation and normalization
function isHttp(url) {
  try {
    return /^https?:\/\//i.test(url);
  } catch {
    return false;
  }
}

function looksSearchOrTopic(url) {
  try {
    const u = new URL(url);
    return /\/search(\?|$)/i.test(u.pathname) || 
           /[?&](q|query|s)=/i.test(u.search) ||
           /\/topic\//i.test(u.pathname) ||
           /\/ticker\//i.test(u.pathname);
  } catch {
    return false;
  }
}

function absolutize(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

// Resolve final URL by following redirects
async function resolveFinal(url) {
  if (!isHttp(url)) return null;
  if (looksSearchOrTopic(url)) return null;

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const finalUrl = response.url;
    if (isHttp(finalUrl) && !looksSearchOrTopic(finalUrl)) {
      return finalUrl;
    }
  } catch (error) {
    console.warn(`URL resolution failed for ${url}:`, error.message);
  }

  return null;
}

// Fetch company name to ticker mappings
let companyMappings = new Map();
let mappingsLastUpdate = 0;
const MAPPINGS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function fetchLiveCompanyMappings() {
  const now = Date.now();
  if (companyMappings.size > 0 && (now - mappingsLastUpdate) < MAPPINGS_CACHE_DURATION) {
    return companyMappings;
  }

  console.log('Fetching live company mappings...');
  companyMappings.clear();

  try {
    // Fetch from FMP if available
    if (FMP_KEY) {
      const response = await fetch(`https://financialmodelingprep.com/api/v3/stock/list?apikey=${FMP_KEY}`, {
        cache: 'no-store'
      });
      
      if (response.ok) {
        const stocks = await response.json();
        stocks.forEach(stock => {
          if (stock.symbol && stock.name) {
            const name = stock.name.toLowerCase().trim();
            const symbol = stock.symbol.toUpperCase();
            companyMappings.set(name, symbol);
            
            // Also map common variations
            const shortName = name.split(' ')[0];
            if (shortName.length > 2) {
              companyMappings.set(shortName, symbol);
            }
          }
        });
        console.log(`FMP: Loaded ${companyMappings.size} company mappings`);
      }
    }

    // Fetch from Yahoo Finance as backup
    try {
      const response = await fetch('https://query1.finance.yahoo.com/v1/finance/search?q=stocks&quotesCount=1000', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.quotes) {
          data.quotes.forEach(quote => {
            if (quote.symbol && quote.longName) {
              const name = quote.longName.toLowerCase().trim();
              const symbol = quote.symbol.toUpperCase();
              companyMappings.set(name, symbol);
            }
          });
          console.log(`Yahoo: Total mappings now ${companyMappings.size}`);
        }
      }
    } catch (error) {
      console.warn('Yahoo company mapping fetch failed:', error.message);
    }

    mappingsLastUpdate = now;
  } catch (error) {
    console.error('Company mapping fetch error:', error.message);
  }

  return companyMappings;
}

// Extract company ticker from content
async function extractCompanyTicker(content, mappings) {
  if (!content || !mappings) return null;

  const text = content.toLowerCase();
  const words = text.split(/\s+/);
  
  // Look for exact company name matches
  for (const [name, symbol] of mappings) {
    if (text.includes(name)) {
      return symbol;
    }
  }
  
  // Look for common ticker patterns
  const tickerPattern = /\b([A-Z]{1,5})\b/g;
  const matches = content.match(tickerPattern);
  if (matches) {
    // Return the first valid-looking ticker
    return matches[0].toUpperCase();
  }
  
  return null;
}

// Fetch news from Alpha Vantage
async function fetchAlphaVantageNews(companyMappings) {
  if (!FMP_KEY) return [];

  try {
    const response = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${FMP_KEY}&limit=50`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Alpha Vantage API response:', JSON.stringify(data, null, 2));

    if (data.feed && Array.isArray(data.feed)) {
      return data.feed.map(item => {
        const content = (item.title || '') + ' ' + (item.summary || '');
        const extractedTicker = extractCompanyTicker(content, companyMappings);
        
        return {
          id: `av_${item.uuid || Date.now()}`,
          title: item.title || '',
          summary: item.summary || '',
          source: 'Alpha Vantage',
          publishedAt: item.time_published || new Date().toISOString(),
          ticker: extractedTicker,
          url: item.url || ''
        };
      });
    }
  } catch (error) {
    console.error('Alpha Vantage news error:', error.message);
  }

  return [];
}

// Fetch news from FMP
async function fetchFMPNews(companyMappings) {
  if (!FMP_KEY) return [];

  try {
    const response = await fetch(`https://financialmodelingprep.com/api/v3/stock_news?limit=50&apikey=${FMP_KEY}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('FMP API response:', JSON.stringify(data, null, 2));

    if (Array.isArray(data)) {
      return data.map(item => {
        const content = (item.title || '') + ' ' + (item.text || '');
        const extractedTicker = extractCompanyTicker(content, companyMappings);
        
        return {
          id: `fmp_${item.id || Date.now()}`,
          title: item.title || '',
          summary: item.text || '',
          source: item.site || 'FMP',
          publishedAt: item.publishedDate || new Date().toISOString(),
          ticker: extractedTicker,
          url: item.url || ''
        };
      });
    }
  } catch (error) {
    console.error('FMP news error:', error.message);
  }

  return [];
}

// Fetch news from Finnhub
async function fetchFinnhubNews(companyMappings) {
  if (!FINNHUB_KEY) return [];

  try {
    const response = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Finnhub API response:', JSON.stringify(data, null, 2));

    if (Array.isArray(data)) {
      return data.map(item => {
        const content = (item.headline || '') + ' ' + (item.summary || '');
        const extractedTicker = extractCompanyTicker(content, companyMappings);
        
        return {
          id: `fh_${item.id || Date.now()}`,
          title: item.headline || '',
          summary: item.summary || '',
          source: item.source || 'Finnhub',
          publishedAt: new Date(item.datetime * 1000).toISOString(),
          ticker: extractedTicker,
          url: item.url || ''
        };
      });
    }
  } catch (error) {
    console.error('Finnhub news error:', error.message);
  }

  return [];
}

// Fetch news from NewsAPI
async function fetchNewsAPINews(companyMappings) {
  if (!NEWSAPI_KEY) return [];

  try {
    const response = await fetch(`https://newsapi.org/v2/everything?q=stocks OR trading OR market&language=en&sortBy=publishedAt&pageSize=50&apiKey=${NEWSAPI_KEY}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.status}`);
    }

    const data = await response.json();
    console.log('NewsAPI response:', JSON.stringify(data, null, 2));

    if (data.articles && Array.isArray(data.articles)) {
      return data.articles.map(item => {
        const content = (item.title || '') + ' ' + (item.description || '');
        const extractedTicker = extractCompanyTicker(content, companyMappings);
        
        return {
          id: `na_${item.url?.split('/').pop() || Date.now()}`,
          title: item.title || '',
          summary: item.description || '',
          source: item.source?.name || 'NewsAPI',
          publishedAt: item.publishedAt || new Date().toISOString(),
          ticker: extractedTicker,
          url: item.url || ''
        };
      });
    }
  } catch (error) {
    console.error('NewsAPI error:', error.message);
  }

  return [];
}

// Normalize and validate news item
async function normalizeNewsItem(item) {
  // Validate URL
  let finalUrl = null;
  if (item.url && isHttp(item.url)) {
    finalUrl = await resolveFinal(item.url);
  }

  // Skip if no valid URL
  if (!finalUrl) {
    return null;
  }

  // Parse and validate timestamp
  let publishedAt = item.publishedAt;
  try {
    const date = new Date(publishedAt);
    if (isNaN(date.getTime())) {
      // Generate recent timestamp if invalid
      const minutesAgo = Math.floor(Math.random() * 30) + 1;
      publishedAt = new Date(Date.now() - minutesAgo * 60000).toISOString();
    }
  } catch {
    publishedAt = new Date().toISOString();
  }

  return {
    id: item.id,
    title: item.title || 'No title',
    summary: item.summary || '',
    source: item.source || 'Unknown',
    publishedAt: publishedAt,
    ticker: item.ticker,
    url: finalUrl
  };
}

// Main news fetching function
async function fetchRealNewsFromAPIs() {
  console.log('Fetching live news from APIs...');
  
  // Get company mappings first
  const companyMappings = await fetchLiveCompanyMappings();
  
  // Fetch from all available sources
  const [alphaVantageNews, fmpNews, finnhubNews, newsAPINews] = await Promise.allSettled([
    fetchAlphaVantageNews(companyMappings),
    fetchFMPNews(companyMappings),
    fetchFinnhubNews(companyMappings),
    fetchNewsAPINews(companyMappings)
  ]);

  // Combine all news
  const allNews = [];
  
  if (alphaVantageNews.status === 'fulfilled') {
    allNews.push(...alphaVantageNews.value);
  }
  if (fmpNews.status === 'fulfilled') {
    allNews.push(...fmpNews.value);
  }
  if (finnhubNews.status === 'fulfilled') {
    allNews.push(...finnhubNews.value);
  }
  if (newsAPINews.status === 'fulfilled') {
    allNews.push(...newsAPINews.value);
  }

  console.log(`Raw news items: ${allNews.length}`);

  // Normalize and validate all items
  const normalizedNews = [];
  for (const item of allNews) {
    const normalized = await normalizeNewsItem(item);
    if (normalized) {
      normalizedNews.push(normalized);
    }
  }

  // Remove duplicates by title and publishedAt
  const seen = new Set();
  const uniqueNews = normalizedNews.filter(item => {
    const key = `${item.title}_${item.publishedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by publishedAt (newest first)
  uniqueNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  console.log(`Final news items: ${uniqueNews.length}`);
  return uniqueNews;
}

export default async function handler(req, res) {
  try {
    console.log('=== ENHANCED NEWS API ===');
    
    const allNews = await fetchRealNewsFromAPIs();
    
    // Debug: Show all news items with their timestamps
    console.log('=== ALL NEWS ITEMS DEBUG ===');
    allNews.forEach((item, index) => {
      console.log(`News ${index + 1}: "${item.title}" - ${item.publishedAt} (${item.source})`);
    });
    console.log('=== END NEWS DEBUG ===');

    return res.status(200).json({
      success: true,
      data: {
        news: allNews,
        count: allNews.length,
        lastUpdate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Enhanced News API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}