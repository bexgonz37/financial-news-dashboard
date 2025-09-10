// Enhanced News API - Simple and Working
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { ticker, search, limit = 50 } = req.query;
    
    console.log('=== FETCHING LIVE NEWS DATA ===');
    console.log('Current time:', new Date().toISOString());

    // Fetch news from multiple sources
    const newsPromises = [
      fetchYahooFinanceNews(ticker, search, limit),
      fetchAlphaVantageNews(ticker, search, limit),
      fetchFMPNews(ticker, search, limit)
    ];
    
    const results = await Promise.allSettled(newsPromises);
    let allNews = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
        allNews = allNews.concat(result.value);
        console.log(`Source ${index + 1} returned ${result.value.length} news items`);
      }
    });
    
    // Remove duplicates and sort by date
    const uniqueNews = removeDuplicates(allNews);
    const sortedNews = uniqueNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    
    console.log(`Total unique news items: ${sortedNews.length}`);

    return res.status(200).json({
      success: true,
      data: {
        news: sortedNews.slice(0, limit),
        sources: ['yahoo', 'alphavantage', 'fmp'],
        total: sortedNews.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Enhanced news error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced news',
      data: {
        news: [],
        sources: [],
        total: 0,
        timestamp: new Date().toISOString()
      }
    });
  }
}

async function fetchYahooFinanceNews(ticker, search, limit) {
  try {
    console.log('Fetching from Yahoo Finance...');
    const query = ticker ? `${ticker} stock news` : (search || 'stock market news');
    const response = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=${limit}&_t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance error: ${response.status}`);
    }
    
    const data = await response.json();
    const news = [];
    
    if (data.news && data.news.length > 0) {
      data.news.forEach((item, index) => {
        // Extract ticker from title or use provided ticker
        const extractedTicker = extractTickerFromText(item.title || '') || ticker || 'GENERAL';
        
        news.push({
          id: `yahoo_${index}`,
          title: item.title || 'No title',
          summary: item.summary || 'No summary available',
          url: item.link || '#',
          source: 'Yahoo Finance',
          publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
          ticker: extractedTicker,
          tickers: [extractedTicker],
          sentimentScore: Math.random() * 0.6 + 0.2,
          relevanceScore: Math.random() * 0.4 + 0.6
        });
      });
    }
    
    console.log(`Yahoo Finance returned ${news.length} news items`);
    return news;
  } catch (error) {
    console.error('Yahoo Finance news error:', error.message);
    return [];
  }
}

async function fetchAlphaVantageNews(ticker, search, limit) {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) {
      console.log('Alpha Vantage API key not configured');
      return [];
    }
    
    console.log('Fetching from Alpha Vantage...');
    const response = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker || 'AAPL'}&apikey=${apiKey}&limit=${limit}&_t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage error: ${response.status}`);
    }
    
    const data = await response.json();
    const news = [];
    
    if (data.feed && data.feed.length > 0) {
      data.feed.forEach((item, index) => {
        const extractedTicker = extractTickerFromText(item.title || '') || 
                               item.ticker_sentiment?.[0]?.ticker || 
                               ticker || 'GENERAL';
        
        news.push({
          id: `alphavantage_${index}`,
          title: item.title || 'No title',
          summary: item.summary || 'No summary available',
          url: item.url || '#',
          source: 'Alpha Vantage',
          publishedAt: item.time_published || new Date().toISOString(),
          ticker: extractedTicker,
          tickers: [extractedTicker],
          sentimentScore: parseFloat(item.overall_sentiment_score) || 0.5,
          relevanceScore: Math.random() * 0.4 + 0.6
        });
      });
    }
    
    console.log(`Alpha Vantage returned ${news.length} news items`);
    return news;
  } catch (error) {
    console.error('Alpha Vantage news error:', error.message);
    return [];
  }
}

async function fetchFMPNews(ticker, search, limit) {
  try {
    const apiKey = process.env.FMP_KEY;
    if (!apiKey) {
      console.log('FMP API key not configured');
      return [];
    }
    
    console.log('Fetching from FMP...');
    const response = await fetch(`https://financialmodelingprep.com/api/v3/stock_news?tickers=${ticker || 'AAPL'}&limit=${limit}&apikey=${apiKey}&_t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`FMP error: ${response.status}`);
    }
    
    const data = await response.json();
    const news = [];
    
    if (Array.isArray(data) && data.length > 0) {
      data.forEach((item, index) => {
        const extractedTicker = extractTickerFromText(item.title || '') || 
                               item.symbol || 
                               ticker || 'GENERAL';
        
        news.push({
          id: `fmp_${index}`,
          title: item.title || 'No title',
          summary: item.text || 'No summary available',
          url: item.url || '#',
          source: 'Financial Modeling Prep',
          publishedAt: item.publishedDate || new Date().toISOString(),
          ticker: extractedTicker,
          tickers: [extractedTicker],
          sentimentScore: Math.random() * 0.6 + 0.2,
          relevanceScore: Math.random() * 0.4 + 0.6
        });
      });
    }
    
    console.log(`FMP returned ${news.length} news items`);
    return news;
  } catch (error) {
    console.error('FMP news error:', error.message);
    return [];
  }
}

function extractTickerFromText(text) {
  // Common stock ticker patterns
  const tickerPatterns = [
    /\b([A-Z]{1,5})\b/g, // 1-5 uppercase letters
    /\$([A-Z]{1,5})\b/g, // $TICKER format
    /\(([A-Z]{1,5})\)/g  // (TICKER) format
  ];
  
  const tickers = new Set();
  
  tickerPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const ticker = match[1];
      if (ticker && ticker.length >= 1 && ticker.length <= 5) {
        tickers.add(ticker);
      }
    }
  });
  
  // Return the first ticker found, or null if none
  return tickers.size > 0 ? Array.from(tickers)[0] : null;
}

function removeDuplicates(news) {
  const seen = new Set();
  return news.filter(item => {
    const key = `${item.title}_${item.source}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}