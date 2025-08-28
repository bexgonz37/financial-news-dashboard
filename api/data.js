// Vercel serverless function: consolidated financial data
// - News: Alpha Vantage NEWS_SENTIMENT
// - Quote: Finnhub
// - Market stats (RVOL inputs): Financial Modeling Prep (FMP)
// - Company matching: Intelligent company name to ticker matching

// Import company matching functions
import { findCompanyMatches } from './company-matcher.js';
import { findCompanyByTicker, findCompaniesByName } from './company-database.js';

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
      category,        // optional: AV "topics" (we still apply client filters on frontend)
      limit = 30,
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
  if (category && category !== 'all') params.set('topics', category);

  const url = `https://www.alphavantage.co/query?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Alpha Vantage error: ${r.status} ${r.statusText}`);

  const data = await r.json();
  const feed = Array.isArray(data.feed) ? data.feed : [];

  const rows = search
    ? feed.filter(a =>
        (a.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.summary || '').toLowerCase().includes(search.toLowerCase())
      )
    : feed;

  if (!rows.length) return [];

  // Process news items with intelligent company matching
  const processedRows = [];
  
  for (const a of rows) {
    const iso = normalizeAVTime(a.time_published);
    
    // Try to get ticker from Alpha Vantage first
    let tkr = '';
    if (Array.isArray(a.ticker_sentiment) && a.ticker_sentiment.length) {
      tkr = sanitizeTicker(a.ticker_sentiment[0].ticker || '');
    }
    
    // If no ticker from AV, use intelligent company matching
    if (!tkr) {
      try {
        // First try the comprehensive database for fast lookup
        const potentialCompanies = extractCompanyNames(`${a.title} ${a.summary || ''}`);
        for (const companyName of potentialCompanies) {
          const dbMatch = findCompaniesByName(companyName);
          if (dbMatch.length > 0) {
            tkr = dbMatch[0].ticker;
            console.log(`Database matched "${companyName}" to ${tkr} (${dbMatch[0].name})`);
            break;
          }
        }
        
        // If still no match, use dynamic company matching
        if (!tkr) {
          const companyMatches = await findCompanyMatches(`${a.title} ${a.summary || ''}`);
          if (companyMatches.length > 0 && companyMatches[0].confidence === 'high') {
            tkr = companyMatches[0].ticker;
            console.log(`Dynamic matched "${a.title}" to ${tkr} (${companyMatches[0].company})`);
          }
        }
      } catch (error) {
        console.warn('Company matching failed:', error);
      }
    }
    
    // Fallback to old method if still no ticker
    if (!tkr) {
      tkr = extractTickerFromTitle(a.title) || 'GENERAL';
    }

    processedRows.push({
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
    });
  }
  
  return processedRows;
}

function normalizeAVTime(timeStr) {
  if (!timeStr) return new Date().toISOString();
  // Alpha Vantage format: "20231201T143000"
  const year = timeStr.substring(0, 4);
  const month = timeStr.substring(4, 6);
  const day = timeStr.substring(6, 8);
  const hour = timeStr.substring(9, 11);
  const minute = timeStr.substring(11, 13);
  const second = timeStr.substring(13, 15);
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
}

function sanitizeTicker(ticker) {
  if (!ticker) return '';
  // Remove any non-alphabetic characters and convert to uppercase
  return ticker.replace(/[^A-Za-z]/g, '').toUpperCase();
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

// ---------- FMP Market Stats ----------
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
function extractCompanyNames(text) {
  const companies = new Set();
  
  // Look for capitalized company patterns
  const patterns = [
    // "Company Name Inc." pattern
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|Corp|Corporation|LLC|Ltd|Limited|Company|Co|Group|Holdings|Technologies|Systems|Solutions|Partners|Ventures|Enterprises|Industries|International|Global|America|USA|US))\b/g,
    
    // "Company Name" pattern (standalone)
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
    
    // "The Company Name" pattern
    /\bThe\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
    
    // Product-based company identification
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:announces|launches|reports|reveals|introduces|partners|acquires|merges|expands|invests)\b/gi
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const company = match[1] || match[0];
      if (isValidCompanyName(company)) {
        companies.add(company.trim());
      }
    }
  });
  
  return Array.from(companies);
}

function isValidCompanyName(name) {
  if (!name || name.length < 2) return false;
  
  // Common words that are unlikely to be company names
  const commonWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'announces', 'launches', 'reports', 'reveals', 'introduces', 'partners', 'acquires',
    'merges', 'expands', 'invests', 'said', 'will', 'has', 'had', 'have', 'been',
    'this', 'that', 'these', 'those', 'new', 'old', 'big', 'small', 'high', 'low',
    'first', 'last', 'next', 'previous', 'current', 'future', 'past', 'today',
    'yesterday', 'tomorrow', 'now', 'then', 'here', 'there', 'where', 'when',
    'what', 'why', 'how', 'who', 'which', 'whose', 'whom'
  ]);
  
  const words = name.toLowerCase().split(/\s+/);
  if (words.length === 1 && commonWords.has(words[0])) return false;
  
  // Must have at least one non-common word
  const hasValidWord = words.some(word => !commonWords.has(word) && word.length > 1);
  return hasValidWord;
}

function extractTickerFromTitle(title) {
  if (!title) return null;
  
  // First, try to find tickers in parentheses - these are usually accurate
  const paren = title.match(/\(([A-Z]{1,5})\)/);
  if (paren && paren[1]) {
    const ticker = paren[1];
    // Validate it's not a common word
    if (!isCommonWord(ticker)) return ticker;
  }
  
  // Look for ticker patterns in the text
  const tickerPattern = /\b([A-Z]{1,5})\b/g;
  const matches = [];
  let match;
  
  while ((match = tickerPattern.exec(title)) !== null) {
    const potentialTicker = match[1];
    if (!isCommonWord(potentialTicker)) {
      matches.push(potentialTicker);
    }
  }
  
  // Return the first valid ticker found
  return matches.length > 0 ? matches[0] : null;
}

function isCommonWord(word) {
  const commonWords = new Set([
    'CEO', 'USA', 'NYSE', 'SEC', 'ETF', 'IPO', 'AI', 'FDA', 'EPS', 'QEQ', 'QOQ', 'YOY', 'USD',
    'CFO', 'CTO', 'COO', 'VP', 'DIR', 'INC', 'LLC', 'CORP', 'LTD', 'CO', 'THE', 'AND', 'FOR',
    'NEW', 'TOP', 'BIG', 'LOW', 'HIGH', 'OPEN', 'CLOSE', 'VOLUME', 'PRICE', 'STOCK', 'SHARE',
    'MARKET', 'TRADING', 'INVESTMENT', 'FINANCIAL', 'BUSINESS', 'COMPANY', 'REPORT', 'QUARTER',
    'YEAR', 'MONTH', 'WEEK', 'DAY', 'TIME', 'DATE', 'HOUR', 'MINUTE', 'SECOND', 'NOW', 'TODAY',
    'YESTERDAY', 'TOMORROW', 'NEXT', 'LAST', 'FIRST', 'BEST', 'WORST', 'GOOD', 'BAD', 'UP', 'DOWN',
    'LEFT', 'RIGHT', 'CENTER', 'MIDDLE', 'START', 'END', 'BEGIN', 'FINISH', 'COMPLETE', 'DONE',
    'READY', 'SET', 'GO', 'STOP', 'PAUSE', 'PLAY', 'RECORD', 'DELETE', 'SAVE', 'LOAD', 'OPEN',
    'CLOSE', 'EXIT', 'ENTER', 'BACK', 'FORWARD', 'NEXT', 'PREVIOUS', 'CURRENT', 'FUTURE', 'PAST'
  ]);
  
  return commonWords.has(word);
}

function categorizeNews(title, description = '') {
  const c = `${title || ''} ${description || ''}`.toLowerCase();
  
  // More specific patterns first
  if (/public offering|secondary|atm|shelf|registered direct|follow-?on|stock offering|equity offering/.test(c)) return 'offering';
  if (/guidance|outlook|raises guidance|lowers guidance|updates guidance|earnings guidance|revenue guidance/.test(c)) return 'guidance';
  if (/downgrade|downgraded|price target cut|analyst downgrade|rating downgrade/.test(c)) return 'downgrade';
  if (/upgrade|upgraded|price target raised|analyst upgrade|rating upgrade/.test(c)) return 'upgrade';
  if (/partnership|collaborat(e|ion)|alliance|joint venture|strategic partnership/.test(c)) return 'partnership';
  if (/\bproduct\b|launch|rollout|introduces|new product|product announcement/.test(c)) return 'product';
  if (/sec filing|\b8-k\b|\b10-q\b|\b10-k\b|\bs-1\b|\bs-3\b|form 4|form 13f/.test(c)) return 'sec';
  if (/insider (buy|sell|purchase|sale)|insider trading|executive (buy|sell)/.test(c)) return 'insider';
  if (/medical|fda|health|drug|trial|phase (1|2|3)|clinical trial|medical device|pharmaceutical/.test(c)) return 'medical';
  if (/patent|intellectual property|\bip\b|patent filing|patent approval|patent granted/.test(c)) return 'patent';
  if (/lawsuit|legal|court|sue|litigation|legal action|legal dispute/.test(c)) return 'lawsuit';
  if (/acquisition|merger|buyout|takeover|acquisition agreement|merger agreement/.test(c)) return 'acquisition';
  if (/earnings|quarterly|revenue|profit|\beps\b|earnings report|quarterly results|financial results/.test(c)) return 'earnings';
  
  return 'general';
}
