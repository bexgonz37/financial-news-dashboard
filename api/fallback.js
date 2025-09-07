// Fallback API - Yahoo Finance integration for quotes and charts
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, type = 'quote' } = req.query;
    const symbol = ticker; // Map ticker to symbol for compatibility
    
    if (!symbol) {
      return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    let result;
    
    switch (type) {
      case 'quote':
        result = await getQuote(symbol);
        break;
      case 'chart':
        result = await getChart(symbol);
        break;
      case 'search':
        result = await searchSymbol(symbol);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type parameter' });
    }

    if (!result) {
      return res.status(404).json({ error: 'No data found' });
    }

    return res.status(200).json({
      success: true,
      symbol: symbol.toUpperCase(),
      type,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fallback API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch data',
      message: error.message 
    });
  }
}

async function getQuote(symbol) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }

    const result = data.chart.result[0];
    const quote = result.quote[0];
    const meta = result.meta;

    return {
      symbol: meta.symbol,
      name: meta.shortName || meta.longName,
      currentPrice: quote.close,
      price: quote.close,
      change: quote.close - quote.open,
      changePercent: ((quote.close - quote.open) / quote.open) * 100,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      volume: quote.volume,
      averageVolume: meta.averageVolume || quote.volume,
      marketCap: meta.marketCap,
      previousClose: meta.previousClose,
      exchange: meta.exchangeName,
      currency: meta.currency
    };
  } catch (error) {
    console.warn('Yahoo Finance quote failed:', error);
    return null;
  }
}

async function getChart(symbol) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=5d`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.quote[0];

    const chartData = timestamps.map((timestamp, index) => ({
      timestamp: timestamp * 1000, // Convert to milliseconds
      open: quotes.open[index],
      high: quotes.high[index],
      low: quotes.low[index],
      close: quotes.close[index],
      volume: quotes.volume[index]
    }));

    return {
      symbol: result.meta.symbol,
      interval: '1d',
      data: chartData
    };
  } catch (error) {
    console.warn('Yahoo Finance chart failed:', error);
    return null;
  }
}

async function searchSymbol(query) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?query=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (!data.quotes) return [];

    return data.quotes.map(quote => ({
      symbol: quote.symbol,
      name: quote.shortname || quote.longname,
      exchange: quote.exchange,
      type: quote.quoteType,
      marketCap: quote.marketCap
    }));
  } catch (error) {
    console.warn('Yahoo Finance search failed:', error);
    return null;
  }
}