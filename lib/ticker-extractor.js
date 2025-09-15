// Ticker extraction pipeline with multi-signal matching
import fetch from 'node-fetch';

// Symbol master cache
let symbolMaster = null;
let symbolMasterTime = 0;
const SYMBOL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// False positive blacklist
const BLACKLIST = new Set([
  'US', 'AI', 'TV', 'CEO', 'CFO', 'CTO', 'COO', 'VP', 'PR', 'HR', 'IT', 'UI', 'UX',
  'API', 'URL', 'PDF', 'HTML', 'CSS', 'JS', 'PHP', 'SQL', 'XML', 'JSON', 'YAML',
  'USA', 'UK', 'EU', 'UN', 'WHO', 'FDA', 'SEC', 'FTC', 'IRS', 'FBI', 'CIA',
  'COVID', 'GDP', 'CPI', 'PCE', 'FOMC', 'QE', 'ETF', 'IPO', 'SPAC', 'REIT',
  'NYSE', 'NASDAQ', 'AMEX', 'OTC', 'PINK', 'GREY', 'OTCQB', 'OTCQX'
]);

// Load symbol master from multiple sources
async function loadSymbolMaster() {
  const now = Date.now();
  if (symbolMaster && (now - symbolMasterTime) < SYMBOL_CACHE_DURATION) {
    return symbolMaster;
  }

  console.log('Loading symbol master...');
  
  try {
    // Try FMP first for comprehensive data
    if (process.env.FMP_KEY) {
      const response = await fetch(`https://financialmodelingprep.com/api/v3/stock/list?apikey=${process.env.FMP_KEY}`, { 
        cache: 'no-store' 
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const symbols = data
            .filter(stock => 
              stock.symbol && 
              stock.exchange && 
              ['NASDAQ', 'NYSE', 'AMEX'].includes(stock.exchange) &&
              stock.type === 'stock' &&
              stock.isActivelyTrading &&
              !BLACKLIST.has(stock.symbol)
            )
            .map(stock => ({
              symbol: stock.symbol,
              companyName: stock.name,
              aliases: generateAliases(stock.name, stock.symbol),
              sector: stock.sector || 'Unknown',
              sic: stock.sic || null,
              exchange: stock.exchange,
              marketCap: stock.marketCap || null
            }))
            .slice(0, 5000); // Limit for performance
          
          symbolMaster = symbols;
          symbolMasterTime = now;
          console.log(`Loaded symbol master: ${symbols.length} symbols from FMP`);
          return symbols;
        }
      }
    }

    // Fallback to Finnhub
    if (process.env.FINNHUB_KEY) {
      console.log('FMP failed, trying Finnhub for symbol master...');
      const response = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${process.env.FINNHUB_KEY}`, { 
        cache: 'no-store' 
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const symbols = data
            .filter(stock => 
              stock.symbol && 
              stock.type === 'Common Stock' &&
              stock.mic &&
              ['XNAS', 'XNYS', 'XASE'].includes(stock.mic) &&
              !BLACKLIST.has(stock.symbol)
            )
            .map(stock => ({
              symbol: stock.symbol,
              companyName: stock.description || stock.symbol,
              aliases: generateAliases(stock.description || stock.symbol, stock.symbol),
              sector: 'Unknown',
              sic: null,
              exchange: stock.mic === 'XNAS' ? 'NASDAQ' : 
                       stock.mic === 'XNYS' ? 'NYSE' : 
                       stock.mic === 'XASE' ? 'AMEX' : 'Unknown',
              marketCap: null
            }))
            .slice(0, 3000);
          
          symbolMaster = symbols;
          symbolMasterTime = now;
          console.log(`Loaded symbol master: ${symbols.length} symbols from Finnhub`);
          return symbols;
        }
      }
    }
    
    // Final fallback - curated major symbols
    console.log('Using curated symbol master');
    const curatedSymbols = [
      { symbol: 'AAPL', companyName: 'Apple Inc.', aliases: ['Apple', 'Apple Computer'], sector: 'Technology', exchange: 'NASDAQ' },
      { symbol: 'MSFT', companyName: 'Microsoft Corporation', aliases: ['Microsoft', 'MS'], sector: 'Technology', exchange: 'NASDAQ' },
      { symbol: 'GOOGL', companyName: 'Alphabet Inc.', aliases: ['Google', 'Alphabet'], sector: 'Technology', exchange: 'NASDAQ' },
      { symbol: 'AMZN', companyName: 'Amazon.com Inc.', aliases: ['Amazon', 'Amazon.com'], sector: 'Consumer Discretionary', exchange: 'NASDAQ' },
      { symbol: 'TSLA', companyName: 'Tesla Inc.', aliases: ['Tesla', 'Tesla Motors'], sector: 'Consumer Discretionary', exchange: 'NASDAQ' },
      { symbol: 'META', companyName: 'Meta Platforms Inc.', aliases: ['Facebook', 'Meta', 'FB'], sector: 'Technology', exchange: 'NASDAQ' },
      { symbol: 'NVDA', companyName: 'NVIDIA Corporation', aliases: ['NVIDIA', 'Nvidia'], sector: 'Technology', exchange: 'NASDAQ' },
      { symbol: 'JPM', companyName: 'JPMorgan Chase & Co.', aliases: ['JPMorgan', 'JP Morgan'], sector: 'Financials', exchange: 'NYSE' },
      { symbol: 'JNJ', companyName: 'Johnson & Johnson', aliases: ['Johnson & Johnson', 'J&J'], sector: 'Healthcare', exchange: 'NYSE' },
      { symbol: 'V', companyName: 'Visa Inc.', aliases: ['Visa'], sector: 'Financials', exchange: 'NYSE' },
      { symbol: 'PG', companyName: 'Procter & Gamble Co.', aliases: ['P&G', 'Procter & Gamble'], sector: 'Consumer Staples', exchange: 'NYSE' },
      { symbol: 'UNH', companyName: 'UnitedHealth Group Inc.', aliases: ['UnitedHealth', 'United Health'], sector: 'Healthcare', exchange: 'NYSE' },
      { symbol: 'HD', companyName: 'Home Depot Inc.', aliases: ['Home Depot'], sector: 'Consumer Discretionary', exchange: 'NYSE' },
      { symbol: 'MA', companyName: 'Mastercard Inc.', aliases: ['Mastercard'], sector: 'Financials', exchange: 'NYSE' },
      { symbol: 'DIS', companyName: 'Walt Disney Co.', aliases: ['Disney', 'Walt Disney'], sector: 'Consumer Discretionary', exchange: 'NYSE' },
      { symbol: 'AMD', companyName: 'Advanced Micro Devices Inc.', aliases: ['AMD', 'Advanced Micro Devices'], sector: 'Technology', exchange: 'NASDAQ' },
      { symbol: 'INTC', companyName: 'Intel Corporation', aliases: ['Intel'], sector: 'Technology', exchange: 'NASDAQ' },
      { symbol: 'NFLX', companyName: 'Netflix Inc.', aliases: ['Netflix'], sector: 'Consumer Discretionary', exchange: 'NASDAQ' },
      { symbol: 'CRM', companyName: 'Salesforce Inc.', aliases: ['Salesforce'], sector: 'Technology', exchange: 'NYSE' },
      { symbol: 'NKE', companyName: 'Nike Inc.', aliases: ['Nike'], sector: 'Consumer Discretionary', exchange: 'NYSE' },
      { symbol: 'PLTR', companyName: 'Palantir Technologies Inc.', aliases: ['Palantir'], sector: 'Technology', exchange: 'NYSE' },
      { symbol: 'SOFI', companyName: 'SoFi Technologies Inc.', aliases: ['SoFi', 'SoFi Technologies'], sector: 'Financials', exchange: 'NASDAQ' },
      { symbol: 'HOOD', companyName: 'Robinhood Markets Inc.', aliases: ['Robinhood'], sector: 'Financials', exchange: 'NASDAQ' },
      { symbol: 'RBLX', companyName: 'Roblox Corporation', aliases: ['Roblox'], sector: 'Technology', exchange: 'NYSE' },
      { symbol: 'COIN', companyName: 'Coinbase Global Inc.', aliases: ['Coinbase'], sector: 'Financials', exchange: 'NASDAQ' }
    ];
    
    symbolMaster = curatedSymbols;
    symbolMasterTime = now;
    console.log(`Using curated symbol master: ${curatedSymbols.length} symbols`);
    return curatedSymbols;
  } catch (error) {
    console.error('Failed to load symbol master:', error);
    throw new Error(`Symbol master loading failed: ${error.message}`);
  }
}

// Generate aliases for company names
function generateAliases(companyName, symbol) {
  const aliases = [];
  
  if (!companyName) return aliases;
  
  // Add the full company name
  aliases.push(companyName);
  
  // Add common variations
  const variations = [
    companyName.replace(/Inc\.?/gi, ''),
    companyName.replace(/Corp\.?/gi, ''),
    companyName.replace(/Corporation/gi, ''),
    companyName.replace(/Company/gi, ''),
    companyName.replace(/Ltd\.?/gi, ''),
    companyName.replace(/Limited/gi, ''),
    companyName.replace(/LLC/gi, ''),
    companyName.replace(/LP/gi, ''),
    companyName.replace(/&/gi, 'and'),
    companyName.replace(/and/gi, '&')
  ];
  
  // Add cleaned variations
  variations.forEach(variation => {
    const cleaned = variation.trim().replace(/\s+/g, ' ');
    if (cleaned && cleaned !== companyName && cleaned.length > 2) {
      aliases.push(cleaned);
    }
  });
  
  // Add symbol as alias
  aliases.push(symbol);
  
  return [...new Set(aliases)]; // Remove duplicates
}

// Fuzzy string matching using token set ratio
function fuzzyMatch(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  if (s1 === s2) return 1.0;
  
  // Simple token set ratio implementation
  const tokens1 = new Set(s1.split(' '));
  const tokens2 = new Set(s2.split(' '));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  if (union.size === 0) return 0;
  
  return intersection.size / union.size;
}

// Extract tickers from article content
export async function extractTickers(article) {
  try {
    const symbolMaster = await loadSymbolMaster();
    const content = `${article.title || ''} ${article.summary || ''}`.toUpperCase();
    
    const candidates = new Map();
    
    // 1. Cashtag extraction: $SYMBOL
    const cashtagRegex = /(^|[^A-Z])\$([A-Z]{1,5})(?![A-Z])/g;
    let match;
    while ((match = cashtagRegex.exec(content)) !== null) {
      const symbol = match[2];
      if (!BLACKLIST.has(symbol)) {
        const score = 0.9; // High confidence for cashtags
        candidates.set(symbol, Math.max(candidates.get(symbol) || 0, score));
      }
    }
    
    // 2. Parentheses patterns: Apple (AAPL), GameStop Corp. (NYSE:GME)
    const parenRegex = /\(([A-Z]{1,5})\)/g;
    while ((match = parenRegex.exec(content)) !== null) {
      const symbol = match[1];
      if (!BLACKLIST.has(symbol)) {
        const score = 0.8; // High confidence for parentheses
        candidates.set(symbol, Math.max(candidates.get(symbol) || 0, score));
      }
    }
    
    // 3. Company name fuzzy matching
    for (const stock of symbolMaster) {
      for (const alias of stock.aliases) {
        const fuzzyScore = fuzzyMatch(alias, content);
        if (fuzzyScore >= 0.82) {
          const score = fuzzyScore * 0.7; // Medium confidence for fuzzy match
          candidates.set(stock.symbol, Math.max(candidates.get(stock.symbol) || 0, score));
        }
      }
    }
    
    // 4. URL hints: /quote/TSLA, /symbol/NVDA, ?symbol=HOOD
    const urlHints = [
      /\/quote\/([A-Z]{1,5})/gi,
      /\/symbol\/([A-Z]{1,5})/gi,
      /[?&]symbol=([A-Z]{1,5})/gi,
      /[?&]ticker=([A-Z]{1,5})/gi
    ];
    
    for (const regex of urlHints) {
      while ((match = regex.exec(article.url || '')) !== null) {
        const symbol = match[1];
        if (!BLACKLIST.has(symbol)) {
          const score = 0.85; // High confidence for URL hints
          candidates.set(symbol, Math.max(candidates.get(symbol) || 0, score));
        }
      }
    }
    
    // 5. Source-provided symbols
    if (article.ticker && !BLACKLIST.has(article.ticker)) {
      const score = 0.95; // Very high confidence for source-provided
      candidates.set(article.ticker, Math.max(candidates.get(article.ticker) || 0, score));
    }
    
    // Filter candidates by threshold and sort by score
    const threshold = 0.55;
    const validCandidates = Array.from(candidates.entries())
      .filter(([symbol, score]) => score >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Limit to top 5
    
    const tickers = validCandidates.map(([symbol]) => symbol);
    
    // Calculate confidence (harmonic mean of scores)
    let confidence = 0;
    if (validCandidates.length > 0) {
      if (validCandidates.length === 1) {
        confidence = validCandidates[0][1];
      } else {
        const harmonicMean = validCandidates.length / 
          validCandidates.reduce((sum, [, score]) => sum + (1 / score), 0);
        confidence = harmonicMean;
      }
    }
    
    return {
      tickers,
      inferredTickersConfidence: Math.round(confidence * 100) / 100
    };
    
  } catch (error) {
    console.error('Ticker extraction error:', error);
    return {
      tickers: [],
      inferredTickersConfidence: 0
    };
  }
}

// Get symbol master for debugging
export async function getSymbolMaster() {
  return await loadSymbolMaster();
}
