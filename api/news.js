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
    throw new Error('FMP_KEY not configured');
  }
  
  if (!canMakeRequest('fmp', 60, 60000)) {
    throw new Error('FMP rate limit exceeded');
  }
  
  const url = `https://financialmodelingprep.com/api/v3/stock_news?limit=${limit}&apikey=${apiKey}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Financial-News-Dashboard/1.0' }
    });
    clearTimeout(timeoutId);
    
    if (response.status === 429) {
      throw new Error('FMP rate limit exceeded');
    }
    
    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    
    return data.map(item => ({
      id: `fmp_${item.id || Date.now()}`,
      title: item.title || '',
      summary: item.text || '',
      url: item.url || '',
      published_at: item.publishedDate || new Date().toISOString(),
      source: 'fmp',
      symbols: item.tickers ? item.tickers.split(',').map(s => s.trim().toUpperCase()) : [],
      image: item.image || '',
      sentiment: 'neutral'
    }));
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
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
    throw new Error('FINNHUB_KEY not configured');
  }
  
  if (!canMakeRequest('finnhub', 60, 60000)) {
    throw new Error('Finnhub rate limit exceeded');
  }
  
  const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Financial-News-Dashboard/1.0' }
    });
    clearTimeout(timeoutId);
    
    if (response.status === 429) {
      throw new Error('Finnhub rate limit exceeded');
    }
    
    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    
    return data.slice(0, limit).map(item => ({
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
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Deduplicate news items by title and URL with 5-minute time window
function deduplicateNews(newsItems) {
  const seen = new Set();
  const seenTitles = new Set();
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;
  
  return newsItems.filter(item => {
    const title = item.title?.toLowerCase().trim();
    const publishedAt = new Date(item.published_at).getTime();
    
    if (!title) return false;
    
    // Skip if older than 5 minutes for deduplication
    if (now - publishedAt > FIVE_MINUTES) return true;
    
    if (seenTitles.has(title)) {
      return false;
    }
    
    seenTitles.add(title);
    return true;
  });
}

// Main news aggregation
async function fetchNewsFromProviders() {
  const results = await Promise.allSettled([
    fetchFMP(50),
    fetchAlpha(50),
    fetchFinnhub(50)
  ]);
  
  const items = [];
  const errors = [];
  const counts = { fmp: 0, alphavantage: 0, finnhub: 0 };
  
  results.forEach((result, index) => {
    const provider = ['fmp', 'alphavantage', 'finnhub'][index];
    
    if (result.status === 'fulfilled') {
      items.push(...result.value);
      counts[provider] = result.value.length;
    } else {
      errors.push(`${provider}: ${result.reason.message}`);
    }
  });
  
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