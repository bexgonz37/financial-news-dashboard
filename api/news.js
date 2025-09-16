// Consolidated News API - Multi-source news aggregation
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

// Deduplicate news items
function deduplicateNews(newsItems) {
  const seen = new Set();
  const seenTitles = new Set();
  
  return newsItems.filter(item => {
    const url = normalizeUrl(item.url);
    const title = item.title?.toLowerCase().trim();
    
    if (!url || !title) return false;
    
    const key = `${url}|${title}`;
    if (seen.has(key) || seenTitles.has(title)) {
      return false;
    }
    
    seen.add(key);
    seenTitles.add(title);
    return true;
  });
}

// Normalize news item structure
function normalizeNewsItem(item, source) {
  return {
    id: item.id || `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: item.title || item.headline || '',
    summary: item.summary || item.description || '',
    url: normalizeUrl(item.url || item.link || ''),
    publishedAt: item.publishedAt || item.published_at || item.pubDate || new Date().toISOString(),
    source: source,
    author: item.author || '',
    category: item.category || 'general',
    tickers: item.tickers || [],
    image: item.image || item.imageUrl || '',
    sentiment: item.sentiment || 'neutral',
    priority: item.priority || 'normal'
  };
}

// Fetch news from multiple providers
async function fetchNewsFromProviders() {
  const providers = [
    { name: 'finnhub', priority: 1 },
    { name: 'fmp', priority: 2 },
    { name: 'alpha_vantage', priority: 3 }
  ];

  const newsPromises = providers.map(async (provider) => {
    try {
      const news = await providerQueue.getNews(provider.name);
      return news.map(item => normalizeNewsItem(item, provider.name));
    } catch (error) {
      console.error(`Error fetching news from ${provider.name}:`, error);
      return [];
    }
  });

  const results = await Promise.allSettled(newsPromises);
  const allNews = results
    .filter(result => result.status === 'fulfilled')
    .flatMap(result => result.value);

  return deduplicateNews(allNews);
}

// Main handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 50, category = 'all', source = 'all' } = req.query;
    
    // Check cache first
    const cacheKey = `news-${category}-${source}-${limit}`;
    const cached = sharedCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minutes
      return res.status(200).json({
        success: true,
        data: {
          news: cached.data,
          total: cached.data.length,
          cached: true,
          timestamp: cached.timestamp
        }
      });
    }

    // Fetch fresh news
    const newsItems = await fetchNewsFromProviders();
    
    // Filter by category and source
    let filteredNews = newsItems;
    
    if (category !== 'all') {
      filteredNews = filteredNews.filter(item => 
        item.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    if (source !== 'all') {
      filteredNews = filteredNews.filter(item => 
        item.source.toLowerCase() === source.toLowerCase()
      );
    }

    // Sort by published date (newest first)
    filteredNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    
    // Apply limit
    const limitedNews = filteredNews.slice(0, parseInt(limit));

    // Cache the results
    sharedCache.set(cacheKey, {
      data: limitedNews,
      timestamp: Date.now()
    });

    return res.status(200).json({
      success: true,
      data: {
        news: limitedNews,
        total: limitedNews.length,
        cached: false,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('News API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch news',
      message: error.message
    });
  }
}
