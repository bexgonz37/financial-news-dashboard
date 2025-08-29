// OHLC Data API - Enhanced with better error handling
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ticker, interval = '5min', limit = 100, last } = req.query;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    const candles = await fetchCandles(ticker, interval, limit, last);

    return res.status(200).json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        interval,
        candles,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('OHLC API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch OHLC data',
      message: error.message 
    });
  }
}

async function fetchCandles(ticker, interval, limit, last) {
  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) {
    throw new Error('Finnhub API key not configured');
  }

  try {
    // Try different intervals if the requested one fails
    const intervals = [interval, '5min', '1hour', '1day'];
    
    for (const currentInterval of intervals) {
      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${ticker.toUpperCase()}&resolution=${currentInterval}&from=${getFromTimestamp(currentInterval, limit)}&to=${Math.floor(Date.now() / 1000)}&token=${apiKey}`
        );

        if (!response.ok) {
          throw new Error(`Finnhub API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.s === 'ok' && data.c && data.c.length > 0) {
          const candles = formatCandles(data, currentInterval);
          
          // Apply limit and last filters
          let filteredCandles = candles;
          if (last) {
            filteredCandles = candles.slice(-parseInt(last));
          } else if (limit) {
            filteredCandles = candles.slice(-parseInt(limit));
          }
          
          return filteredCandles;
        } else {
          console.warn(`No data for ${ticker} with interval ${currentInterval}`);
          continue;
        }
      } catch (intervalError) {
        console.warn(`Failed to fetch ${ticker} with interval ${currentInterval}:`, intervalError);
        continue;
      }
    }
    
    // If all intervals fail, return empty array
    console.warn(`All intervals failed for ${ticker}`);
    return [];
    
  } catch (error) {
    console.error(`Error fetching candles for ${ticker}:`, error);
    return [];
  }
}

function getFromTimestamp(interval, limit) {
  const now = Math.floor(Date.now() / 1000);
  const limitNum = parseInt(limit) || 100;
  
  let secondsPerCandle;
  switch (interval) {
    case '1min': secondsPerCandle = 60; break;
    case '5min': secondsPerCandle = 300; break;
    case '15min': secondsPerCandle = 900; break;
    case '30min': secondsPerCandle = 1800; break;
    case '1hour': secondsPerCandle = 3600; break;
    case '1day': secondsPerCandle = 86400; break;
    default: secondsPerCandle = 300; // Default to 5min
  }
  
  return now - (limitNum * secondsPerCandle);
}

function formatCandles(data, interval) {
  const { t, o, h, l, c, v } = data;
  const candles = [];
  
  for (let i = 0; i < t.length; i++) {
    candles.push({
      t: t[i] * 1000, // Convert to milliseconds
      o: o[i],
      h: h[i],
      l: l[i],
      c: c[i],
      v: v[i]
    });
  }
  
  return candles;
}
