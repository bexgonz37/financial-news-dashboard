// Enhanced Multi-Source Financial News API
// Pulls from Reuters, Bloomberg, MarketWatch, Yahoo Finance, and more

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, search, sources, limit = 50 } = req.query;
    
    // Fetch from multiple sources in parallel
    const newsPromises = [];
    
    // Alpha Vantage (Reuters, Bloomberg, etc.)
    if (!sources || sources.includes('alphavantage')) {
      newsPromises.push(fetchAlphaVantageNews(ticker, search, limit));
    }
    
    // Yahoo Finance News
    if (!sources || sources.includes('yahoo')) {
      newsPromises.push(fetchYahooFinanceNews(ticker, search, limit));
    }
    
    // MarketWatch News
    if (!sources || sources.includes('marketwatch')) {
      newsPromises.push(fetchMarketWatchNews(ticker, search, limit));
    }
    
    // Financial Modeling Prep News
    if (!sources || sources.includes('fmp')) {
      newsPromises.push(fetchFMPNews(ticker, search, limit));
    }

    // Wait for all sources to complete
    const results = await Promise.allSettled(newsPromises);
    
    // Combine and deduplicate news
    const allNews = [];
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        allNews.push(...result.value);
      }
    });

    // Remove duplicates and sort by relevance
    const uniqueNews = deduplicateNews(allNews);
    const sortedNews = sortNewsByRelevance(uniqueNews, ticker, search);

    return res.status(200).json({
      success: true,
      data: {
        news: sortedNews.slice(0, limit),
        sources: ['alphavantage', 'yahoo', 'marketwatch', 'fmp'],
        total: sortedNews.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Enhanced News API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch news',
      message: error.message 
    });
  }
}

async function fetchAlphaVantageNews(ticker, search, limit) {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) return [];

  try {
    let url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${apiKey}&limit=${Math.min(limit, 200)}`;
    
    if (ticker) url += `&tickers=${ticker}`;
    if (search) url += `&topics=${search}`;

    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const news = data.feed || [];
    
    return news.map(item => ({
      ...item,
      source: 'Alpha Vantage',
      source_domain: extractDomain(item.url),
      publishedAt: item.time_published,
      category: categorizeNews(item.title, item.summary),
      sentimentScore: parseFloat(item.overall_sentiment_score) || 0,
      relevanceScore: parseFloat(item.relevance_score) || 0.5
    }));
  } catch (error) {
    console.warn('Alpha Vantage news failed:', error);
    return [];
  }
}

async function fetchYahooFinanceNews(ticker, search, limit) {
  try {
    let url = `https://query1.finance.yahoo.com/v1/finance/search?query=${encodeURIComponent(search || ticker || 'financial news')}&quotesCount=0&newsCount=${Math.min(limit, 50)}`;
    
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const news = data.news || [];
    
    return news.map(item => ({
      id: `yahoo_${item.uuid}`,
      title: item.title,
      summary: item.summary || item.title,
      url: item.link,
      source: 'Yahoo Finance',
      source_domain: 'finance.yahoo.com',
      publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
      category: categorizeNews(item.title, item.summary),
      sentimentScore: 0.5, // Default neutral
      relevanceScore: 0.7,
      ticker: ticker || 'GENERAL'
    }));
  } catch (error) {
    console.warn('Yahoo Finance news failed:', error);
    return [];
  }
}

async function fetchMarketWatchNews(ticker, search, limit) {
  try {
    // MarketWatch RSS feed
    const query = search || ticker || 'financial news';
    const url = `https://feeds.marketwatch.com/marketwatch/marketpulse/`;
    
    const response = await fetch(url);
    if (!response.ok) return [];

    // Parse RSS feed (simplified)
    const text = await response.text();
    const news = parseRSSFeed(text, limit);
    
    return news.map(item => ({
      id: `marketwatch_${item.guid}`,
      title: item.title,
      summary: item.description,
      url: item.link,
      source: 'MarketWatch',
      source_domain: 'marketwatch.com',
      publishedAt: item.pubDate,
      category: categorizeNews(item.title, item.description),
      sentimentScore: 0.5,
      relevanceScore: 0.6,
      ticker: ticker || 'GENERAL'
    }));
  } catch (error) {
    console.warn('MarketWatch news failed:', error);
    return [];
  }
}

async function fetchFMPNews(ticker, search, limit) {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) return [];

  try {
    let url = `https://financialmodelingprep.com/api/v3/stock_news?limit=${Math.min(limit, 50)}`;
    
    if (ticker) url += `&symbol=${ticker}`;
    
    const response = await fetch(url);
    if (!response.ok) return [];

    const news = await response.json();
    
    return news.map(item => ({
      id: `fmp_${item.id}`,
      title: item.title,
      summary: item.text,
      url: item.url,
      source: 'Financial Modeling Prep',
      source_domain: 'financialmodelingprep.com',
      publishedAt: item.publishedDate,
      category: categorizeNews(item.title, item.text),
      sentimentScore: 0.5,
      relevanceScore: 0.8,
      ticker: item.symbol || 'GENERAL'
    }));
  } catch (error) {
    console.warn('FMP news failed:', error);
    return [];
  }
}

function categorizeNews(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  
  if (text.includes('earnings') || text.includes('revenue') || text.includes('profit')) return 'earnings';
  if (text.includes('fda') || text.includes('approval') || text.includes('clinical')) return 'fda';
  if (text.includes('merger') || text.includes('acquisition') || text.includes('buyout')) return 'merger';
  if (text.includes('insider') || text.includes('insider trading')) return 'insider';
  if (text.includes('short') || text.includes('short interest')) return 'short';
  if (text.includes('options') || text.includes('calls') || text.includes('puts')) return 'options';
  if (text.includes('analyst') || text.includes('rating') || text.includes('upgrade')) return 'analyst';
  if (text.includes('sec') || text.includes('filing') || text.includes('10-k')) return 'sec';
  if (text.includes('dividend') || text.includes('payout')) return 'dividend';
  if (text.includes('bankruptcy') || text.includes('chapter 11')) return 'bankruptcy';
  if (text.includes('ipo') || text.includes('spac') || text.includes('public offering')) return 'ipo';
  if (text.includes('crypto') || text.includes('bitcoin') || text.includes('ethereum')) return 'crypto';
  if (text.includes('meme') || text.includes('reddit') || text.includes('wallstreetbets')) return 'meme';
  if (text.includes('biotech') || text.includes('pharma') || text.includes('drug')) return 'biotech';
  if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning')) return 'ai';
  if (text.includes('ev') || text.includes('electric vehicle') || text.includes('tesla')) return 'ev';
  if (text.includes('cannabis') || text.includes('marijuana') || text.includes('weed')) return 'cannabis';
  if (text.includes('gaming') || text.includes('video game') || text.includes('esports')) return 'gaming';
  if (text.includes('social') || text.includes('facebook') || text.includes('twitter')) return 'social';
  if (text.includes('retail') || text.includes('ecommerce') || text.includes('shopping')) return 'retail';
  
  return 'general';
}

function deduplicateNews(news) {
  const seen = new Set();
  return news.filter(item => {
    const key = `${item.title}-${item.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortNewsByRelevance(news, ticker, search) {
  return news.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    
    // Boost score for ticker matches
    if (ticker && a.ticker === ticker) scoreA += 10;
    if (ticker && b.ticker === ticker) scoreB += 10;
    
    // Boost score for search term matches
    if (search) {
      const searchLower = search.toLowerCase();
      if (a.title.toLowerCase().includes(searchLower)) scoreA += 5;
      if (a.summary.toLowerCase().includes(searchLower)) scoreA += 3;
      if (b.title.toLowerCase().includes(searchLower)) scoreB += 5;
      if (b.summary.toLowerCase().includes(searchLower)) scoreB += 3;
    }
    
    // Boost score for higher sentiment
    scoreA += a.sentimentScore * 2;
    scoreB += b.sentimentScore * 2;
    
    // Boost score for higher relevance
    scoreA += a.relevanceScore * 3;
    scoreB += b.relevanceScore * 3;
    
    // Boost score for more recent news
    const now = Date.now();
    const timeA = new Date(a.publishedAt).getTime();
    const timeB = new Date(b.publishedAt).getTime();
    scoreA += (now - timeA) / (1000 * 60 * 60 * 24); // Hours ago
    scoreB += (now - timeB) / (1000 * 60 * 60 * 24);
    
    return scoreB - scoreA;
  });
}

function extractDomain(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

function parseRSSFeed(xml, limit) {
  // Simplified RSS parsing - in production, use a proper RSS parser
  const items = [];
  const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/g;
  const linkRegex = /<link>(.*?)<\/link>/g;
  const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>/g;
  const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/g;
  const guidRegex = /<guid>(.*?)<\/guid>/g;
  
  let match;
  let count = 0;
  
  while ((match = titleRegex.exec(xml)) !== null && count < limit) {
    const title = match[1];
    const link = linkRegex.exec(xml)?.[1] || '';
    const description = descRegex.exec(xml)?.[1] || '';
    const pubDate = pubDateRegex.exec(xml)?.[1] || '';
    const guid = guidRegex.exec(xml)?.[1] || `item_${count}`;
    
    items.push({
      title,
      link,
      description,
      pubDate,
      guid
    });
    
    count++;
  }
  
  return items;
}
