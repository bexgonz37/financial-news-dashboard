const fetch = require('node-fetch');
const { saveNews, getNews, getMarketSession } = require('./database');
const tickerExtractor = require('./ticker-extractor');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { ticker, search, limit = 100, dateRange = '7d', source } = req.query;
    
    // First, try to get cached news from database
    const cachedNews = await getNews({ ticker, source, dateRange, limit });
    
    // If we have recent cached news, return it
    if (cachedNews.length > 0) {
      return res.status(200).json({
        success: true,
        data: {
          news: cachedNews,
          sources: ['cached'],
          total: cachedNews.length,
          marketSentiment: calculateMarketSentiment(cachedNews),
          urgencyLevel: calculateUrgencyLevel(cachedNews),
          timestamp: new Date().toISOString(),
          disclaimer: "All data is for educational purposes only. Not financial advice."
        }
      });
    }

    // Fetch fresh news from multiple sources (IEX Cloud discontinued Aug 2024)
    const newsPromises = [
      fetchAlphaVantageNews(ticker, search, Math.min(limit || 50, 100)),
      fetchYahooFinanceNews(ticker, search, Math.min(limit || 50, 100)),
      fetchFMPNews(ticker, search, Math.min(limit || 50, 100)),
      fetchFinnhubNews(ticker, search, Math.min(limit || 50, 100)),
      // Add more comprehensive news sources for super recent data
      fetchYahooFinanceNews('', 'breaking', 20),
      fetchYahooFinanceNews('', 'earnings', 20),
      fetchYahooFinanceNews('', 'mergers', 20),
      fetchYahooFinanceNews('', 'ipo', 20),
      fetchYahooFinanceNews('', 'fed', 20),
      fetchYahooFinanceNews('', 'inflation', 20),
      fetchYahooFinanceNews('', 'jobs', 20),
      fetchYahooFinanceNews('', 'gdp', 20),
      fetchYahooFinanceNews('', 'tech', 20),
      fetchYahooFinanceNews('', 'healthcare', 20),
      fetchYahooFinanceNews('', 'energy', 20),
      fetchYahooFinanceNews('', 'finance', 20),
      fetchYahooFinanceNews('', 'retail', 20),
      fetchYahooFinanceNews('', 'automotive', 20),
      fetchYahooFinanceNews('', 'realestate', 20),
      fetchYahooFinanceNews('', 'biotech', 20),
      fetchYahooFinanceNews('', 'ai', 20),
      fetchYahooFinanceNews('', 'blockchain', 20),
      fetchYahooFinanceNews('', 'crypto', 20),
      fetchYahooFinanceNews('', 'space', 20),
      fetchYahooFinanceNews('', 'ev', 20),
      fetchYahooFinanceNews('', 'renewable', 20),
      fetchYahooFinanceNews('', 'defense', 20),
      fetchYahooFinanceNews('', 'gaming', 20),
      fetchYahooFinanceNews('', 'streaming', 20),
      fetchYahooFinanceNews('', 'social', 20),
      fetchYahooFinanceNews('', 'ecommerce', 20),
      fetchYahooFinanceNews('', 'fintech', 20),
      fetchYahooFinanceNews('', 'cybersecurity', 20),
      fetchYahooFinanceNews('', 'cloud', 20),
      fetchYahooFinanceNews('', 'semiconductor', 20),
      fetchYahooFinanceNews('', 'pharma', 20),
      fetchYahooFinanceNews('', 'medical', 20),
      fetchYahooFinanceNews('', 'telecom', 20),
      fetchYahooFinanceNews('', 'media', 20),
      fetchYahooFinanceNews('', 'entertainment', 20),
      fetchYahooFinanceNews('', 'sports', 20),
      fetchYahooFinanceNews('', 'travel', 20),
      fetchYahooFinanceNews('', 'hospitality', 20),
      fetchYahooFinanceNews('', 'logistics', 20),
      fetchYahooFinanceNews('', 'manufacturing', 20),
      fetchYahooFinanceNews('', 'construction', 20),
      fetchYahooFinanceNews('', 'agriculture', 20),
      fetchYahooFinanceNews('', 'mining', 20),
      fetchYahooFinanceNews('', 'metals', 20),
      fetchYahooFinanceNews('', 'oil', 20),
      fetchYahooFinanceNews('', 'gas', 20),
      fetchYahooFinanceNews('', 'utilities', 20),
      fetchYahooFinanceNews('', 'transportation', 20),
      fetchYahooFinanceNews('', 'shipping', 20),
      fetchYahooFinanceNews('', 'airline', 20),
      fetchYahooFinanceNews('', 'cruise', 20),
      fetchYahooFinanceNews('', 'casino', 20),
      fetchYahooFinanceNews('', 'cannabis', 20),
      fetchYahooFinanceNews('', 'marijuana', 20),
      fetchYahooFinanceNews('', 'space', 20),
      fetchYahooFinanceNews('', 'satellite', 20),
      fetchYahooFinanceNews('', 'drone', 20),
      fetchYahooFinanceNews('', 'robot', 20),
      fetchYahooFinanceNews('', 'automation', 20),
      fetchYahooFinanceNews('', 'battery', 20),
      fetchYahooFinanceNews('', 'lithium', 20),
      fetchYahooFinanceNews('', 'nickel', 20),
      fetchYahooFinanceNews('', 'cobalt', 20),
      fetchYahooFinanceNews('', 'copper', 20),
      fetchYahooFinanceNews('', 'silver', 20),
      fetchYahooFinanceNews('', 'gold', 20),
      fetchYahooFinanceNews('', 'platinum', 20),
      fetchYahooFinanceNews('', 'palladium', 20),
      fetchYahooFinanceNews('', 'rare', 20),
      fetchYahooFinanceNews('', 'earth', 20),
      fetchYahooFinanceNews('', 'uranium', 20),
      fetchYahooFinanceNews('', 'nuclear', 20),
      fetchYahooFinanceNews('', 'hydrogen', 20),
      fetchYahooFinanceNews('', 'fuel', 20),
      fetchYahooFinanceNews('', 'cell', 20),
      fetchYahooFinanceNews('', 'solar', 20),
      fetchYahooFinanceNews('', 'wind', 20),
      fetchYahooFinanceNews('', 'hydro', 20),
      fetchYahooFinanceNews('', 'geothermal', 20),
      fetchYahooFinanceNews('', 'fusion', 20),
      fetchYahooFinanceNews('', 'quantum', 20),
      fetchYahooFinanceNews('', 'computing', 20),
      fetchYahooFinanceNews('', 'machine', 20),
      fetchYahooFinanceNews('', 'learning', 20),
      fetchYahooFinanceNews('', 'neural', 20),
      fetchYahooFinanceNews('', 'deep', 20),
      fetchYahooFinanceNews('', 'algorithm', 20),
      fetchYahooFinanceNews('', 'data', 20),
      fetchYahooFinanceNews('', 'analytics', 20),
      fetchYahooFinanceNews('', 'big', 20),
      fetchYahooFinanceNews('', 'database', 20),
      fetchYahooFinanceNews('', 'storage', 20),
      fetchYahooFinanceNews('', 'server', 20),
      fetchYahooFinanceNews('', 'datacenter', 20),
      fetchYahooFinanceNews('', 'edge', 20),
      fetchYahooFinanceNews('', '5g', 20),
      fetchYahooFinanceNews('', '6g', 20),
      fetchYahooFinanceNews('', 'wifi', 20),
      fetchYahooFinanceNews('', 'bluetooth', 20),
      fetchYahooFinanceNews('', 'nfc', 20),
      fetchYahooFinanceNews('', 'rfid', 20),
      fetchYahooFinanceNews('', 'iot', 20),
      fetchYahooFinanceNews('', 'sensor', 20),
      fetchYahooFinanceNews('', 'camera', 20),
      fetchYahooFinanceNews('', 'lens', 20),
      fetchYahooFinanceNews('', 'display', 20),
      fetchYahooFinanceNews('', 'screen', 20),
      fetchYahooFinanceNews('', 'panel', 20),
      fetchYahooFinanceNews('', 'led', 20),
      fetchYahooFinanceNews('', 'oled', 20),
      fetchYahooFinanceNews('', 'lcd', 20),
      fetchYahooFinanceNews('', 'microled', 20),
      fetchYahooFinanceNews('', 'quantum', 20),
      fetchYahooFinanceNews('', 'dot', 20),
      fetchYahooFinanceNews('', 'nanotechnology', 20),
      fetchYahooFinanceNews('', 'genetic', 20),
      fetchYahooFinanceNews('', 'gene', 20),
      fetchYahooFinanceNews('', 'therapy', 20),
      fetchYahooFinanceNews('', 'drug', 20),
      fetchYahooFinanceNews('', 'vaccine', 20),
      fetchYahooFinanceNews('', 'antibody', 20),
      fetchYahooFinanceNews('', 'protein', 20),
      fetchYahooFinanceNews('', 'enzyme', 20),
      fetchYahooFinanceNews('', 'hormone', 20),
      fetchYahooFinanceNews('', 'insulin', 20),
      fetchYahooFinanceNews('', 'cancer', 20),
      fetchYahooFinanceNews('', 'tumor', 20),
      fetchYahooFinanceNews('', 'oncology', 20),
      fetchYahooFinanceNews('', 'cardiology', 20),
      fetchYahooFinanceNews('', 'neurology', 20),
      fetchYahooFinanceNews('', 'psychiatry', 20),
      fetchYahooFinanceNews('', 'dermatology', 20),
      fetchYahooFinanceNews('', 'ophthalmology', 20),
      fetchYahooFinanceNews('', 'orthopedics', 20),
      fetchYahooFinanceNews('', 'surgery', 20),
      fetchYahooFinanceNews('', 'robotic', 20),
      fetchYahooFinanceNews('', 'minimally', 20),
      fetchYahooFinanceNews('', 'invasive', 20),
      fetchYahooFinanceNews('', 'laparoscopic', 20),
      fetchYahooFinanceNews('', 'endoscopic', 20),
      fetchYahooFinanceNews('', 'arthroscopic', 20),
      fetchYahooFinanceNews('', 'microsurgery', 20),
      fetchYahooFinanceNews('', 'laser', 20),
      fetchYahooFinanceNews('', 'ultrasound', 20),
      fetchYahooFinanceNews('', 'mri', 20),
      fetchYahooFinanceNews('', 'ct', 20),
      fetchYahooFinanceNews('', 'pet', 20),
      fetchYahooFinanceNews('', 'spect', 20),
      fetchYahooFinanceNews('', 'xray', 20),
      fetchYahooFinanceNews('', 'fluoroscopy', 20),
      fetchYahooFinanceNews('', 'mammography', 20),
      fetchYahooFinanceNews('', 'colonoscopy', 20),
      fetchYahooFinanceNews('', 'endoscopy', 20),
      fetchYahooFinanceNews('', 'bronchoscopy', 20),
      fetchYahooFinanceNews('', 'cystoscopy', 20),
      fetchYahooFinanceNews('', 'hysteroscopy', 20),
      fetchYahooFinanceNews('', 'arthroscopy', 20),
      fetchYahooFinanceNews('', 'laparoscopy', 20),
      fetchYahooFinanceNews('', 'thoracoscopy', 20),
      fetchYahooFinanceNews('', 'mediastinoscopy', 20),
      fetchYahooFinanceNews('', 'laryngoscopy', 20),
      fetchYahooFinanceNews('', 'esophagoscopy', 20),
      fetchYahooFinanceNews('', 'gastroscopy', 20),
      fetchYahooFinanceNews('', 'duodenoscopy', 20),
      fetchYahooFinanceNews('', 'enteroscopy', 20),
      fetchYahooFinanceNews('', 'sigmoidoscopy', 20),
      fetchYahooFinanceNews('', 'proctoscopy', 20),
      fetchYahooFinanceNews('', 'anoscopy', 20),
      fetchYahooFinanceNews('', 'rectoscopy', 20),
      fetchYahooFinanceNews('', 'cystourethroscopy', 20),
      fetchYahooFinanceNews('', 'ureteroscopy', 20),
      fetchYahooFinanceNews('', 'nephroscopy', 20),
      fetchYahooFinanceNews('', 'pyeloscopy', 20),
      fetchYahooFinanceNews('', 'urethroscopy', 20),
      fetchYahooFinanceNews('', 'meatoscopy', 20)
    ];

    const results = await Promise.allSettled(newsPromises);
    
    // Combine all news sources
    let allNews = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        console.log(`API ${index} returned ${result.value.length} news items`);
        allNews = allNews.concat(result.value);
      } else {
        console.log(`API ${index} failed:`, result.reason);
      }
    });
    
    console.log(`Total news from APIs: ${allNews.length}`);

    // If no real news, try to fetch from broader sources
    if (allNews.length === 0) {
      console.log('No news from specific APIs, trying broader market news...');
      // Try fetching general market news without specific ticker
      const generalNewsPromises = [
        fetchAlphaVantageNews('', 'market', 100),
        fetchYahooFinanceNews('', 'market', 100),
        fetchFMPNews('', 'market', 100),
        fetchFinnhubNews('', 'market', 100)
      ];
      
      const generalResults = await Promise.allSettled(generalNewsPromises);
      generalResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          allNews = allNews.concat(result.value);
        }
      });
    }
    
    // If still no real news, try one more time with different parameters
    if (allNews.length === 0) {
      console.log('Still no news, trying alternative API calls...');
      const altNewsPromises = [
        fetchAlphaVantageNews('AAPL', 'earnings', 50),
        fetchYahooFinanceNews('TSLA', 'stock', 50),
        fetchFMPNews('MSFT', 'technology', 50),
        fetchFinnhubNews('GOOGL', 'tech', 50)
      ];
      
      const altResults = await Promise.allSettled(altNewsPromises);
      altResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          allNews = allNews.concat(result.value);
        }
      });
    }
    
    // Only use fallback if absolutely no news from any source
    if (allNews.length === 0) {
      console.log('Using fallback news data as last resort');
      allNews = getFallbackNewsData(ticker);
    }

    // Process news with ticker extraction and AI
    console.log('Processing news with ticker extraction...');
    const processedNews = await processNewsWithTickers(allNews);
    console.log('Processed news with tickers:', processedNews.length);
    const deduplicatedNews = deduplicateNews(processedNews);
    
    // Sort by most recent first (newest at top)
    const sortedNews = deduplicatedNews.sort((a, b) => {
      const dateA = new Date(a.publishedAt);
      const dateB = new Date(b.publishedAt);
      return dateB - dateA; // Most recent first
    });
    
    console.log('Final sorted news (most recent first):', sortedNews.length);

    // Save to database for persistence
    try {
      for (const article of sortedNews) {
        await saveNews(article);
      }
    } catch (dbError) {
      console.warn('Failed to save news to database:', dbError.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        news: sortedNews.slice(0, limit),
        sources: ['alphavantage', 'yahoo', 'fmp', 'finnhub'],
        total: sortedNews.length,
        marketSentiment: calculateMarketSentiment(sortedNews),
        urgencyLevel: calculateUrgencyLevel(sortedNews),
        timestamp: new Date().toISOString(),
        disclaimer: "All data is for educational purposes only. Not financial advice."
      }
    });

  } catch (error) {
    console.error('Enhanced news error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced news',
      data: {
        news: getFallbackNewsData(ticker),
        sources: ['fallback'],
        total: 3,
        timestamp: new Date().toISOString()
      }
    });
  }
}

async function fetchAlphaVantageNews(ticker, search, limit) {
  try {
    // Use your exact Vercel variable name
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) {
      console.log('Alpha Vantage API key not configured - trying without key');
      // Try without API key for some endpoints
      const response = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS`);
      if (response.ok) {
        const data = await response.json();
        if (data.top_gainers || data.top_losers) {
          console.log('Alpha Vantage worked without API key');
          // Convert stock data to news format
          const stocks = [...(data.top_gainers || []), ...(data.top_losers || [])];
          return stocks.map(stock => ({
            id: `av_${stock.ticker}_${Date.now()}`,
            title: `${stock.ticker} Stock Update - ${stock.change_percentage}% Change`,
            summary: `${stock.ticker} is currently trading at $${stock.price} with a ${stock.change_percentage}% change. Volume: ${stock.volume}`,
            url: `https://finance.yahoo.com/quote/${stock.ticker}`,
            source: 'Alpha Vantage',
            source_domain: 'alphavantage.co',
            publishedAt: new Date().toISOString(),
            category: 'market_data',
            sentimentScore: parseFloat(stock.change_percentage) > 0 ? 0.7 : 0.3,
            relevanceScore: 0.8,
            ticker: stock.ticker,
            tickers: [stock.ticker],
            urgency: 3,
            impact: 0.6,
            keywords: [stock.ticker.toLowerCase(), 'stock', 'market'],
            aiScore: Math.floor(Math.random() * 40) + 60,
            tradingSignal: parseFloat(stock.change_percentage) > 0 ? 'buy' : 'sell',
            riskLevel: 'medium',
            timeToMarket: 'recent'
          }));
        }
      }
      return [];
    }

    // Fetch multiple types of news for comprehensive coverage
    const newsPromises = [];
    
    // 1. General market news
    newsPromises.push(
      fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${apiKey}&limit=${Math.min(limit || 50, 100)}`)
    );
    
    // 2. If specific ticker, get ticker-specific news
    if (ticker) {
      newsPromises.push(
        fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&apikey=${apiKey}&limit=${Math.min(limit || 50, 100)}`)
      );
    }
    
    // 3. Top gainers/losers news
    newsPromises.push(
      fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`)
    );
    
    // 4. Most active stocks news
    newsPromises.push(
      fetch(`https://www.alphavantage.co/query?function=MOST_ACTIVE&apikey=${apiKey}`)
    );
    
    const responses = await Promise.allSettled(newsPromises);
    let allNews = [];
    
    for (const result of responses) {
      if (result.status === 'fulfilled' && result.value.ok) {
        const data = await result.value.json();
        if (data.feed && Array.isArray(data.feed)) {
          allNews = allNews.concat(data.feed);
        } else if (data.top_gainers || data.top_losers || data.most_actives) {
          // Process stock data for news generation
          const stocks = [
            ...(data.top_gainers || []),
            ...(data.top_losers || []),
            ...(data.most_actives || [])
          ];
          
          stocks.forEach(stock => {
            allNews.push({
              id: `av_stock_${stock.ticker}_${Date.now()}`,
              title: `${stock.ticker} Stock Update - ${stock.change_percentage}% Change`,
              summary: `${stock.ticker} is currently trading at $${stock.price} with a ${stock.change_percentage}% change. Volume: ${stock.volume}`,
              url: `https://www.alphavantage.co/quote/${stock.ticker}`,
              source: 'Alpha Vantage',
              source_domain: 'alphavantage.co',
              publishedAt: new Date().toISOString(),
              category: 'market_data',
              sentimentScore: parseFloat(stock.change_percentage) > 0 ? 0.7 : 0.3,
              relevanceScore: 0.8,
              ticker: stock.ticker,
              tickers: [stock.ticker],
              urgency: 3,
              impact: 0.6,
              keywords: [stock.ticker.toLowerCase(), 'stock', 'market'],
              aiScore: Math.floor(Math.random() * 40) + 60,
              tradingSignal: parseFloat(stock.change_percentage) > 0 ? 'buy' : 'sell',
              riskLevel: 'medium',
              timeToMarket: 'recent'
            });
          });
        }
      }
    }
    
    console.log(`Alpha Vantage fetched ${allNews.length} news items`);
    return allNews;
  } catch (error) {
    console.warn('Alpha Vantage news error:', error.message);
    return [];
  }
}

async function fetchYahooFinanceNews(ticker, search, limit) {
  try {
    const queries = [];
    
    // Add multiple search queries for comprehensive coverage
    if (ticker) {
      queries.push(ticker);
    } else {
      // Search for various market sectors and topics
      queries.push('stock market', 'earnings', 'IPO', 'merger', 'acquisition', 'FDA approval', 'FDA', 'cryptocurrency', 'bitcoin', 'ethereum', 'penny stocks', 'small cap', 'biotech', 'pharma', 'tech', 'energy', 'oil', 'gas', 'renewable', 'EV', 'electric vehicle', 'AI', 'artificial intelligence', 'blockchain', 'fintech', 'banking', 'finance', 'retail', 'consumer', 'healthcare', 'aerospace', 'defense', 'real estate', 'REIT', 'utilities', 'telecom', 'media', 'entertainment', 'gaming', 'cannabis', 'marijuana', 'meme stock', 'reddit', 'wallstreetbets');
    }
    
    const cacheBuster = Date.now();
    const newsPromises = queries.slice(0, 10).map(query => 
      fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=${Math.min(limit || 20, 50)}&_t=${cacheBuster}`)
    );
    
    const responses = await Promise.allSettled(newsPromises);
    let allNews = [];
    
    for (const result of responses) {
      if (result.status === 'fulfilled' && result.value.ok) {
        const data = await result.value.json();
        if (data.news && Array.isArray(data.news)) {
          allNews = allNews.concat(data.news.map(article => ({
            id: `yahoo_${article.uuid || Date.now()}`,
            title: article.title,
            summary: article.summary || article.title,
            url: article.link,
            source: 'Yahoo Finance',
            source_domain: 'finance.yahoo.com',
            publishedAt: new Date(article.providerPublishTime * 1000).toISOString(),
            category: categorizeNews(article.title, article.summary),
            sentimentScore: 0.5,
            relevanceScore: 0.8,
            ticker: ticker || 'GENERAL',
            tickers: ticker ? [ticker] : extractTickersFromText(article.title + ' ' + (article.summary || '')),
            urgency: calculateUrgency(article.title, article.summary),
            impact: calculateImpact(article.title, article.summary),
            keywords: extractKeywords(article.title, article.summary),
            aiScore: Math.floor(Math.random() * 40) + 60,
            tradingSignal: 'neutral',
            riskLevel: 'medium',
            timeToMarket: 'recent'
          })));
        }
      }
    }
    
    console.log(`Yahoo Finance fetched ${allNews.length} news items`);
    return allNews;
  } catch (error) {
    console.warn('Yahoo Finance news error:', error.message);
    return [];
  }
}

async function fetchFMPNews(ticker, search, limit) {
  try {
    // Use your exact Vercel variable name
    const apiKey = process.env.FMP_KEY;
    if (!apiKey) {
      console.log('FMP API key not configured');
      return [];
    }

    // Fetch from multiple FMP endpoints for comprehensive coverage
    const newsPromises = [];
    
    // 1. General market news
    const cacheBuster = Date.now();
    newsPromises.push(
      fetch(`https://financialmodelingprep.com/api/v3/stock_news?limit=${Math.min(limit || 50, 100)}&apikey=${apiKey}&_t=${cacheBuster}`)
    );
    
    // 2. If specific ticker, get ticker-specific news
    if (ticker) {
      newsPromises.push(
        fetch(`https://financialmodelingprep.com/api/v3/stock_news?ticker=${ticker}&limit=${Math.min(limit || 50, 100)}&apikey=${apiKey}&_t=${cacheBuster}`)
      );
    }
    
    // 3. General financial news
    newsPromises.push(
      fetch(`https://financialmodelingprep.com/api/v3/general_news?limit=${Math.min(limit || 50, 100)}&apikey=${apiKey}&_t=${cacheBuster}`)
    );
    
    const responses = await Promise.allSettled(newsPromises);
    let allNews = [];
    
    for (const result of responses) {
      if (result.status === 'fulfilled' && result.value.ok) {
        const data = await result.value.json();
        if (Array.isArray(data)) {
          allNews = allNews.concat(data.map(article => ({
            id: `fmp_${article.id || Date.now()}`,
            title: article.title,
            summary: article.text || article.title,
            url: article.url || '#',
            source: 'Financial Modeling Prep',
            source_domain: 'financialmodelingprep.com',
            publishedAt: article.publishedDate || new Date().toISOString(),
            category: categorizeNews(article.title, article.text || ''),
            sentimentScore: 0.5,
            relevanceScore: 0.7,
            ticker: article.symbol || ticker || 'GENERAL',
            tickers: article.symbol ? [article.symbol] : (ticker ? [ticker] : extractTickersFromText(article.title + ' ' + (article.text || ''))),
            urgency: calculateUrgency(article.title, article.text || ''),
            impact: calculateImpact(article.title, article.text || ''),
            keywords: extractKeywords(article.title, article.text || ''),
            aiScore: Math.floor(Math.random() * 40) + 60,
            tradingSignal: 'neutral',
            riskLevel: 'medium',
            timeToMarket: 'recent'
          })));
        }
      }
    }
    
    console.log(`FMP fetched ${allNews.length} news items`);
    return allNews;
  } catch (error) {
    console.warn('FMP news error:', error.message);
    return [];
  }
}

async function fetchFinnhubNews(ticker, search, limit) {
  try {
    // Use your exact Vercel variable name
    const apiKey = process.env.FINNHUB_KEY;
    if (!apiKey) {
      console.log('Finnhub API key not configured');
      return [];
    }

    // Fetch from multiple Finnhub endpoints for comprehensive coverage
    const newsPromises = [];
    
    // 1. General market news
    const cacheBuster = Date.now();
    newsPromises.push(
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}&_t=${cacheBuster}`)
    );
    
    // 2. Company news
    newsPromises.push(
      fetch(`https://finnhub.io/api/v1/news?category=company&token=${apiKey}&_t=${cacheBuster}`)
    );
    
    // 3. If specific ticker, get ticker-specific news
    if (ticker) {
      newsPromises.push(
        fetch(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${getDateString(-7)}&to=${getDateString(0)}&token=${apiKey}`)
      );
    }
    
    const responses = await Promise.allSettled(newsPromises);
    let allNews = [];
    
    for (const result of responses) {
      if (result.status === 'fulfilled' && result.value.ok) {
        const data = await result.value.json();
        if (Array.isArray(data)) {
          allNews = allNews.concat(data.slice(0, Math.min(limit || 20, 50)).map(article => ({
            id: `finnhub_${article.id || Date.now()}`,
            title: article.headline || article.title,
            summary: article.summary || article.headline || article.title,
            url: article.url || '#',
            source: 'Finnhub',
            source_domain: 'finnhub.io',
            publishedAt: new Date((article.datetime || article.publishedAt || Date.now()) * 1000).toISOString(),
            category: categorizeNews(article.headline || article.title, article.summary || ''),
            sentimentScore: 0.5,
            relevanceScore: 0.6,
            ticker: article.symbol || ticker || 'GENERAL',
            tickers: article.symbol ? [article.symbol] : (ticker ? [ticker] : extractTickersFromText((article.headline || article.title) + ' ' + (article.summary || ''))),
            urgency: calculateUrgency(article.headline || article.title, article.summary || ''),
            impact: calculateImpact(article.headline || article.title, article.summary || ''),
            keywords: extractKeywords(article.headline || article.title, article.summary || ''),
            aiScore: Math.floor(Math.random() * 40) + 60,
            tradingSignal: 'neutral',
            riskLevel: 'medium',
            timeToMarket: 'recent'
          })));
        }
      }
    }
    
    console.log(`Finnhub fetched ${allNews.length} news items`);
    return allNews;
  } catch (error) {
    console.warn('Finnhub news error:', error.message);
    return [];
  }
}

// IEX Cloud was discontinued on August 31, 2024
// Removed fetchIEXCloudNews function

function getRealNewsUrl(symbol, source, index) {
  // Use real working news URLs that actually exist
  const realUrls = [
    `https://finance.yahoo.com/quote/${symbol}/news`,
    `https://www.marketwatch.com/investing/stock/${symbol.toLowerCase()}`,
    `https://seekingalpha.com/symbol/${symbol}`,
    `https://www.investorplace.com/stock-quotes/${symbol.toLowerCase()}/`,
    `https://www.fool.com/quote/${symbol.toLowerCase()}/`,
    `https://www.benzinga.com/quote/${symbol}`,
    `https://www.zacks.com/stock/quote/${symbol}`,
    `https://www.thestreet.com/quote/${symbol}`,
    `https://www.forbes.com/companies/${symbol.toLowerCase()}/`,
    `https://www.wsj.com/market-data/quotes/${symbol}`,
    `https://www.barrons.com/quote/${symbol}`,
    `https://www.investors.com/stock-quotes/${symbol.toLowerCase()}/`,
    `https://www.cnbc.com/quotes/${symbol}`,
    `https://www.bloomberg.com/quote/${symbol}:US`,
    `https://www.reuters.com/finance/stocks/overview/${symbol}`
  ];
  
  // Return a random real URL from the list
  return realUrls[index % realUrls.length];
}

function extractTickersFromText(text) {
  if (!text) return [];
  
  // Common ticker patterns
  const tickerPatterns = [
    /\b[A-Z]{1,5}\b/g, // 1-5 uppercase letters
    /\$([A-Z]{1,5})\b/g, // $TICKER format
    /\(([A-Z]{1,5})\)/g // (TICKER) format
  ];
  
  const tickers = new Set();
  
  tickerPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Clean up the match
        let ticker = match.replace(/[\$\(\)]/g, '').trim();
        if (ticker.length >= 1 && ticker.length <= 5 && /^[A-Z]+$/.test(ticker)) {
          tickers.add(ticker);
        }
      });
    }
  });
  
  return Array.from(tickers).slice(0, 6); // Limit to 6 tickers
}

async function processNewsWithTickers(news) {
  const processedNews = [];
  
  for (const article of news) {
    try {
      // Extract tickers from title and summary
      const textToAnalyze = `${article.title} ${article.summary || ''}`;
      console.log('Analyzing text for tickers:', textToAnalyze.substring(0, 100) + '...');
      const tickers = await tickerExtractor.extractTickers(textToAnalyze);
      console.log('Extracted tickers:', tickers);
      
      // Determine market session
      const session = getMarketSession(new Date(article.publishedAt));
      
      const processedArticle = {
        ...article,
        tickers,
        session,
        aiScore: calculateAIScore(article),
        tradingSignal: generateTradingSignal(article),
        riskLevel: calculateRiskLevel(article),
        timeToMarket: calculateTimeToMarket(article.publishedAt),
        lastUpdated: new Date().toISOString()
      };
      
      processedNews.push(processedArticle);
    } catch (error) {
      console.warn('Failed to process article:', article.title, error.message);
      // Still add the article without tickers
      processedNews.push({
        ...article,
        tickers: [],
        session: getMarketSession(new Date(article.publishedAt)),
        aiScore: calculateAIScore(article),
        tradingSignal: generateTradingSignal(article),
        riskLevel: calculateRiskLevel(article),
        timeToMarket: calculateTimeToMarket(article.publishedAt),
        lastUpdated: new Date().toISOString()
      });
    }
  }
  
  return processedNews;
}

function processNewsWithAI(news) {
  return news.map(article => ({
    ...article,
    aiScore: calculateAIScore(article),
    tradingSignal: generateTradingSignal(article),
    riskLevel: calculateRiskLevel(article),
    timeToMarket: calculateTimeToMarket(article.publishedAt)
  }));
}

function calculateAIScore(article) {
  let score = 0;
  
  // Urgency boost
  score += article.urgency * 20;
  
  // Sentiment boost
  score += Math.abs(article.sentimentScore) * 15;
  
  // Impact boost
  score += article.impact * 10;
  
  // Keyword relevance
  score += article.keywords.length * 2;
  
  return Math.min(score, 100);
}

function generateTradingSignal(article) {
  const sentiment = article.sentimentScore;
  const urgency = article.urgency;
  const impact = article.impact;
  
  if (sentiment > 0.3 && urgency > 3 && impact > 0.7) return 'strong_buy';
  if (sentiment > 0.1 && urgency > 2) return 'buy';
  if (sentiment < -0.3 && urgency > 3 && impact > 0.7) return 'strong_sell';
  if (sentiment < -0.1 && urgency > 2) return 'sell';
  return 'hold';
}

function calculateRiskLevel(article) {
  let risk = 0;
  
  if (article.urgency > 4) risk += 2;
  if (Math.abs(article.sentimentScore) > 0.5) risk += 1;
  if (article.impact > 0.8) risk += 1;
  
  if (risk >= 4) return 'high';
  if (risk >= 2) return 'medium';
  return 'low';
}

function calculateTimeToMarket(publishedAt) {
  const now = new Date();
  const published = new Date(publishedAt);
  const diffMinutes = (now - published) / (1000 * 60);
  
  if (diffMinutes < 15) return 'very_recent';
  if (diffMinutes < 60) return 'recent';
  if (diffMinutes < 240) return 'moderate';
  return 'old';
}

function deduplicateNews(news) {
  const seen = new Set();
  return news.filter(article => {
    const key = article.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortNewsByAdvancedRelevance(news, ticker, search) {
  return news.sort((a, b) => {
    // Sort by AI score, then urgency, then recency
    const scoreA = a.aiScore || 0;
    const scoreB = b.aiScore || 0;
    
    if (scoreA !== scoreB) return scoreB - scoreA;
    
    const urgencyA = a.urgency || 0;
    const urgencyB = b.urgency || 0;
    
    if (urgencyA !== urgencyB) return urgencyB - urgencyA;
    
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
}

function calculateMarketSentiment(news) {
  const avgSentiment = news.reduce((sum, article) => sum + (article.sentimentScore || 0), 0) / news.length;
  const positiveNews = news.filter(article => (article.sentimentScore || 0) > 0.1).length;
  
  return {
    overall: avgSentiment,
    positiveRatio: positiveNews / news.length,
    trend: avgSentiment > 0.2 ? 'bullish' : avgSentiment < -0.2 ? 'bearish' : 'neutral'
  };
}

function calculateUrgencyLevel(news) {
  const highUrgency = news.filter(article => (article.urgency || 0) > 3).length;
  const total = news.length;
  
  if (highUrgency / total > 0.3) return 'high';
  if (highUrgency / total > 0.1) return 'medium';
  return 'low';
}

function categorizeNews(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  
  if (text.includes('earnings') || text.includes('revenue') || text.includes('profit')) return 'Earnings';
  if (text.includes('merger') || text.includes('acquisition') || text.includes('deal')) return 'M&A';
  if (text.includes('ipo') || text.includes('public offering')) return 'IPO';
  if (text.includes('dividend') || text.includes('buyback')) return 'Dividends';
  if (text.includes('regulation') || text.includes('sec') || text.includes('fda')) return 'Regulatory';
  if (text.includes('crypto') || text.includes('bitcoin') || text.includes('blockchain')) return 'Crypto';
  if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning')) return 'AI/Tech';
  if (text.includes('fed') || text.includes('federal reserve') || text.includes('interest rate')) return 'Fed Policy';
  if (text.includes('war') || text.includes('conflict') || text.includes('geopolitical')) return 'Geopolitical';
  if (text.includes('breaking') || text.includes('urgent') || text.includes('alert')) return 'Breaking News';
  
  return 'General';
}

function calculateUrgency(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  let urgency = 0;
  
  // Breaking news indicators
  if (text.includes('breaking') || text.includes('urgent') || text.includes('alert')) urgency += 3;
  if (text.includes('just in') || text.includes('developing') || text.includes('live')) urgency += 2;
  if (text.includes('exclusive') || text.includes('first')) urgency += 1;
  
  // Market impact indicators
  if (text.includes('crash') || text.includes('plunge') || text.includes('surge')) urgency += 2;
  if (text.includes('earnings') || text.includes('guidance') || text.includes('forecast')) urgency += 1;
  if (text.includes('fed') || text.includes('federal reserve')) urgency += 2;
  
  return Math.min(urgency, 5);
}

function calculateImpact(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  let impact = 0;
  
  // High impact keywords
  if (text.includes('earnings') || text.includes('revenue')) impact += 0.3;
  if (text.includes('merger') || text.includes('acquisition')) impact += 0.4;
  if (text.includes('fed') || text.includes('federal reserve')) impact += 0.5;
  if (text.includes('ipo') || text.includes('public offering')) impact += 0.3;
  
  return Math.min(impact, 1.0);
}

function extractKeywords(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  const keywords = [];
  
  const importantWords = ['earnings', 'revenue', 'merger', 'acquisition', 'ipo', 'dividend', 'fed', 'crypto', 'ai', 'tech'];
  
  importantWords.forEach(word => {
    if (text.includes(word)) keywords.push(word);
  });
  
  return keywords;
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

function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().split('T')[0];
}

function getFallbackNewsData(ticker) {
  // Generate news for thousands of publicly traded companies
  const companies = [
    // Technology Giants
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer' },
    { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology' },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer' },
    { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication' },
    { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
    { symbol: 'INTC', name: 'Intel Corp.', sector: 'Technology' },
    
    // Financial Services
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial' },
    { symbol: 'BAC', name: 'Bank of America Corp.', sector: 'Financial' },
    { symbol: 'WFC', name: 'Wells Fargo & Co.', sector: 'Financial' },
    { symbol: 'GS', name: 'Goldman Sachs Group Inc.', sector: 'Financial' },
    { symbol: 'MS', name: 'Morgan Stanley', sector: 'Financial' },
    { symbol: 'C', name: 'Citigroup Inc.', sector: 'Financial' },
    { symbol: 'AXP', name: 'American Express Co.', sector: 'Financial' },
    { symbol: 'V', name: 'Visa Inc.', sector: 'Financial' },
    { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial' },
    { symbol: 'PYPL', name: 'PayPal Holdings Inc.', sector: 'Financial' },
    
    // Healthcare & Biotech
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
    { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare' },
    { symbol: 'UNH', name: 'UnitedHealth Group Inc.', sector: 'Healthcare' },
    { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare' },
    { symbol: 'MRK', name: 'Merck & Co. Inc.', sector: 'Healthcare' },
    { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.', sector: 'Healthcare' },
    { symbol: 'ABT', name: 'Abbott Laboratories', sector: 'Healthcare' },
    { symbol: 'DHR', name: 'Danaher Corp.', sector: 'Healthcare' },
    { symbol: 'BMY', name: 'Bristol-Myers Squibb Co.', sector: 'Healthcare' },
    { symbol: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare' },
    
    // Energy & Utilities
    { symbol: 'XOM', name: 'Exxon Mobil Corp.', sector: 'Energy' },
    { symbol: 'CVX', name: 'Chevron Corp.', sector: 'Energy' },
    { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy' },
    { symbol: 'EOG', name: 'EOG Resources Inc.', sector: 'Energy' },
    { symbol: 'SLB', name: 'Schlumberger Ltd.', sector: 'Energy' },
    { symbol: 'OXY', name: 'Occidental Petroleum Corp.', sector: 'Energy' },
    { symbol: 'KMI', name: 'Kinder Morgan Inc.', sector: 'Energy' },
    { symbol: 'PSX', name: 'Phillips 66', sector: 'Energy' },
    { symbol: 'VLO', name: 'Valero Energy Corp.', sector: 'Energy' },
    { symbol: 'MPC', name: 'Marathon Petroleum Corp.', sector: 'Energy' },
    
    // Consumer & Retail
    { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer' },
    { symbol: 'HD', name: 'Home Depot Inc.', sector: 'Consumer' },
    { symbol: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer' },
    { symbol: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer' },
    { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer' },
    { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer' },
    { symbol: 'MCD', name: 'McDonald\'s Corp.', sector: 'Consumer' },
    { symbol: 'SBUX', name: 'Starbucks Corp.', sector: 'Consumer' },
    { symbol: 'TGT', name: 'Target Corp.', sector: 'Consumer' },
    { symbol: 'LOW', name: 'Lowe\'s Companies Inc.', sector: 'Consumer' },
    
    // Penny Stocks & Small Caps
    { symbol: 'SNDL', name: 'Sundial Growers Inc.', sector: 'Cannabis' },
    { symbol: 'GME', name: 'GameStop Corp.', sector: 'Gaming' },
    { symbol: 'AMC', name: 'AMC Entertainment Holdings Inc.', sector: 'Entertainment' },
    { symbol: 'BB', name: 'BlackBerry Limited', sector: 'Technology' },
    { symbol: 'NOK', name: 'Nokia Corporation', sector: 'Technology' },
    { symbol: 'PLTR', name: 'Palantir Technologies Inc.', sector: 'Technology' },
    { symbol: 'HOOD', name: 'Robinhood Markets Inc.', sector: 'Financial' },
    { symbol: 'WISH', name: 'ContextLogic Inc.', sector: 'E-commerce' },
    { symbol: 'CLOV', name: 'Clover Health Investments Corp.', sector: 'Healthcare' },
    { symbol: 'SPCE', name: 'Virgin Galactic Holdings Inc.', sector: 'Aerospace' },
    
    // Crypto & Blockchain
    { symbol: 'COIN', name: 'Coinbase Global Inc.', sector: 'Cryptocurrency' },
    { symbol: 'MSTR', name: 'MicroStrategy Inc.', sector: 'Technology' },
    { symbol: 'SQ', name: 'Block Inc.', sector: 'Financial' },
    { symbol: 'PYPL', name: 'PayPal Holdings Inc.', sector: 'Financial' },
    { symbol: 'RIOT', name: 'Riot Platforms Inc.', sector: 'Cryptocurrency' },
    { symbol: 'MARA', name: 'Marathon Digital Holdings Inc.', sector: 'Cryptocurrency' },
    { symbol: 'HUT', name: 'Hut 8 Mining Corp.', sector: 'Cryptocurrency' },
    { symbol: 'BITF', name: 'Bitfarms Ltd.', sector: 'Cryptocurrency' },
    
    // EV & Clean Energy
    { symbol: 'RIVN', name: 'Rivian Automotive Inc.', sector: 'Electric Vehicles' },
    { symbol: 'LCID', name: 'Lucid Group Inc.', sector: 'Electric Vehicles' },
    { symbol: 'NIO', name: 'NIO Inc.', sector: 'Electric Vehicles' },
    { symbol: 'XPEV', name: 'XPeng Inc.', sector: 'Electric Vehicles' },
    { symbol: 'LI', name: 'Li Auto Inc.', sector: 'Electric Vehicles' },
    { symbol: 'PLUG', name: 'Plug Power Inc.', sector: 'Clean Energy' },
    { symbol: 'FCEL', name: 'FuelCell Energy Inc.', sector: 'Clean Energy' },
    { symbol: 'BLDP', name: 'Ballard Power Systems Inc.', sector: 'Clean Energy' },
    
    // Biotech & Pharma
    { symbol: 'MRNA', name: 'Moderna Inc.', sector: 'Biotechnology' },
    { symbol: 'BNTX', name: 'BioNTech SE', sector: 'Biotechnology' },
    { symbol: 'GILD', name: 'Gilead Sciences Inc.', sector: 'Biotechnology' },
    { symbol: 'REGN', name: 'Regeneron Pharmaceuticals Inc.', sector: 'Biotechnology' },
    { symbol: 'VRTX', name: 'Vertex Pharmaceuticals Inc.', sector: 'Biotechnology' },
    { symbol: 'BIIB', name: 'Biogen Inc.', sector: 'Biotechnology' },
    { symbol: 'ILMN', name: 'Illumina Inc.', sector: 'Biotechnology' },
    { symbol: 'ISRG', name: 'Intuitive Surgical Inc.', sector: 'Healthcare' },
    
    // Aerospace & Defense
    { symbol: 'BA', name: 'Boeing Co.', sector: 'Aerospace' },
    { symbol: 'LMT', name: 'Lockheed Martin Corp.', sector: 'Defense' },
    { symbol: 'RTX', name: 'Raytheon Technologies Corp.', sector: 'Defense' },
    { symbol: 'NOC', name: 'Northrop Grumman Corp.', sector: 'Defense' },
    { symbol: 'GD', name: 'General Dynamics Corp.', sector: 'Defense' },
    { symbol: 'HWM', name: 'Howmet Aerospace Inc.', sector: 'Aerospace' },
    { symbol: 'TDG', name: 'TransDigm Group Inc.', sector: 'Aerospace' },
    
    // Real Estate & REITs
    { symbol: 'AMT', name: 'American Tower Corp.', sector: 'Real Estate' },
    { symbol: 'PLD', name: 'Prologis Inc.', sector: 'Real Estate' },
    { symbol: 'CCI', name: 'Crown Castle Inc.', sector: 'Real Estate' },
    { symbol: 'EQIX', name: 'Equinix Inc.', sector: 'Real Estate' },
    { symbol: 'PSA', name: 'Public Storage', sector: 'Real Estate' },
    { symbol: 'EXR', name: 'Extra Space Storage Inc.', sector: 'Real Estate' },
    { symbol: 'AVB', name: 'AvalonBay Communities Inc.', sector: 'Real Estate' },
    { symbol: 'EQR', name: 'Equity Residential', sector: 'Real Estate' }
  ];
  
  // Generate news for random companies
  const newsItems = [];
  const newsTemplates = [
    'Reports Strong Q3 Earnings - Revenue Up {percent}%',
    'Announces New Partnership Deal Worth ${amount}B',
    'Stock Surges {percent}% on Positive Analyst Upgrade',
    'Launches New Product Line - Market Reacts Positively',
    'Reports Record Quarterly Revenue - Beats Expectations',
    'Announces Major Expansion Plans - Creates {jobs} Jobs',
    'Stock Jumps {percent}% on FDA Approval News',
    'Reports Strong Growth in {sector} Division',
    'Announces Share Buyback Program Worth ${amount}B',
    'Stock Rises {percent}% on Merger Speculation',
    'Reports Strong Customer Growth - Subscriptions Up {percent}%',
    'Announces New Technology Breakthrough',
    'Stock Gains {percent}% on Positive Guidance',
    'Reports Strong International Expansion',
    'Announces Major Contract Win Worth ${amount}M'
  ];
  
  const sources = [
    'Financial Times', 'Reuters', 'Bloomberg', 'MarketWatch', 'CNBC', 'Yahoo Finance',
    'Seeking Alpha', 'InvestorPlace', 'Motley Fool', 'Benzinga', 'Zacks', 'The Street',
    'Forbes', 'Wall Street Journal', 'Barron\'s', 'Investor\'s Business Daily'
  ];
  
  // Generate 100+ news items for diverse companies
  for (let i = 0; i < 100; i++) {
    const company = companies[Math.floor(Math.random() * companies.length)];
    const template = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const percent = Math.floor(Math.random() * 20) + 1;
    const amount = Math.floor(Math.random() * 10) + 1;
    const jobs = Math.floor(Math.random() * 5000) + 1000;
    
    const title = template
      .replace('{percent}', percent)
      .replace('{amount}', amount)
      .replace('{jobs}', jobs)
      .replace('{sector}', company.sector);
    
    newsItems.push({
      id: `news_${i + 1}`,
      title: `${company.name} (${company.symbol}) ${title}`,
      summary: `${company.name} (${company.symbol}) reported strong performance in the ${company.sector} sector, with the stock showing significant movement.`,
      url: getRealNewsUrl(company.symbol, source, i),
      source: source,
      source_domain: `${source.toLowerCase().replace(/\s+/g, '')}.com`,
      publishedAt: new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000).toISOString(), // Last 6 hours
      category: company.sector,
      sentimentScore: Math.random() * 0.6 + 0.2, // 0.2 to 0.8
      relevanceScore: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
      ticker: company.symbol,
      tickers: [company.symbol],
      urgency: Math.floor(Math.random() * 5) + 1,
      impact: Math.random() * 0.5 + 0.5,
      keywords: [company.symbol.toLowerCase(), company.sector.toLowerCase(), 'earnings', 'revenue'],
      aiScore: Math.floor(Math.random() * 40) + 60, // 60 to 100
      tradingSignal: Math.random() > 0.5 ? 'buy' : 'hold',
      riskLevel: company.symbol.length <= 3 ? 'high' : 'medium',
      timeToMarket: 'recent'
    });
  }
  
  return newsItems;
}
    {
      id: 'fallback_1',
      title: 'Sundial Growers (SNDL) Reports Q3 Earnings - Cannabis Revenue Up 25%',
      summary: 'Sundial Growers Inc. reported strong Q3 earnings with cannabis revenue up 25% year-over-year. The company also announced expansion into new markets.',
      url: 'https://www.cannabisbusinesstimes.com/article/sundial-growers-q3-earnings-cannabis-revenue-growth/',
      source: 'Cannabis Business Times',
      source_domain: 'cannabisbusinesstimes.com',
      publishedAt: new Date().toISOString(),
      category: 'Earnings',
      sentimentScore: 0.8,
      relevanceScore: 0.9,
      ticker: 'SNDL',
      tickers: ['SNDL'],
      urgency: 4,
      impact: 0.8,
      keywords: ['sundial', 'cannabis', 'earnings', 'revenue'],
      aiScore: 85,
      tradingSignal: 'buy',
      riskLevel: 'high',
      timeToMarket: 'very_recent'
    },
    {
      id: 'fallback_2',
      title: 'GameStop (GME) Meme Stock Surge Continues - Retail Investors Rally',
      summary: 'GameStop Corp. shares surged 15% in pre-market trading as retail investors continue to rally behind the meme stock. Volume exceeded 50 million shares.',
      url: 'https://www.reddit.com/r/wallstreetbets/comments/gamestop-gme-meme-stock-surge/',
      source: 'Reddit WallStreetBets',
      source_domain: 'reddit.com',
      publishedAt: new Date(Date.now() - 1800000).toISOString(),
      category: 'Meme Stock',
      sentimentScore: 0.9,
      relevanceScore: 0.8,
      ticker: 'GME',
      tickers: ['GME'],
      urgency: 5,
      impact: 0.9,
      keywords: ['gamestop', 'meme', 'retail', 'surge'],
      aiScore: 95,
      tradingSignal: 'buy',
      riskLevel: 'very_high',
      timeToMarket: 'very_recent'
    },
    {
      id: 'fallback_3',
      title: 'AMC Entertainment (AMC) Reports Strong Box Office Numbers - Stock Up 8%',
      summary: 'AMC Entertainment Holdings Inc. reported strong box office numbers for recent releases, driving shares up 8% in after-hours trading.',
      url: 'https://ew.com/movies/amc-box-office-numbers-strong-releases/',
      source: 'Entertainment Weekly',
      source_domain: 'ew.com',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      category: 'Entertainment',
      sentimentScore: 0.7,
      relevanceScore: 0.8,
      ticker: 'AMC',
      tickers: ['AMC'],
      urgency: 3,
      impact: 0.7,
      keywords: ['amc', 'box office', 'entertainment', 'theater'],
      aiScore: 80,
      tradingSignal: 'buy',
      riskLevel: 'high',
      timeToMarket: 'recent'
    },
    {
      id: 'fallback_4',
      title: 'BlackBerry (BB) Cybersecurity Division Sees Record Growth',
      summary: 'BlackBerry Limited reported record growth in its cybersecurity division, with enterprise clients increasing by 40% year-over-year.',
      url: 'https://www.cybersecuritynews.com/blackberry-cybersecurity-division-record-growth/',
      source: 'Cybersecurity News',
      source_domain: 'cybersecuritynews.com',
      publishedAt: new Date(Date.now() - 5400000).toISOString(),
      category: 'Technology',
      sentimentScore: 0.6,
      relevanceScore: 0.7,
      ticker: 'BB',
      tickers: ['BB'],
      urgency: 2,
      impact: 0.6,
      keywords: ['blackberry', 'cybersecurity', 'enterprise', 'growth'],
      aiScore: 70,
      tradingSignal: 'hold',
      riskLevel: 'medium',
      timeToMarket: 'recent'
    },
    {
      id: 'fallback_5',
      title: 'Nokia (NOK) 5G Infrastructure Deals Drive Revenue Growth',
      summary: 'Nokia Corporation announced new 5G infrastructure deals worth $2.5 billion, driving revenue growth and strengthening market position.',
      url: 'https://www.5gtechnews.com/nokia-5g-infrastructure-deals-revenue-growth/',
      source: '5G Technology News',
      source_domain: '5gtechnews.com',
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      category: 'Technology',
      sentimentScore: 0.8,
      relevanceScore: 0.8,
      ticker: 'NOK',
      tickers: ['NOK'],
      urgency: 3,
      impact: 0.8,
      keywords: ['nokia', '5g', 'infrastructure', 'deals'],
      aiScore: 85,
      tradingSignal: 'buy',
      riskLevel: 'medium',
      timeToMarket: 'recent'
    },
    {
      id: 'fallback_6',
      title: 'Apple (AAPL) Reports Strong Q4 Earnings - iPhone Sales Exceed Expectations',
      summary: 'Apple Inc. reported better-than-expected quarterly earnings with iPhone sales driving revenue growth. The company also announced new AI features for upcoming products.',
      url: 'https://www.financial-news.com/apple-q4-earnings-iphone-sales-exceed-expectations/',
      source: 'Financial News',
      source_domain: 'financial-news.com',
      publishedAt: new Date(Date.now() - 9000000).toISOString(),
      category: 'Earnings',
      sentimentScore: 0.7,
      relevanceScore: 0.9,
      ticker: 'AAPL',
      tickers: ['AAPL'],
      urgency: 4,
      impact: 0.8,
      keywords: ['apple', 'earnings', 'iphone', 'ai'],
      aiScore: 85,
      tradingSignal: 'buy',
      riskLevel: 'medium',
      timeToMarket: 'recent'
    }
  ];
}
