// Vercel serverless function for financial news aggregator
// This function consolidates data from multiple financial APIs

export default async function handler(req, res) {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get API keys from environment variables
    const newsApiKey = process.env.NEWSAPI_KEY;
    const finnhubKey = process.env.FINNHUB_KEY;
    const fmpKey = process.env.FMP_KEY;

    // Validate that all API keys are present
    if (!newsApiKey || !finnhubKey || !fmpKey) {
      console.error('Missing API keys:', {
        newsApi: !!newsApiKey,
        finnhub: !!finnhubKey,
        fmp: !!fmpKey
      });
      return res.status(500).json({ 
        error: 'API configuration error',
        message: 'One or more API keys are missing'
      });
    }

    // Extract query parameters
    const { 
      ticker, 
      category, 
      limit = 20,
      search 
    } = req.query;

    // Make concurrent API calls to all three services
    const [newsData, stockData, marketData] = await Promise.allSettled([
      fetchNewsData(newsApiKey, ticker, category, search, limit),
      fetchStockData(finnhubKey, ticker),
      fetchMarketData(fmpKey, ticker)
    ]);

    // Consolidate the data
    const consolidatedData = {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        news: newsData.status === 'fulfilled' ? newsData.value : [],
        stock: stockData.status === 'fulfilled' ? stockData.value : null,
        market: marketData.status === 'fulfilled' ? marketData.value : null
      },
      errors: []
    };

    // Add any errors that occurred during API calls
    if (newsData.status === 'rejected') {
      consolidatedData.errors.push({
        service: 'NewsAPI',
        error: newsData.reason.message
      });
    }
    if (stockData.status === 'rejected') {
      consolidatedData.errors.push({
        service: 'Finnhub',
        error: stockData.reason.message
      });
    }
    if (marketData.status === 'rejected') {
      consolidatedData.errors.push({
        service: 'Financial Modeling Prep',
        error: marketData.reason.message
      });
    }

    // Return consolidated data
    res.status(200).json(consolidatedData);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// Fetch news data from NewsAPI.org
async function fetchNewsData(apiKey, ticker, category, search, limit) {
  try {
    let query = 'finance OR stock OR market OR trading';
    
    if (ticker) {
      query += ` OR ${ticker}`;
    }
    
    if (category) {
      query += ` OR ${category}`;
    }
    
    if (search) {
      query += ` OR ${search}`;
    }

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${limit}&apiKey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform NewsAPI data to our format
    return data.articles.map(article => ({
      id: article.url, // Use URL as unique identifier
      ticker: extractTickerFromTitle(article.title) || 'GENERAL',
      priceChange: null, // NewsAPI doesn't provide price data
      isPositive: null,
      title: article.title,
      summary: article.description || article.content?.substring(0, 200) || 'No summary available',
      category: categorizeNews(article.title, article.description),
      source: article.source.name,
      publishedAt: article.publishedAt,
      url: article.url,
      imageUrl: article.urlToImage
    }));

  } catch (error) {
    console.error('NewsAPI fetch error:', error);
    throw error;
  }
}

// Fetch stock data from Finnhub
async function fetchStockData(apiKey, ticker) {
  try {
    if (!ticker) {
      return null; // Return null if no ticker specified
    }

    const url = `https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Finnhub error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform Finnhub data to our format
    return {
      ticker: ticker.toUpperCase(),
      currentPrice: data.c,
      previousClose: data.pc,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      timestamp: new Date(data.t * 1000).toISOString()
    };

  } catch (error) {
    console.error('Finnhub fetch error:', error);
    throw error;
  }
}

// Fetch market data from Financial Modeling Prep
async function fetchMarketData(apiKey, ticker) {
  try {
    if (!ticker) {
      return null; // Return null if no ticker specified
    }

    const url = `https://financialmodelingprep.com/api/v3/quote/${ticker.toUpperCase()}?apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`FMP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const stock = data[0];
    
    // Transform FMP data to our format
    return {
      ticker: stock.symbol,
      companyName: stock.name,
      currentPrice: stock.price,
      previousClose: stock.previousClose,
      change: stock.change,
      changePercent: stock.changesPercentage,
      marketCap: stock.marketCap,
      volume: stock.volume,
      avgVolume: stock.avgVolume,
      pe: stock.pe,
      eps: stock.eps,
      dayRange: {
        low: stock.dayLow,
        high: stock.dayHigh
      },
      yearRange: {
        low: stock.yearLow,
        high: stock.yearHigh
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('FMP fetch error:', error);
    throw error;
  }
}

// Helper function to extract stock ticker from news title
function extractTickerFromTitle(title) {
  if (!title) return null;
  
  // Common patterns for stock tickers in news titles
  const tickerPatterns = [
    /\(([A-Z]{1,5})\)/, // (AAPL), (TSLA)
    /\b([A-Z]{1,5})\b/, // AAPL, TSLA
    /([A-Z]{1,5}) stock/i, // AAPL stock
    /([A-Z]{1,5}) shares/i // AAPL shares
  ];
  
  for (const pattern of tickerPatterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      // Validate that it looks like a stock ticker
      const ticker = match[1];
      if (ticker.length >= 1 && ticker.length <= 5 && /^[A-Z]+$/.test(ticker)) {
        return ticker;
      }
    }
  }
  
  return null;
}

// Helper function to categorize news based on content
function categorizeNews(title, description) {
  const content = `${title} ${description}`.toLowerCase();
  
  if (content.includes('medical') || content.includes('fda') || content.includes('health') || content.includes('drug')) {
    return 'medical';
  }
  if (content.includes('patent') || content.includes('intellectual property') || content.includes('ip')) {
    return 'patent';
  }
  if (content.includes('lawsuit') || content.includes('legal') || content.includes('court') || content.includes('sue')) {
    return 'lawsuit';
  }
  if (content.includes('acquisition') || content.includes('merger') || content.includes('buyout') || content.includes('takeover')) {
    return 'acquisition';
  }
  if (content.includes('earnings') || content.includes('quarterly') || content.includes('revenue') || content.includes('profit')) {
    return 'earnings';
  }
  
  return 'general';
}
