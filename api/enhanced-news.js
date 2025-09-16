// Live News API - Real Financial News Aggregation
import fetch from 'node-fetch';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { providerQueue } from '../lib/provider-queue.js';
import { sharedCache } from '../lib/shared-cache.js';
import { singleTickerResolver } from '../lib/single-ticker-resolver.js';

// URL validation and normalization
function isHttp(url) {
  try {
    return /^https?:\/\//i.test(url);
  } catch {
    return false;
  }
}

function normalizeUrl(url) {
  if (!url || !isHttp(url)) return null;
  try {
    const u = new URL(url);
    return u.href;
  } catch {
    return null;
  }
}

// Sentiment analysis (simple)
function generateSentiment(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  
  const positiveWords = ['up', 'rise', 'gain', 'surge', 'rally', 'bullish', 'positive', 'growth', 'profit', 'beat', 'exceed', 'strong', 'optimistic'];
  const negativeWords = ['down', 'fall', 'drop', 'decline', 'crash', 'bearish', 'negative', 'loss', 'miss', 'weak', 'pessimistic', 'concern', 'risk'];
  
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// News badges
function generateNewsBadges(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  const badges = [];
  
  if (text.includes('earnings') || text.includes('eps')) badges.push('earnings');
  if (text.includes('guidance') || text.includes('forecast')) badges.push('guidance');
  if (text.includes('merger') || text.includes('acquisition')) badges.push('m&a');
  if (text.includes('lawsuit') || text.includes('legal')) badges.push('regulatory');
  if (text.includes('dividend')) badges.push('dividend');
  if (text.includes('split')) badges.push('corporate-action');
  
  return badges;
}

// News impact calculation
function calculateNewsImpact(tickers, publishedAt) {
  if (!tickers || tickers.length === 0) return null;
  
  // Simplified impact calculation
  return {
    score: Math.random() * 100, // Placeholder
    direction: Math.random() > 0.5 ? 'positive' : 'negative',
    magnitude: Math.random() * 10
  };
}

// Fetch news from FMP
async function fetchFMPNews(params) {
  const { limit = 100, ticker = null, search = null } = params;
  const apiKey = process.env.FMP_KEY;
  
  if (!apiKey) {
    throw new Error('FMP_KEY not configured');
  }
  
  let url = `https://financialmodelingprep.com/api/v3/stock_news?limit=${Math.min(limit, 100)}&apikey=${apiKey}`;
  
  if (ticker) {
    url = `https://financialmodelingprep.com/api/v3/stock_news?tickers=${ticker}&limit=${Math.min(limit, 100)}&apikey=${apiKey}`;
  }
  
  const response = await fetch(url, { 
    cache: 'no-store',
    timeout: 10000
  });
  
  if (!response.ok) {
    throw new Error(`FMP API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!Array.isArray(data)) return [];
  
  return data.map(item => ({
    id: `fmp_${item.id || Date.now()}`,
    title: item.title || '',
    summary: item.text || '',
    source: item.site || 'FMP',
    publishedAt: new Date(item.publishedDate).toISOString(),
    url: normalizeUrl(item.url) || '#',
    ticker: item.symbol || null,
    category: item.category || null
  }));
}

// Fetch news from Finnhub
async function fetchFinnhubNews(params) {
  const { limit = 100, ticker = null } = params;
  const apiKey = process.env.FINNHUB_KEY;
  
  if (!apiKey) {
    throw new Error('FINNHUB_KEY not configured');
  }
  
  let url = `https://finnhub.io/api/v1/company-news?symbol=${ticker || 'AAPL'}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${apiKey}`;
  
  const response = await fetch(url, { 
    cache: 'no-store',
    timeout: 10000
  });
  
  if (!response.ok) {
    throw new Error(`Finnhub API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!Array.isArray(data)) return [];
  
  return data.slice(0, limit).map(item => ({
    id: `finnhub_${item.id || Date.now()}`,
    title: item.headline || '',
    summary: item.summary || '',
    source: item.source || 'Finnhub',
    publishedAt: new Date(item.datetime * 1000).toISOString(),
    url: normalizeUrl(item.url) || '#',
    ticker: item.related || null,
    category: item.category || null
  }));
}

// Main API handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      limit = 200, 
      source = null, 
      dateRange = 'all', 
      search = null 
    } = req.query;
    
    console.log('News API request:', { limit, source, dateRange, search });
    
    // Check cache first
    const cachedNews = sharedCache.getNews();
    if (cachedNews.length > 0) {
      console.log(`Serving ${cachedNews.length} cached news items`);
      return res.status(200).json({
        success: true,
        data: {
          news: cachedNews,
          count: cachedNews.length,
          lastUpdate: new Date().toISOString(),
          cached: true,
          providerStatus: 'healthy'
        }
      });
    }
    
    // Fetch news from providers
    let allNews = [];
    let errors = [];
    let providerStatus = 'offline';
    
    // Try FMP first
    try {
      if (providerQueue.canMakeRequest('fmp')) {
        const fmpNews = await fetchFMPNews({ limit, ticker: search, search });
        allNews.push(...fmpNews);
        providerQueue.handleResponse('fmp', true);
        console.log(`FMP: ${fmpNews.length} news items`);
      }
    } catch (error) {
      providerQueue.handleResponse('fmp', false, error);
      errors.push(`FMP: ${error.message}`);
      console.warn('FMP news failed:', error.message);
    }
    
    // Try Finnhub if we need more news
    if (allNews.length < 50) {
      try {
        if (providerQueue.canMakeRequest('finnhub')) {
          const finnhubNews = await fetchFinnhubNews({ limit: 50, ticker: search });
          allNews.push(...finnhubNews);
          providerQueue.handleResponse('finnhub', true);
          console.log(`Finnhub: ${finnhubNews.length} news items`);
        }
      } catch (error) {
        providerQueue.handleResponse('finnhub', false, error);
        errors.push(`Finnhub: ${error.message}`);
        console.warn('Finnhub news failed:', error.message);
      }
    }
    
    // Determine provider status
    if (allNews.length > 0) {
      providerStatus = errors.length > 0 ? 'degraded' : 'healthy';
    } else if (errors.length > 0) {
      providerStatus = 'degraded';
    } else {
      providerStatus = 'offline';
    }
    
    // Process news with ticker extraction
    const processedNews = [];
    
    for (const item of allNews) {
      try {
        // Resolve single ticker
        const tickerResult = await singleTickerResolver.resolveTicker(item);
        
        // Generate sentiment and badges
        const sentiment = generateSentiment(item.title || '', item.summary || '');
        const badges = generateNewsBadges(item.title || '', item.summary || '');
        const newsImpact = calculateNewsImpact([tickerResult.primaryTicker], item.publishedAt);
        
        processedNews.push({
          ...item,
          primaryTicker: tickerResult.primaryTicker,
          secondaryTickers: tickerResult.secondaryTickers,
          isGeneral: tickerResult.isGeneral,
          tickerReason: tickerResult.reason,
          matchDetails: tickerResult.matchDetails,
          sentiment,
          badges,
          newsImpact
        });
        
      } catch (error) {
        console.warn(`Error processing news item ${item.id}:`, error.message);
        // Still include the item but without ticker data
        processedNews.push({
          ...item,
          primaryTicker: null,
          secondaryTickers: [],
          isGeneral: true,
          tickerReason: 'Processing error',
          matchDetails: [],
          sentiment: generateSentiment(item.title || '', item.summary || ''),
          badges: generateNewsBadges(item.title || '', item.summary || ''),
          newsImpact: null
        });
      }
    }
    
    // Cache the processed news
    sharedCache.setNews(processedNews);
    
    // If no news and providers are failing, show error state
    if (processedNews.length === 0 && providerStatus === 'offline') {
      return res.status(200).json({
        success: true,
        data: {
          news: [{
            id: 'no-news-error',
            title: 'No news providers available',
            summary: 'All news providers are offline or rate limited. Please check your API keys.',
            source: 'System',
            publishedAt: new Date().toISOString(),
            url: '#',
            primaryTicker: null,
            secondaryTickers: [],
            isGeneral: true,
            tickerReason: 'System error',
            sentiment: 'neutral',
            badges: ['error'],
            newsImpact: null,
            isError: true
          }],
          count: 1,
          lastUpdate: new Date().toISOString(),
          providerStatus,
          errors
        }
      });
    }
    
    console.log(`Processed ${processedNews.length} news items, status: ${providerStatus}`);
    
    return res.status(200).json({
      success: true,
      data: {
        news: processedNews,
        count: processedNews.length,
        lastUpdate: new Date().toISOString(),
        providerStatus,
        errors
      }
    });

  } catch (error) {
    console.error('News API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
