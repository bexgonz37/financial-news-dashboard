// Phase 1: Full multi-provider news aggregation with safety nets
import fetch from 'node-fetch';
import fmpLimiter from '../lib/fmp-limiter.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory cache for news aggregation
let newsCache = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 90 * 1000; // 90 seconds

// Provider health tracking
const providerHealth = {
  fmp: { status: 'unknown', lastSuccess: null, lastError: null, rateLimitBudget: 2 },
  finnhub: { status: 'unknown', lastSuccess: null, lastError: null, rateLimitBudget: 60 },
  alphavantage: { status: 'unknown', lastSuccess: null, lastError: null, rateLimitBudget: 5 },
  yahoo: { status: 'unknown', lastSuccess: null, lastError: null, rateLimitBudget: 10 }
};

// Yahoo Finance RSS feeds
const YAHOO_FEEDS = [
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US',
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^DJI&region=US&lang=en-US',
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^IXIC&region=US&lang=en-US',
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL&region=US&lang=en-US',
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=NVDA&region=US&lang=en-US',
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=TSLA&region=US&lang=en-US',
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=MSFT&region=US&lang=en-US',
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GOOGL&region=US&lang=en-US'
];

// Extract ticker from Yahoo RSS title/description
function extractYahooTicker(title, description) {
  const text = `${title} ${description}`.toUpperCase();
  
  // Pattern: (NASDAQ: TICK) or (NYSE: TICK)
  const exchangeMatch = text.match(/\((NASDAQ|NYSE|AMEX):\s*([A-Z]{1,5}[.-]?[A-Z]?)\)/);
  if (exchangeMatch) {
    return exchangeMatch[2];
  }
  
  // Pattern: TICK: or TICK -
  const colonMatch = text.match(/\b([A-Z]{1,5}[.-]?[A-Z]?):/);
  if (colonMatch) {
    return colonMatch[1];
  }
  
  return null;
}

// Parse RSS/Atom XML
function parseRSS(xmlText) {
  try {
    const items = [];
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    const linkRegex = /<link><!\[CDATA\[(.*?)\]\]><\/link>|<link>(.*?)<\/link>/g;
    const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/g;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>|<published>(.*?)<\/published>/g;
    
    const titles = [...xmlText.matchAll(titleRegex)].map(m => m[1] || m[2]);
    const links = [...xmlText.matchAll(linkRegex)].map(m => m[1] || m[2]);
    const descriptions = [...xmlText.matchAll(descRegex)].map(m => m[1] || m[2]);
    const pubDates = [...xmlText.matchAll(pubDateRegex)].map(m => m[1] || m[2]);
    
    for (let i = 0; i < titles.length; i++) {
      if (titles[i] && !titles[i].includes('Yahoo Finance')) {
        const ticker = extractYahooTicker(titles[i], descriptions[i] || '');
        items.push({
          id: `yahoo_${Date.now()}_${i}`,
          title: titles[i].trim(),
          summary: descriptions[i]?.trim() || '',
          url: links[i] || '',
          published_at: pubDates[i] ? new Date(pubDates[i]).toISOString() : new Date().toISOString(),
          source: 'yahoo',
          symbols: ticker ? [ticker] : []
        });
      }
    }
    
    return items;
  } catch (error) {
    console.warn('RSS parsing error:', error);
    return [];
  }
}

// FMP News fetcher (with limiter)
async function fetchFMPNews(limit = 50) {
  try {
    const fmpKey = process.env.FMP_KEY;
    if (!fmpKey) {
      providerHealth.fmp.lastError = 'No API key';
      return { items: [], error: 'No FMP API key' };
    }

    const url = `https://financialmodelingprep.com/api/v3/stock_news?limit=${limit}&apikey=${fmpKey}`;
    const response = await fmpLimiter.makeRequest(url, {
      headers: { 'User-Agent': 'Financial-News-Dashboard/1.0' }
    });

    if (!response.ok) {
      const error = `FMP ${response.status}: ${response.statusText}`;
      providerHealth.fmp.lastError = error;
      return { items: [], error };
    }

    const data = await response.json();
    const items = (data || []).map(item => ({
      id: `fmp_${item.publishedDate}_${item.title?.substring(0, 20)}`,
      title: item.title || '',
      summary: item.text || '',
      url: item.url || '',
      published_at: item.publishedDate || new Date().toISOString(),
      source: 'fmp',
      symbols: item.symbol ? [item.symbol] : (item.tickers || [])
    }));

    providerHealth.fmp.status = 'success';
    providerHealth.fmp.lastSuccess = Date.now();
    return { items, error: null };

  } catch (error) {
    const errorMsg = `FMP error: ${error.message}`;
    providerHealth.fmp.lastError = errorMsg;
    return { items: [], error: errorMsg };
  }
}

// Finnhub News fetcher
async function fetchFinnhubNews(limit = 50) {
  try {
    const finnhubKey = process.env.FINNHUB_KEY;
    if (!finnhubKey) {
      providerHealth.finnhub.lastError = 'No API key';
      return { items: [], error: 'No Finnhub API key' };
    }

    const url = `https://finnhub.io/api/v1/news?category=general&minId=0&token=${finnhubKey}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Financial-News-Dashboard/1.0' },
      timeout: 5000
    });

    if (!response.ok) {
      const error = `Finnhub ${response.status}: ${response.statusText}`;
      providerHealth.finnhub.lastError = error;
      return { items: [], error };
    }

    const data = await response.json();
    const items = (data || []).slice(0, limit).map(item => ({
      id: `finnhub_${item.id || item.time}_${item.headline?.substring(0, 20)}`,
      title: item.headline || '',
      summary: item.summary || '',
      url: item.url || '',
      published_at: new Date(item.datetime * 1000).toISOString(),
      source: 'finnhub',
      symbols: item.related ? item.related.split(',').map(s => s.trim()) : []
    }));

    providerHealth.finnhub.status = 'success';
    providerHealth.finnhub.lastSuccess = Date.now();
    return { items, error: null };

  } catch (error) {
    const errorMsg = `Finnhub error: ${error.message}`;
    providerHealth.finnhub.lastError = errorMsg;
    return { items: [], error: errorMsg };
  }
}

// Alpha Vantage News fetcher
async function fetchAlphaVantageNews(limit = 50) {
  try {
    const avKey = process.env.ALPHAVANTAGE_KEY;
    if (!avKey) {
      providerHealth.alphavantage.lastError = 'No API key';
      return { items: [], error: 'No Alpha Vantage API key' };
    }

    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&sort=LATEST&apikey=${avKey}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Financial-News-Dashboard/1.0' },
      timeout: 5000
    });

    if (!response.ok) {
      const error = `Alpha Vantage ${response.status}: ${response.statusText}`;
      providerHealth.alphavantage.lastError = error;
      return { items: [], error };
    }

    const data = await response.json();
    const feed = data.feed || [];
    const items = feed.slice(0, limit).map(item => ({
      id: `av_${item.time_published}_${item.title?.substring(0, 20)}`,
      title: item.title || '',
      summary: item.summary || '',
      url: item.url || '',
      published_at: item.time_published || new Date().toISOString(),
      source: 'alphavantage',
      symbols: (item.ticker_sentiment || []).map(t => t.ticker).filter(Boolean)
    }));

    providerHealth.alphavantage.status = 'success';
    providerHealth.alphavantage.lastSuccess = Date.now();
    return { items, error: null };

  } catch (error) {
    const errorMsg = `Alpha Vantage error: ${error.message}`;
    providerHealth.alphavantage.lastError = errorMsg;
    return { items: [], error: errorMsg };
  }
}

// Yahoo RSS fetcher
async function fetchYahooNews(limit = 50) {
  try {
    const allItems = [];
    
    // Fetch from multiple Yahoo feeds in parallel
    const feedPromises = YAHOO_FEEDS.map(async (feedUrl) => {
      try {
        const response = await fetch(feedUrl, {
          headers: { 'User-Agent': 'Financial-News-Dashboard/1.0' },
          timeout: 5000
        });
        
        if (!response.ok) {
          throw new Error(`Yahoo RSS ${response.status}: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        return parseRSS(xmlText);
      } catch (error) {
        console.warn(`Yahoo feed ${feedUrl} failed:`, error.message);
        return [];
      }
    });
    
    const feedResults = await Promise.allSettled(feedPromises);
    feedResults.forEach(result => {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    });
    
    // Remove duplicates and limit
    const uniqueItems = allItems.filter((item, index, self) => 
      index === self.findIndex(t => t.title === item.title)
    ).slice(0, limit);

    providerHealth.yahoo.status = 'success';
    providerHealth.yahoo.lastSuccess = Date.now();
    return { items: uniqueItems, error: null };

  } catch (error) {
    const errorMsg = `Yahoo RSS error: ${error.message}`;
    providerHealth.yahoo.lastError = errorMsg;
    return { items: [], error: errorMsg };
  }
}

// True deduplication (same normalized title + source within ±5 minutes)
function deduplicateNews(items) {
  const seen = new Map();
  const fiveMinutes = 5 * 60 * 1000;
  
  return items.filter(item => {
    const normalizedTitle = item.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const key = `${normalizedTitle}|${item.source}`;
    const now = new Date(item.published_at).getTime();
    
    if (seen.has(key)) {
      const existing = seen.get(key);
      const timeDiff = Math.abs(now - existing.time);
      
      if (timeDiff <= fiveMinutes) {
        return false; // Duplicate within 5 minutes
      }
    }
    
    seen.set(key, { time: now });
    return true;
  });
}

// Main news aggregation function (Phase 1: All 4 providers)
async function aggregateNews(limit = 100) {
  console.log('Phase 1: Starting full multi-provider news aggregation...');
  
  // Fetch from all 4 providers in parallel
  const results = await Promise.allSettled([
    fetchFMPNews(limit),
    fetchFinnhubNews(limit),
    fetchAlphaVantageNews(limit),
    fetchYahooNews(limit)
  ]);
  
  const allItems = [];
  const errors = [];
  const counts = { fmp: 0, finnhub: 0, alphavantage: 0, yahoo: 0 };
  
  results.forEach((result, index) => {
    const providers = ['fmp', 'finnhub', 'alphavantage', 'yahoo'];
    const provider = providers[index];
    
    if (result.status === 'fulfilled') {
      const { items, error } = result.value;
      allItems.push(...items);
      counts[provider] = items.length;
      
      if (error) {
        errors.push(`${provider}: ${error}`);
      }
    } else {
      errors.push(`${provider}: ${result.reason.message}`);
    }
  });
  
  // Deduplicate and sort
  const deduplicated = deduplicateNews(allItems);
  const sorted = deduplicated.sort((a, b) => 
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
  
  console.log(`Phase 1 news aggregation complete: ${sorted.length} items from ${Object.values(counts).filter(c => c > 0).length} providers`);
  console.log(`Provider counts: FMP=${counts.fmp}, Finnhub=${counts.finnhub}, AV=${counts.alphavantage}, Yahoo=${counts.yahoo}`);
  
  return {
    items: sorted,
    meta: {
      counts,
      errors,
      updated_at: new Date().toISOString()
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 100, force = false } = req.query;
    const now = Date.now();
    
    // Check cache first
    if (!force && newsCache && (now - lastCacheUpdate) < CACHE_DURATION) {
      console.log('Serving cached news');
      return res.status(200).json({
        success: true,
        data: {
          news: newsCache.items.slice(0, parseInt(limit)),
          meta: newsCache.meta
        }
      });
    }
    
    // Fetch fresh news
    const result = await aggregateNews(parseInt(limit));
    newsCache = result;
    lastCacheUpdate = now;
    
    return res.status(200).json({
      success: true,
      data: {
        news: result.items,
        meta: result.meta
      }
    });

  } catch (error) {
    console.error('News aggregation error:', error);
    
    // Return cached data if available, even if stale
    if (newsCache) {
      console.log('Returning stale cache due to error');
      return res.status(200).json({
        success: true,
        data: {
          news: newsCache.items.slice(0, parseInt(req.query.limit || 100)),
          meta: {
            ...newsCache.meta,
            errors: [...(newsCache.meta.errors || []), `Current error: ${error.message}`]
          }
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'News aggregation failed',
      message: error.message
    });
  }
}

// Export provider health for diagnostics
export { providerHealth };