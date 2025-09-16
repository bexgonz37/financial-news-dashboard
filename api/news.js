// Multi-provider news aggregation with direct fetchers
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Rate limiter for provider calls
const rateLimiter = new Map();

function canMakeRequest(provider, maxRequests = 60, windowMs = 60000) {
  const now = Date.now();
  const key = provider;
  
  if (!rateLimiter.has(key)) {
    rateLimiter.set(key, { requests: 0, windowStart: now });
  }
  
  const data = rateLimiter.get(key);
  
  // Reset window if expired
  if (now - data.windowStart > windowMs) {
    data.requests = 0;
    data.windowStart = now;
  }
  
  if (data.requests >= maxRequests) {
    return false;
  }
  
  data.requests++;
  return true;
}

// FMP News Fetcher
async function fetchFMP(limit = 50) {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) {
    console.log('FMP: No API key configured');
    return [];
  }
  
  if (!canMakeRequest('fmp', 60, 60000)) {
    console.log('FMP: Rate limit exceeded');
    return [];
  }
  
  const url = `https://financialmodelingprep.com/api/v3/stock_news?limit=${limit}&apikey=${apiKey}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  
  try {
    console.log(`FMP: Fetching from ${url}`);
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Financial-News-Dashboard/1.0' }
    });
    clearTimeout(timeoutId);
    
    console.log(`FMP: Response status ${response.status}`);
    
    if (response.status === 429) {
      console.log('FMP: Rate limit exceeded');
      return [];
    }
    
    if (!response.ok) {
      console.log(`FMP: API error ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    console.log('FMP Response structure:', typeof data, Array.isArray(data) ? 'array' : 'object');
    
    // FMP returns array directly or wrapped in data property
    const items = Array.isArray(data) ? data : (data.data || []);
    if (!Array.isArray(items)) {
      console.log('FMP: No array found in response, data:', data);
      return [];
    }
    
    console.log(`FMP: Found ${items.length} items`);
    
    const mappedItems = items.map(item => ({
      id: `fmp_${item.id || Date.now()}`,
      title: item.title || '',
      summary: item.text || item.summary || '',
      url: item.url || '',
      published_at: item.publishedDate || item.date || new Date().toISOString(),
      source: 'fmp',
      symbols: item.tickers ? item.tickers.split(',').map(s => s.trim().toUpperCase()) : 
               (item.symbol ? [item.symbol.toUpperCase()] : []),
      image: item.image || '',
      sentiment: 'neutral'
    }));
    
    console.log(`FMP: Mapped ${mappedItems.length} items with symbols:`, 
      mappedItems.filter(item => item.symbols.length > 0).length);
    
    return mappedItems;
  } catch (error) {
    clearTimeout(timeoutId);
    console.log(`FMP: Error - ${error.message}`);
    return [];
  }
}

// Alpha Vantage News Fetcher
async function fetchAlpha(limit = 50) {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) {
    throw new Error('ALPHAVANTAGE_KEY not configured');
  }
  
  if (!canMakeRequest('alphavantage', 5, 60000)) {
    throw new Error('Alpha Vantage rate limit exceeded');
  }
  
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&sort=LATEST&apikey=${apiKey}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Financial-News-Dashboard/1.0' }
    });
    clearTimeout(timeoutId);
    
    if (response.status === 429) {
      throw new Error('Alpha Vantage rate limit exceeded');
    }
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.feed || !Array.isArray(data.feed)) return [];
    
    return data.feed.slice(0, limit).map(item => ({
      id: `av_${item.uuid || Date.now()}`,
      title: item.title || '',
      summary: item.summary || '',
      url: item.url || '',
      published_at: item.time_published || new Date().toISOString(),
      source: 'alphavantage',
      symbols: item.ticker_sentiment ? 
        item.ticker_sentiment.map(ts => ts.ticker).filter(Boolean) : [],
      image: item.banner_image || '',
      sentiment: item.overall_sentiment_score ? 
        (item.overall_sentiment_score > 0.1 ? 'positive' : 
         item.overall_sentiment_score < -0.1 ? 'negative' : 'neutral') : 'neutral'
    }));
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Finnhub News Fetcher
async function fetchFinnhub(limit = 50) {
  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) {
    console.log('Finnhub: No API key configured');
    return [];
  }
  
  if (!canMakeRequest('finnhub', 60, 60000)) {
    console.log('Finnhub: Rate limit exceeded');
    return [];
  }
  
  const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  
  try {
    console.log(`Finnhub: Fetching from ${url}`);
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Financial-News-Dashboard/1.0' }
    });
    clearTimeout(timeoutId);
    
    console.log(`Finnhub: Response status ${response.status}`);
    
    if (response.status === 429) {
      console.log('Finnhub: Rate limit exceeded');
      return [];
    }
    
    if (!response.ok) {
      console.log(`Finnhub: API error ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    console.log('Finnhub Response structure:', typeof data, Array.isArray(data) ? 'array' : 'object');
    
    if (!Array.isArray(data)) {
      console.log('Finnhub: No array found in response, data:', data);
      return [];
    }
    
    console.log(`Finnhub: Found ${data.length} items`);
    
    const mappedItems = data.slice(0, limit).map(item => ({
      id: `fh_${item.id || Date.now()}`,
      title: item.headline || '',
      summary: item.summary || '',
      url: item.url || '',
      published_at: new Date(item.datetime * 1000).toISOString(),
      source: 'finnhub',
      symbols: item.related ? 
        item.related.split(',').map(s => s.trim().toUpperCase()) : [],
      image: item.image || '',
      sentiment: 'neutral'
    }));
    
    console.log(`Finnhub: Mapped ${mappedItems.length} items with symbols:`, 
      mappedItems.filter(item => item.symbols.length > 0).length);
    
    return mappedItems;
  } catch (error) {
    clearTimeout(timeoutId);
    console.log(`Finnhub: Error - ${error.message}`);
    return [];
  }
}

// Deduplicate news items by title and URL with 5-minute time window
function deduplicateNews(newsItems) {
  const seen = new Map();
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;
  
  return newsItems.filter(item => {
    const title = item.title?.toLowerCase().trim();
    const publishedAt = new Date(item.published_at).getTime();
    const source = item.source;
    
    if (!title) return false;
    
    // Skip if older than 5 minutes for deduplication
    if (now - publishedAt > FIVE_MINUTES) return true;
    
    // Create a key that includes source to allow same title from different providers
    const key = `${title}|${source}`;
    
    if (seen.has(key)) {
      return false;
    }
    
    seen.set(key, true);
    return true;
  });
}

// Main news aggregation
async function fetchNewsFromProviders() {
  console.log('Starting news aggregation from all providers...');
  
  // Force all providers to be called with individual error handling
  const fmpPromise = fetchFMP(50).catch(err => {
    console.log(`FMP: ERROR - ${err.message}`);
    return { error: err.message, items: [] };
  });
  
  const alphaPromise = fetchAlpha(50).catch(err => {
    console.log(`Alpha Vantage: ERROR - ${err.message}`);
    return { error: err.message, items: [] };
  });
  
  const finnhubPromise = fetchFinnhub(50).catch(err => {
    console.log(`Finnhub: ERROR - ${err.message}`);
    return { error: err.message, items: [] };
  });
  
  const results = await Promise.allSettled([fmpPromise, alphaPromise, finnhubPromise]);
  
  const items = [];
  const errors = [];
  const counts = { fmp: 0, alphavantage: 0, finnhub: 0 };
  
  results.forEach((result, index) => {
    const provider = ['fmp', 'alphavantage', 'finnhub'][index];
    
    if (result.status === 'fulfilled') {
      const data = result.value;
      if (data.error) {
        console.log(`${provider}: ERROR - ${data.error}`);
        errors.push(`${provider}: ${data.error}`);
      } else {
        console.log(`${provider}: SUCCESS - ${data.length} items`);
        items.push(...data);
        counts[provider] = data.length;
      }
    } else {
      console.log(`${provider}: PROMISE REJECTED - ${result.reason.message}`);
      errors.push(`${provider}: ${result.reason.message}`);
    }
  });
  
  console.log(`Total items collected: ${items.length}`);
  console.log(`Provider counts:`, counts);
  console.log(`Errors:`, errors);
  
  // Ensure we never return empty if any provider succeeded
  if (items.length === 0 && errors.length > 0) {
    console.log('All providers failed, but continuing with empty results');
  }
  
  return { items, counts, errors };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    
    console.log(`Fetching news: limit=${limitNum}`);
    
    const { items, counts, errors } = await fetchNewsFromProviders();
    
    // Deduplicate and sort
    const deduplicated = deduplicateNews(items);
    const sorted = deduplicated
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, limitNum);
    
    console.log(`News aggregation complete: ${sorted.length} items, errors: ${errors.length}`);
    console.log('Provider counts:', counts);
    
    return res.status(200).json({
      success: true,
      data: {
        news: sorted,
        meta: {
          counts,
          errors,
          total: sorted.length,
          timestamp: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('News API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch news',
      message: error.message,
      data: {
        news: [],
        meta: {
          counts: { fmp: 0, alphavantage: 0, finnhub: 0 },
          errors: [error.message],
          total: 0,
          timestamp: new Date().toISOString()
        }
      }
    });
  }
}