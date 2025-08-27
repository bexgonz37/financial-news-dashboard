// Vercel serverless function for financial news aggregator
// Consolidates data from Alpha Vantage (news), Finnhub (quote), and FMP (fundamentals)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const alphaVantageKey = process.env.ALPHAVANTAGE_KEY;
    const finnhubKey = process.env.FINNHUB_KEY;
    const fmpKey = process.env.FMP_KEY;

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

    const {
      ticker,
      category,
      limit = 20,
      search
    } = req.query;

    const [newsData, stockData, marketData] = await Promise.allSettled([
      fetchNewsData(alphaVantageKey, ticker, category, search, limit),
      fetchStockData(finnhubKey, ticker),
      fetchMarketData(fmpKey, ticker)
    ]);

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

    if (newsData.status === 'rejected') {
      consolidatedData.errors.push({
        service: 'Alpha Vantage',
        error: newsData.reason?.message || String(newsData.reason)
      });
    }
    if (stockData.status === 'rejected') {
      consolidatedData.errors.push({
        service: 'Finnhub',
        error: stockData.reason?.message || String(stockData.reason)
      });
    }
    if (marketData.status === 'rejected') {
      consolidatedData.errors.push({
        service: 'Financial Modeling Prep',
        error: marketData.reason?.message || String(marketData.reason)
      });
    }

    res.status(200).json(consolidatedData);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Convert Alpha Vantage time_published "YYYYMMDDTHHMMSS" -> ISO "YYYY-MM-DDTHH:mm:SSZ"
function toISOFromAV(ts) {
  // e.g. "20250109T143013"
  if (!ts || ts.length < 15) return null;
  const y = ts.slice(0, 4), m = ts.slice(4, 6), d = ts.slice(6, 8);
  const hh = ts.slice(9, 11), mm = ts.slice(11, 13), ss = ts.slice(13, 15);
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
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

    const filtered = search
      ? data.feed.filter(a =>
          (a.title || '').toLowerCase().includes(search.toLowerCase()) ||
          (a.summary || '').toLowerCase().includes(search.toLowerCase()))
      : data.feed;

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
      publishedAt: toISOFromAV(article.time_published), // ✅ normalized for "time-ago"
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
    if (!response.ok) throw new Error(`Finnhub error: ${response.status} ${response.statusText}`);
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
      timestamp: data.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString()
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
    if (!response.ok) throw new Error(`FMP error: ${response.status} ${response.statusText}`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

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

// Helper: extract stock ticker from news title
function extractTickerFromTitle(title) {
  if (!title) return null;
  const tickerPatterns = [
    /\(([A-Z]{1,5})\)/,       // (AAPL)
    /\b([A-Z]{1,5})\b/,       // AAPL
    /([A-Z]{1,5}) stock/i,    // AAPL stock
    /([A-Z]{1,5}) shares/i    // AAPL shares
  ];
  for (const pattern of tickerPatterns) {
    const match = title.match(pattern);
    if (match && match[1] && /^[A-Z]+$/.test(match[1])) return match[1];
  }
  return null;
}

// Helper: categorize news (expanded a bit for traders)
function categorizeNews(title, description = '') {
  const content = `${title || ''} ${description || ''}`.toLowerCase();
  if (/public offering|secondary|atm|registered direct|follow-on/.test(content)) return 'offering';
  if (/guidance|outlook|raises guidance|lowers guidance/.test(content)) return 'guidance';
  if (/downgrade|downgraded|price target cut/.test(content)) return 'downgrade';
  if (/upgrade|upgraded|price target raised/.test(content)) return 'upgrade';
  if (/partnership|collaborat(e|ion)|alliance/.test(content)) return 'partnership';
  if (/product|launch|rollout|introduces/.test(content)) return 'product';
  if (/sec filing|8-k|10-q|10-k|s-1|s-3/.test(content)) return 'sec';
  if (/insider (buy|sell|purchase|sale)/.test(content)) return 'insider';
  if (/medical|fda|health|drug|trial|phase (1|2|3)/.test(content)) return 'medical';
  if (/patent|intellectual property|\bip\b/.test(content)) return 'patent';
  if (/lawsuit|legal|court|sue/.test(content)) return 'lawsuit';
  if (/acquisition|merger|buyout|takeover/.test(content)) return 'acquisition';
  if (/earnings|quarterly|revenue|profit|eps/.test(content)) return 'earnings';
  return 'general';
}

