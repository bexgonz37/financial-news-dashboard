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
    const alphaVantageKey = process.env.ALPHAVANTAGE_KEY;
    const finnhubKey = process.env.FINNHUB_KEY;
    const fmpKey = process.env.FMP_KEY;

    // Validate that all API keys are present
    if (!alphaVantageKey || !finnhubKey || !fmpKey) {
      console.error('Missing API keys:', {
        alphaVantage: !!alphaVantageKey,
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
      fetchNewsData(alphaVantageKey, ticker, category, search, limit),
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
        service: 'Alpha Vantage',
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

// Fetch news data from Alpha Vantage NEWS_SENTIMENT
async function fetchNewsData(apiKey, ticker, category, search, limit) {
  try {
    const params = new URLSearchParams({
      function: 'NEWS_SENTIMENT',
      apikey: apiKey,
      sort: 'LATEST',
      limit: String(limit)
    });

    if (ticker) params.set('tickers', ticker.toUpperCase());
    if (category) params.set('topics', category);

    const url = `https://www.alphavantage.co/query?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Alpha Vantage error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.feed || !Array.isArray(data.feed)) {
      return [];
    }

    // Optional client-side search filter
    const filtered = search
      ? data.feed.filter(a =>
          (a.title || '').toLowerCase().includes(search.toLowerCase()) ||
          (a.summary || '').toLowerCase().includes(search.toLowerCase()))
      : data.feed;

    // Transform Alpha Vantage data to our format
    return filtered.map(article => ({
      id: article.url,
      ticker: extractTickerFromTitle(article.title) || 'GENERAL',
      priceChange: null,
      isPositive: typeof article.sentiment_score === 'number' ? article.sentiment_score > 0 : null,
      sentimentScore: article.sentiment_score,
      title: article.title,
      summary: article.summary || 'No summary available',
      category: categorizeNews(article.title, article.summary),
      source: article.source,
      publishedAt: article.time_published,
      url: article.url,
      imageUrl: article.banner_image
    }));

  } catch (error) {
    console.error('Alpha Vantage fetch error:', error);
    throw error;
  }
}

// Fetch stock data from Finnhub
async function fetchStockData(apiKey, ticker) {
  try {
    if (!ticker) return null;

    const url = `https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Finnhub error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
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
    if (!ticker) return null;

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
      dayRange: { low: stock.dayLow, high: stock.dayHigh },
      yearRange: { low: stock.yearLow, high: stock.yearHigh },
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
  const tickerPatterns = [
    /\(([A-Z]{1,5})\)/,
    /\b([A-Z]{1,5})\b/,
    /([A-Z]{1,5}) stock/i,
    /([A-Z]{1,5}) shares/i
  ];
  for (const pattern of tickerPatterns) {
    const match = title.match(pattern);
    if (match && match[1] && /^[A-Z]+$/.test(match[1])) {
      return match[1];
    }
  }
  return null;
}

// Helper function to categorize news
function categorizeNews(title, description) {
  const content = `${title || ''} ${description || ''}`.toLowerCase();
  if (content.includes('medical') || content.includes('fda') || content.includes('health') || content.includes('drug')) return 'medical';
  if (content.includes('patent') || content.includes('intellectual property') || content.includes('ip')) return 'patent';
  if (content.includes('lawsuit') || content.includes('legal') || content.includes('court') || content.includes('sue')) return 'lawsuit';
  if (content.includes('acquisition') || content.includes('merger') || content.includes('buyout') || content.includes('takeover')) return 'acquisition';
  if (content.includes('earnings') || content.includes('quarterly') || content.includes('revenue') || content.includes('profit')) return 'earnings';
  return 'general';
}
