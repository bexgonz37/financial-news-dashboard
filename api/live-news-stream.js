// Live News Stream API - Multi-source news with real-time updates
import { unifiedProviderManager } from '../lib/unified-provider-manager.js';
import { robustTickerDetector } from '../lib/robust-ticker-detector.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// News cache and deduplication
const newsCache = new Map(); // url -> news item
const recentNews = []; // Recent news for deduplication
const MAX_CACHE_SIZE = 1000;
const MAX_RECENT_NEWS = 100;

// News sources configuration
const NEWS_SOURCES = [
  { name: 'marketaux', priority: 1, enabled: !!process.env.MARKETAUX_KEY },
  { name: 'fmp', priority: 2, enabled: !!process.env.FMP_KEY },
  { name: 'finnhub', priority: 3, enabled: !!process.env.FINNHUB_KEY },
  { name: 'yahoo', priority: 4, enabled: true } // RSS, no key needed
];

// Sentiment analysis (simplified)
function analyzeSentiment(text) {
  const positiveWords = ['up', 'rise', 'gain', 'surge', 'rally', 'bullish', 'positive', 'growth', 'profit', 'beat', 'exceed'];
  const negativeWords = ['down', 'fall', 'drop', 'decline', 'crash', 'bearish', 'negative', 'loss', 'miss', 'disappoint', 'warn'];
  
  const words = text.toLowerCase().split(/\s+/);
  const positiveCount = words.filter(word => positiveWords.includes(word)).length;
  const negativeCount = words.filter(word => negativeWords.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Generate news badges
function generateBadges(title, summary) {
  const badges = [];
  const text = `${title} ${summary}`.toLowerCase();
  
  if (text.includes('earnings') || text.includes('eps')) badges.push('EARNINGS');
  if (text.includes('merger') || text.includes('acquisition')) badges.push('M&A');
  if (text.includes('guidance') || text.includes('forecast')) badges.push('GUIDANCE');
  if (text.includes('fda') || text.includes('approval')) badges.push('REGULATORY');
  if (text.includes('ipo') || text.includes('public offering')) badges.push('IPO');
  if (text.includes('dividend')) badges.push('DIVIDEND');
  if (text.includes('split') || text.includes('stock split')) badges.push('SPLIT');
  
  return badges;
}

// Deduplicate news
function deduplicateNews(newsItems) {
  const unique = [];
  const seenUrls = new Set();
  const seenTitles = new Set();
  
  for (const item of newsItems) {
    const url = item.url || '';
    const title = item.title || '';
    const normalizedTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    // Skip if we've seen this URL or very similar title
    if (seenUrls.has(url) || seenTitles.has(normalizedTitle)) {
      continue;
    }
    
    seenUrls.add(url);
    seenTitles.add(normalizedTitle);
    unique.push(item);
  }
  
  return unique;
}

// Fetch news from all sources
async function fetchAllNews(limit = 100) {
  const allNews = [];
  const errors = [];
  
  // Try each source in priority order
  for (const source of NEWS_SOURCES) {
    if (!source.enabled) continue;
    
    try {
      let newsItems = [];
      
      if (source.name === 'yahoo') {
        newsItems = await fetchYahooNews(limit);
      } else {
        newsItems = await unifiedProviderManager.getNews({
          limit: Math.min(limit, 50),
          source: source.name
        });
      }
      
      if (newsItems && newsItems.length > 0) {
        allNews.push(...newsItems);
        console.log(`📰 ${source.name}: ${newsItems.length} items`);
      }
      
    } catch (error) {
      errors.push(`${source.name}: ${error.message}`);
      console.warn(`❌ ${source.name} failed:`, error.message);
    }
  }
  
  return { news: allNews, errors };
}

// Fetch Yahoo Finance news via RSS
async function fetchYahooNews(limit = 50) {
  try {
    const rssUrl = 'https://feeds.finance.yahoo.com/rss/2.0/headline';
    const response = await fetch(rssUrl);
    
    if (!response.ok) {
      throw new Error(`Yahoo RSS error: ${response.status}`);
    }
    
    const xml = await response.text();
    const newsItems = parseRSSFeed(xml, limit);
    
    return newsItems.map(item => ({
      id: `yahoo_${Date.now()}_${Math.random()}`,
      title: item.title,
      summary: item.description,
      url: item.link,
      publishedAt: item.pubDate,
      source: 'Yahoo Finance',
      category: 'General',
      tickers: [],
      sentiment: 'neutral',
      badges: []
    }));
    
  } catch (error) {
    console.warn('Yahoo RSS fetch failed:', error.message);
    return [];
  }
}

// Simple RSS parser
function parseRSSFeed(xml, limit) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let count = 0;
  
  while ((match = itemRegex.exec(xml)) && count < limit) {
    const itemXml = match[1];
    const title = extractXmlValue(itemXml, 'title');
    const description = extractXmlValue(itemXml, 'description');
    const link = extractXmlValue(itemXml, 'link');
    const pubDate = extractXmlValue(itemXml, 'pubDate');
    
    if (title && link) {
      items.push({
        title: decodeHtmlEntities(title),
        description: decodeHtmlEntities(description),
        link,
        pubDate: new Date(pubDate).toISOString()
      });
      count++;
    }
  }
  
  return items;
}

function extractXmlValue(xml, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Process news items
async function processNewsItems(rawNews) {
  const processed = [];
  
  for (const item of rawNews) {
    try {
      // Detect tickers
      const tickerResult = await robustTickerDetector.detectTickers(item);
      
      // Analyze sentiment
      const sentiment = analyzeSentiment(`${item.title || ''} ${item.summary || ''}`);
      
      // Generate badges
      const badges = generateBadges(item.title || '', item.summary || '');
      
      // Calculate news impact (placeholder)
      const newsImpact = calculateNewsImpact(item, tickerResult.tickers);
      
      const processedItem = {
        id: item.id || `news_${Date.now()}_${Math.random()}`,
        title: item.title || '',
        summary: item.summary || '',
        url: item.url || '',
        publishedAt: item.publishedAt || item.date || new Date().toISOString(),
        source: item.source || 'Unknown',
        category: item.category || 'General',
        tickers: tickerResult.tickers,
        tickerCount: tickerResult.tickers.length,
        hasTickers: tickerResult.tickers.length > 0,
        matchDetails: tickerResult.matchDetails || [],
        sentiment,
        badges,
        newsImpact,
        isGeneral: tickerResult.isGeneral || false,
        confidence: tickerResult.confidence || 0,
        lastUpdate: new Date().toISOString()
      };
      
      processed.push(processedItem);
      
    } catch (error) {
      console.warn('Error processing news item:', error.message);
    }
  }
  
  return processed;
}

// Calculate news impact (placeholder)
function calculateNewsImpact(item, tickers) {
  // This would calculate price impact based on ticker data
  // For now, return a placeholder
  return {
    score: Math.random() * 100,
    priceChange: 0,
    volumeChange: 0,
    timestamp: new Date().toISOString()
  };
}

// Main API handler
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const source = searchParams.get('source');
    const category = searchParams.get('category');
    const ticker = searchParams.get('ticker');
    
    console.log(`📰 Fetching live news: limit=${limit}, source=${source || 'all'}`);
    
    // Fetch news from all sources
    const { news: rawNews, errors } = await fetchAllNews(limit);
    
    // Process news items
    const processedNews = await processNewsItems(rawNews);
    
    // Apply filters
    let filteredNews = processedNews;
    
    if (source) {
      filteredNews = filteredNews.filter(item => item.source.toLowerCase().includes(source.toLowerCase()));
    }
    
    if (category) {
      filteredNews = filteredNews.filter(item => item.category.toLowerCase().includes(category.toLowerCase()));
    }
    
    if (ticker) {
      filteredNews = filteredNews.filter(item => item.tickers.includes(ticker.toUpperCase()));
    }
    
    // Deduplicate
    filteredNews = deduplicateNews(filteredNews);
    
    // Sort by published date (newest first)
    filteredNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    
    // Limit results
    filteredNews = filteredNews.slice(0, limit);
    
    // Update cache
    filteredNews.forEach(item => {
      newsCache.set(item.url, item);
    });
    
    // Clean up cache if it gets too large
    if (newsCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(newsCache.entries());
      const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE);
      toDelete.forEach(([key]) => newsCache.delete(key));
    }
    
    // Update recent news for deduplication
    recentNews.unshift(...filteredNews);
    if (recentNews.length > MAX_RECENT_NEWS) {
      recentNews.splice(MAX_RECENT_NEWS);
    }
    
    console.log(`✅ Live news: ${filteredNews.length} items, ${errors.length} errors`);
    
    return Response.json({
      success: true,
      data: {
        news: filteredNews,
        count: filteredNews.length,
        sources: NEWS_SOURCES.filter(s => s.enabled).map(s => s.name),
        errors: errors.length > 0 ? errors : undefined,
        lastUpdate: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Live news stream error:', error);
    return Response.json({
      success: false,
      error: 'News stream failed',
      message: error.message
    }, { status: 500 });
  }
}
