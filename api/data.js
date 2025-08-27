// Vercel serverless function: consolidated financial data
// - News: Alpha Vantage NEWS_SENTIMENT
// - Quote: Finnhub
// - Market stats (RVOL inputs): Financial Modeling Prep (FMP)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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
      category,        // optional: maps to topics for AV + used in front-end filter
      limit = 30,      // news articles to request
      search           // optional: client side filter
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
      consolidatedData.errors.push({ service: 'Alpha Vantage', error: newsData.reason?.message || String(newsData.reason) });
    }
    if (stockData.status === 'rejected') {
      consolidatedData.errors.push({ service: 'Finnhub', error: stockData.reason?.message || String(stockData.reason) });
    }
    if (marketData.status === 'rejected') {
      consolidatedData.errors.push({ service: 'Financial Modeling Prep', error: marketData.reason?.message || String(marketData.reason) });
    }

    res.status(200).json(consolidatedData);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

// ---------- Alpha Vantage NEWS_SENTIMENT ----------
async function fetchNewsData(apiKey, ticker, category, search, limit) {
  const params = new URLSearchParams({
    function: 'NEWS_SENTIMENT',
    apikey: apiKey,
    sort: 'LATEST',
    limit: String(limit)
  });

  if (ticker) params.set('tickers', ticker.toUpperCase());
  // Alpha Vantage "topics": e.g., 'financial_markets', 'technology', etc.
  if (category && category !== 'all') params.set('topics', category);

  const url = `https://www.alphavantage.co/query?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Alpha Vantage error: ${r.status} ${r.statusText}`);

  const data = await r.json();
  const feed = Array.isArray(data.feed) ? data.feed : [];

  // Optional keyword filter (client side)
  const rows = search
    ? feed.filter(a =>
        (a.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.summary || '').toLowerCase().includes(search.toLowerCase())
      )
    : feed;

  return rows.map(a => {
    const iso = normalizeAVTime(a.time_published); // "YYYYMMDDTHHMMSS" -> ISO
    const tkr = (Array.isArray(a.ticker_sentiment) && a.ticker_sentiment.length)
      ? (a.ticker_sentiment[0].ticker || extractTickerFromTitle(a.title) || 'GENERAL')
      : (extractTickerFromTitle(a.title) || 'GENERAL');

    return {
      id: a.url,
      ticker: (tkr || 'GENERAL').toUpperCase(),
      priceChange: null,
      isPositive: typeof a.overall_sentiment_score === 'number' ? a.overall_sentiment_score > 0 : null,
      sentimentScore: a.overall_sentiment_score,
      title: a.title,
      summary: a.summary || 'No summary available',
      category: categorizeNews(a.title, a.summary),
      source: a.source,
      publishedAt: iso,
      url: a.url,
      imageUrl: a.banner_image
    };
  });
}

// "20250101T134522" -> "2025-01-01T13:45:22Z"
function normalizeAVTime(s) {
  if (!s || typeof s !== 'string' || s.length < 15) return null;
  // AV times are UTC
  const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
  const H = s.slice(9, 11), M = s.slice(11, 13), S = s.slice(13, 15);
  return `${y}-${m}-${d}T${H}:${M}:${S}Z`;
}

// ---------- Finnhub Quote ----------
async function fetchStockData(apiKey, ticker) {
  if (!ticker) return null;
  const url = `https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Finnhub error: ${r.status} ${r.statusText}`);
  const d = await r.json();
  return {
    ticker: ticker.toUpperCase(),
    currentPrice: d.c,
    previousClose: d.pc,
    change: d.d,
    changePercent: d.dp,
    high: d.h,
    low: d.l,
    open: d.o,
    timestamp: d.t ? new Date(d.t * 1000).toISOString() : new Date().toISOString()
  };
}

// ---------- FMP Market Stats (for RVOL inputs, etc.) ----------
async function fetchMarketData(apiKey, ticker) {
  if (!ticker) return null;
  const url = `https://financialmodelingprep.com/api/v3/quote/${ticker.toUpperCase()}?apikey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FMP error: ${r.status} ${r.statusText}`);
  const data = await r.json();
  if (!Array.isArray(data) || !data.length) return null;
  const s = data[0];
  return {
    ticker: s.symbol,
    companyName: s.name,
    currentPrice: s.price,
    previousClose: s.previousClose,
    change: s.change,
    changePercent: s.changesPercentage,
    marketCap: s.marketCap,
    volume: s.volume,
    avgVolume: s.avgVolume,
    pe: s.pe,
    eps: s.eps,
    dayRange: { low: s.dayLow, high: s.dayHigh },
    yearRange: { low: s.yearLow, high: s.yearHigh },
    timestamp: new Date().toISOString()
  };
}

// ---------- Helpers ----------
function extractTickerFromTitle(title) {
  if (!title) return null;
  const pats = [
    /\(([A-Z]{1,5})\)/,
    /\b([A-Z]{1,5})\b/,
    /([A-Z]{1,5}) stock/i,
    /([A-Z]{1,5}) shares/i
  ];
  for (const p of pats) {
    const m = title.match(p);
    if (m && m[1] && /^[A-Z]+$/.test(m[1])) return m[1];
  }
  return null;
}

function categorizeNews(title, description = '') {
  const c = `${title || ''} ${description || ''}`.toLowerCase();

  if (/public offering|secondary|atm|shelf|registered direct|follow-?on/.test(c)) return 'offering';
  if (/guidance|outlook|raises guidance|lowers guidance|updates guidance/.test(c)) return 'guidance';
  if (/downgrade|downgraded|price target cut/.test(c)) return 'downgrade';
  if (/upgrade|upgraded|price target raised/.test(c)) return 'upgrade';
  if (/partnership|collaborat(e|ion)|alliance/.test(c)) return 'partnership';
  if (/\bproduct\b|launch|rollout|introduces/.test(c)) return 'product';
  if (/sec filing|\b8-k\b|\b10-q\b|\b10-k\b|\bs-1\b|\bs-3\b/.test(c)) return 'sec';
  if (/insider (buy|sell|purchase|sale)/.test(c)) return 'insider';

  if (/medical|fda|health|drug|trial|phase (1|2|3)/.test(c)) return 'medical';
  if (/patent|intellectual property|\bip\b/.test(c)) return 'patent';
  if (/lawsuit|legal|court|sue/.test(c)) return 'lawsuit';
  if (/acquisition|merger|buyout|takeover/.test(c)) return 'acquisition';
  if (/earnings|quarterly|revenue|profit|\beps\b/.test(c)) return 'earnings';

  return 'general';
}
