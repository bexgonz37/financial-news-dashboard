// Fallback API - Yahoo Finance integration for quotes and charts
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, type = 'quote' } = req.query;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    let data;
    if (type === 'quote') {
      data = await getQuote(ticker);
    } else if (type === 'chart') {
      data = await getChartData(ticker);
    } else {
      return res.status(400).json({ error: 'Invalid type parameter. Use "quote" or "chart"' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Data not found' });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Fallback API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch data',
      message: error.message 
    });
  }
}

async function getQuote(ticker) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=1d`
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('No chart data available');
    }

    const result = data.chart.result[0];
    const quote = result.indicators.quote[0];
    const meta = result.meta;
    
    if (!quote || !meta) {
      throw new Error('Invalid quote data structure');
    }

    const currentPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1];
    const previousClose = meta.previousClose || quote.close[quote.close.length - 2];
    const change = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;
    
    return {
      ticker: ticker.toUpperCase(),
      currentPrice,
      previousClose,
      change,
      changePercent,
      volume: quote.volume ? quote.volume[quote.volume.length - 1] : 0,
      averageVolume: meta.averageDailyVolume3Month || 0,
      marketCap: meta.marketCap || 0,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error fetching quote for ${ticker}:`, error);
    return null;
  }
}

async function getChartData(ticker) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=5m&range=1d`
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('No chart data available');
    }

    const result = data.chart.result[0];
    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;
    
    if (!quote || !timestamps) {
      throw new Error('Invalid chart data structure');
    }

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] !== null && quote.high[i] !== null && 
          quote.low[i] !== null && quote.close[i] !== null) {
        candles.push({
          t: timestamps[i] * 1000, // Convert to milliseconds
          o: quote.open[i],
          h: quote.high[i],
          l: quote.low[i],
          c: quote.close[i],
          v: quote.volume[i] || 0
        });
      }
    }

    return {
      ticker: ticker.toUpperCase(),
      candles,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error fetching chart data for ${ticker}:`, error);
    return null;
  }
}
