// Live News API - Real Financial News Aggregation
import fetch from 'node-fetch';

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
    // Fetch from multiple sources in parallel for comprehensive coverage
    const [fmpResponse, yahooResponse, nasdaqResponse, sp500Response, dowResponse, nyseResponse, amexResponse] = await Promise.allSettled([
      FMP_KEY ? fetch(`https://financialmodelingprep.com/api/v3/stock/list?apikey=${FMP_KEY}`, { cache: 'no-store' }) : Promise.resolve(null),
      fetch('https://query1.finance.yahoo.com/v1/finance/screener?formatted=true&lang=en-US&region=US&scrIds=most_actives&count=2000', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        cache: 'no-store'
      }),
      FMP_KEY ? fetch(`https://financialmodelingprep.com/api/v3/nasdaq_constituent?apikey=${FMP_KEY}`, { cache: 'no-store' }) : Promise.resolve(null),
      FMP_KEY ? fetch(`https://financialmodelingprep.com/api/v3/sp500_constituent?apikey=${FMP_KEY}`, { cache: 'no-store' }) : Promise.resolve(null),
      FMP_KEY ? fetch(`https://financialmodelingprep.com/api/v3/dowjones_constituent?apikey=${FMP_KEY}`, { cache: 'no-store' }) : Promise.resolve(null),
      FMP_KEY ? fetch(`https://financialmodelingprep.com/api/v3/nyse_constituent?apikey=${FMP_KEY}`, { cache: 'no-store' }) : Promise.resolve(null),
      FMP_KEY ? fetch(`https://financialmodelingprep.com/api/v3/amex_constituent?apikey=${FMP_KEY}`, { cache: 'no-store' }) : Promise.resolve(null)
    ]);

    // Process FMP stock list
    if (fmpResponse.status === 'fulfilled' && fmpResponse.value) {
      try {
        const stocks = await fmpResponse.value.json();
        if (Array.isArray(stocks)) {
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
          console.log(`FMP Stock List: Loaded ${companyMappings.size} mappings`);
        }
      } catch (error) {
        console.warn('FMP stock list processing failed:', error.message);
      }
    }

    // Process Yahoo Finance most actives
    if (yahooResponse.status === 'fulfilled' && yahooResponse.value) {
      try {
        const data = await yahooResponse.value.json();
        if (data.finance && data.finance.result && data.finance.result[0] && data.finance.result[0].quotes) {
          data.finance.result[0].quotes.forEach(quote => {
            if (quote.symbol && quote.longName) {
              const name = quote.longName.toLowerCase().trim();
              const symbol = quote.symbol.toUpperCase();
              companyMappings.set(name, symbol);
            }
          });
          console.log(`Yahoo Most Actives: Total mappings now ${companyMappings.size}`);
        }
      } catch (error) {
        console.warn('Yahoo most actives processing failed:', error.message);
      }
    }

    // Process NASDAQ constituents
    if (nasdaqResponse.status === 'fulfilled' && nasdaqResponse.value) {
      try {
        const data = await nasdaqResponse.value.json();
        if (Array.isArray(data)) {
          data.forEach(stock => {
            if (stock.symbol && stock.name) {
              const name = stock.name.toLowerCase().trim();
              const symbol = stock.symbol.toUpperCase();
              companyMappings.set(name, symbol);
            }
          });
          console.log(`NASDAQ: Total mappings now ${companyMappings.size}`);
        }
      } catch (error) {
        console.warn('NASDAQ processing failed:', error.message);
      }
    }

    // Process S&P 500 constituents
    if (sp500Response.status === 'fulfilled' && sp500Response.value) {
      try {
        const data = await sp500Response.value.json();
        if (Array.isArray(data)) {
          data.forEach(stock => {
            if (stock.symbol && stock.name) {
              const name = stock.name.toLowerCase().trim();
              const symbol = stock.symbol.toUpperCase();
              companyMappings.set(name, symbol);
            }
          });
          console.log(`S&P 500: Total mappings now ${companyMappings.size}`);
        }
      } catch (error) {
        console.warn('S&P 500 processing failed:', error.message);
      }
    }

    // Process Dow Jones constituents
    if (dowResponse.status === 'fulfilled' && dowResponse.value) {
      try {
        const data = await dowResponse.value.json();
        if (Array.isArray(data)) {
          data.forEach(stock => {
            if (stock.symbol && stock.name) {
              const name = stock.name.toLowerCase().trim();
              const symbol = stock.symbol.toUpperCase();
              companyMappings.set(name, symbol);
            }
          });
          console.log(`Dow Jones: Total mappings now ${companyMappings.size}`);
        }
      } catch (error) {
        console.warn('Dow Jones processing failed:', error.message);
      }
    }

    // Process NYSE constituents
    if (nyseResponse.status === 'fulfilled' && nyseResponse.value) {
      try {
        const data = await nyseResponse.value.json();
        if (Array.isArray(data)) {
          data.forEach(stock => {
            if (stock.symbol && stock.name) {
              const name = stock.name.toLowerCase().trim();
              const symbol = stock.symbol.toUpperCase();
              companyMappings.set(name, symbol);
            }
          });
          console.log(`NYSE: Total mappings now ${companyMappings.size}`);
        }
      } catch (error) {
        console.warn('NYSE processing failed:', error.message);
      }
    }

    // Process AMEX constituents
    if (amexResponse.status === 'fulfilled' && amexResponse.value) {
      try {
        const data = await amexResponse.value.json();
        if (Array.isArray(data)) {
          data.forEach(stock => {
            if (stock.symbol && stock.name) {
              const name = stock.name.toLowerCase().trim();
              const symbol = stock.symbol.toUpperCase();
              companyMappings.set(name, symbol);
            }
          });
          console.log(`AMEX: Total mappings now ${companyMappings.size}`);
        }
      } catch (error) {
        console.warn('AMEX processing failed:', error.message);
      }
    }

    mappingsLastUpdate = now;
    console.log(`Final company mappings loaded: ${companyMappings.size} total`);
  } catch (error) {
    console.error('Company mapping fetch error:', error.message);
  }

  return companyMappings;
}

// Extract company ticker from content
async function extractCompanyTicker(content, mappings) {
  if (!content || !mappings) return null;

  const text = content.toLowerCase();
  
  // Sort mappings by length (longest first) to prioritize more specific matches
  const sortedMappings = Array.from(mappings.entries()).sort((a, b) => b[0].length - a[0].length);
  
  // Look for exact company name matches (prioritize longer names)
  for (const [name, symbol] of sortedMappings) {
    if (text.includes(name)) {
      console.log(`Found company match: "${name}" -> ${symbol}`);
      return symbol;
    }
  }
  
  // Look for common ticker patterns in the original content (case-sensitive)
  const tickerPatterns = [
    /\$([A-Z]{1,5})\b/g,  // $AAPL, $TSLA
    /\(([A-Z]{1,5})\)/g,  // (AAPL), (TSLA)
    /\b([A-Z]{1,5})\b/g   // AAPL, TSLA
  ];
  
  for (const pattern of tickerPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        const potentialTicker = match.replace(/[$()]/g, '').toUpperCase();
        // Check if this ticker exists in our mappings
        if (Array.from(mappings.values()).includes(potentialTicker)) {
          console.log(`Found direct ticker match: ${potentialTicker}`);
          return potentialTicker;
        }
      }
    }
  }
  
  return null;
}

// Fetch news from Alpha Vantage
async function fetchAlphaVantageNews(companyMappings, limit = 100, sourceFilter = null) {
  if (!FMP_KEY) return [];
  if (sourceFilter && sourceFilter !== 'Alpha Vantage' && sourceFilter !== 'all') return [];

  try {
    const response = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${FMP_KEY}&limit=${Math.min(limit, 100)}`, {
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
async function fetchFMPNews(companyMappings, limit = 100, sourceFilter = null) {
  if (!FMP_KEY) return [];
  if (sourceFilter && sourceFilter !== 'Financial Modeling Prep' && sourceFilter !== 'FMP' && sourceFilter !== 'all') return [];

  try {
    const response = await fetch(`https://financialmodelingprep.com/api/v3/stock_news?limit=${Math.min(limit, 100)}&apikey=${FMP_KEY}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`FMP news rate limited (429), skipping FMP news`);
        return [];
      }
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
async function fetchFinnhubNews(companyMappings, limit = 100, sourceFilter = null) {
  if (!FINNHUB_KEY) return [];
  if (sourceFilter && sourceFilter !== 'Finnhub' && sourceFilter !== 'all') return [];

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
      return data.slice(0, Math.min(limit, data.length)).map(item => {
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
async function fetchNewsAPINews(companyMappings, limit = 100, sourceFilter = null) {
  if (!NEWSAPI_KEY) return [];
  if (sourceFilter && sourceFilter !== 'NewsAPI' && sourceFilter !== 'all') return [];

  try {
    const response = await fetch(`https://newsapi.org/v2/everything?q=stocks OR trading OR market&language=en&sortBy=publishedAt&pageSize=${Math.min(limit, 100)}&apiKey=${NEWSAPI_KEY}`, {
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

  // Extract ticker from content if not already present
  let ticker = item.ticker;
  if (!ticker) {
    const content = `${item.title || ''} ${item.summary || ''}`;
    const companyMappings = await fetchLiveCompanyMappings();
    ticker = await extractCompanyTicker(content, companyMappings);
  }

  // Generate sentiment from title/summary
  const sentiment = generateSentiment(item.title || '', item.summary || '');

  return {
    id: item.id,
    title: item.title || 'No title',
    summary: item.summary || '',
    source: item.source || 'Unknown',
    publishedAt: publishedAt,
    ticker: ticker,
    tickers: ticker ? [ticker] : [],
    url: finalUrl,
    sentiment: sentiment,
    badges: generateNewsBadges(item, ticker)
  };
}

// Generate sentiment from content
function generateSentiment(title, summary) {
  const content = `${title} ${summary}`.toLowerCase();
  
  const bullishWords = ['up', 'rise', 'gain', 'surge', 'rally', 'bullish', 'positive', 'beat', 'exceed', 'growth', 'profit', 'earnings', 'strong', 'buy', 'upgrade'];
  const bearishWords = ['down', 'fall', 'drop', 'decline', 'crash', 'bearish', 'negative', 'miss', 'disappoint', 'loss', 'weak', 'sell', 'downgrade', 'cut'];
  
  const bullishCount = bullishWords.filter(word => content.includes(word)).length;
  const bearishCount = bearishWords.filter(word => content.includes(word)).length;
  
  if (bullishCount > bearishCount) return 'bullish';
  if (bearishCount > bullishCount) return 'bearish';
  return 'neutral';
}

// Generate badges for news items
function generateNewsBadges(item, ticker) {
  const badges = [];
  const content = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  
  if (content.includes('earnings')) badges.push('EARNINGS');
  if (content.includes('fda') || content.includes('approval')) badges.push('FDA');
  if (content.includes('insider') || content.includes('insider trading')) badges.push('INSIDER');
  if (content.includes('ai') || content.includes('artificial intelligence')) badges.push('AI');
  if (content.includes('merger') || content.includes('acquisition')) badges.push('M&A');
  if (content.includes('ipo') || content.includes('initial public offering')) badges.push('IPO');
  if (content.includes('bankruptcy') || content.includes('chapter 11')) badges.push('BANKRUPTCY');
  if (content.includes('lawsuit') || content.includes('legal')) badges.push('LEGAL');
  if (content.includes('partnership') || content.includes('deal')) badges.push('PARTNERSHIP');
  if (content.includes('upgrade') || content.includes('downgrade')) badges.push('RATING');
  
  return badges;
}

// Main news fetching function
async function fetchRealNewsFromAPIs(limit = 200, sourceFilter = null, dateRange = 'all', searchQuery = null) {
  console.log('Fetching live news from APIs...', { limit, sourceFilter, dateRange, searchQuery });
  
  // Get company mappings first
  const companyMappings = await fetchLiveCompanyMappings();
  
  // Calculate date filter
  let dateFilter = null;
  if (dateRange && dateRange !== 'all') {
    const now = new Date();
    switch (dateRange) {
      case '1d':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '3d':
        dateFilter = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
  }
  
  // Fetch from all available sources
  const [alphaVantageNews, fmpNews, finnhubNews, newsAPINews] = await Promise.allSettled([
    fetchAlphaVantageNews(companyMappings, limit, sourceFilter),
    fetchFMPNews(companyMappings, limit, sourceFilter),
    fetchFinnhubNews(companyMappings, limit, sourceFilter),
    fetchNewsAPINews(companyMappings, limit, sourceFilter)
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

  // Apply date filter
  let filteredNews = normalizedNews;
  if (dateFilter) {
    filteredNews = normalizedNews.filter(item => {
      const itemDate = new Date(item.publishedAt);
      return itemDate >= dateFilter;
    });
    console.log(`After date filter (${dateRange}): ${filteredNews.length} items`);
  }

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredNews = filteredNews.filter(item => {
      return (item.title && item.title.toLowerCase().includes(query)) ||
             (item.summary && item.summary.toLowerCase().includes(query)) ||
             (item.ticker && item.ticker.toLowerCase().includes(query));
    });
    console.log(`After search filter ("${searchQuery}"): ${filteredNews.length} items`);
  }

  // Remove duplicates by title and publishedAt
  const seen = new Set();
  const uniqueNews = filteredNews.filter(item => {
    const key = `${item.title}_${item.publishedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by publishedAt (newest first)
  uniqueNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // Apply final limit
  const finalNews = uniqueNews.slice(0, limit);

  console.log(`Final news items: ${finalNews.length}`);
  return finalNews;
}

export default async function handler(req, res) {
  try {
    console.log('=== ENHANCED NEWS API ===');
    
    // Extract query parameters
    const { 
      limit = 200, 
      source = null, 
      dateRange = 'all', 
      search = null 
    } = req.query;
    
    console.log('Query parameters:', { limit, source, dateRange, search });
    
    const allNews = await fetchRealNewsFromAPIs(
      parseInt(limit), 
      source, 
      dateRange, 
      search
    );
    
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
        lastUpdate: new Date().toISOString(),
        filters: {
          limit: parseInt(limit),
          source: source,
          dateRange: dateRange,
          search: search
        }
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