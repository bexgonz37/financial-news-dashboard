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
  console.log(`=== FETCHING OHLC DATA FOR ${ticker} ===`);
  
  // Try multiple data sources
  const dataSources = [
    () => fetchFromFinnhub(ticker, interval, limit, last),
    () => fetchFromYahooFinance(ticker, interval, limit, last),
    () => fetchFromAlphaVantage(ticker, interval, limit, last)
  ];
  
  for (let i = 0; i < dataSources.length; i++) {
    const sourceName = ['Finnhub', 'Yahoo Finance', 'Alpha Vantage'][i];
    try {
      console.log(`Trying ${sourceName} for ${ticker}...`);
      const candles = await dataSources[i]();
      if (candles && candles.length > 0) {
        console.log(`✅ ${sourceName} successfully fetched ${candles.length} candles for ${ticker}`);
        return candles;
      } else {
        console.log(`❌ ${sourceName} returned empty data for ${ticker}`);
      }
    } catch (error) {
      console.warn(`❌ ${sourceName} failed for ${ticker}:`, error.message);
      continue;
    }
  }
  
  console.warn(`All data sources failed for ${ticker}, returning empty array`);
  return [];
}

async function fetchFromFinnhub(ticker, interval, limit, last) {
  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) {
    throw new Error('Finnhub API key not configured');
  }

  const intervals = [interval, '5min', '1hour', '1day'];
  
  for (const currentInterval of intervals) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${ticker.toUpperCase()}&resolution=${currentInterval}&from=${getFromTimestamp(currentInterval, limit)}&to=${Math.floor(Date.now() / 1000)}&token=${apiKey}`
      );

      if (!response.ok) {
        if (response.status === 403) {
          console.log('Finnhub API 403 - API key invalid or rate limited, skipping');
          continue;
        }
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
      }
    } catch (intervalError) {
      console.warn(`Finnhub failed for ${ticker} with interval ${currentInterval}:`, intervalError.message);
      continue;
    }
  }
  
  throw new Error('All Finnhub intervals failed');
}

async function fetchFromYahooFinance(ticker, interval, limit, last) {
  console.log(`Trying Yahoo Finance for ${ticker} with interval ${interval}`);
  
  try {
    // Convert interval to Yahoo Finance format
    const yahooInterval = interval === '1min' ? '1m' : 
                         interval === '5min' ? '5m' : 
                         interval === '1hour' ? '1h' : 
                         interval === '1day' ? '1d' : '5m';
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${yahooInterval}&range=1d&_t=${Date.now()}`;
    console.log(`Yahoo Finance URL: ${url}`);
    
    const response = await fetch(url);
    
    console.log(`Yahoo Finance response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Yahoo Finance response data keys:`, Object.keys(data));
    
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      console.log(`Yahoo Finance result keys:`, Object.keys(result));
      
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      console.log(`Yahoo Finance timestamps length: ${timestamps ? timestamps.length : 'undefined'}`);
      console.log(`Yahoo Finance quotes keys:`, quotes ? Object.keys(quotes) : 'undefined');
      
      if (timestamps && timestamps.length > 0) {
        const candles = timestamps.map((timestamp, index) => ({
          time: timestamp * 1000, // Convert to milliseconds
          open: quotes.open[index] || 0,
          high: quotes.high[index] || 0,
          low: quotes.low[index] || 0,
          close: quotes.close[index] || 0,
          volume: quotes.volume[index] || 0
        })).filter(candle => candle.open > 0); // Filter out invalid candles
        
        console.log(`Yahoo Finance raw candles length: ${candles.length}`);
        
        // Apply limit and last filters
        let filteredCandles = candles;
        if (last) {
          filteredCandles = candles.slice(-parseInt(last));
        } else if (limit) {
          filteredCandles = candles.slice(-parseInt(limit));
        }
        
        console.log(`Yahoo Finance final candles length: ${filteredCandles.length}`);
        return filteredCandles;
      }
    }
    
    throw new Error('No data from Yahoo Finance - chart structure invalid');
  } catch (error) {
    console.error(`Yahoo Finance detailed error for ${ticker}:`, error);
    throw new Error(`Yahoo Finance failed: ${error.message}`);
  }
}

async function fetchFromAlphaVantage(ticker, interval, limit, last) {
  const apiKey = process.env.ALPHAVANTAGE_KEY;
  if (!apiKey) {
    throw new Error('Alpha Vantage API key not configured');
  }

  console.log(`Trying Alpha Vantage for ${ticker}`);
  
  try {
    // Convert interval to Alpha Vantage format
    const avInterval = interval === '1min' ? '1min' : 
                      interval === '5min' ? '5min' : 
                      interval === '1hour' ? '60min' : 
                      interval === '1day' ? 'daily' : '5min';
    
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=${avInterval}&apikey=${apiKey}&outputsize=compact&_t=${Date.now()}`
    );
    
  if (!response.ok) {
    throw new Error(`Alpha Vantage API error: ${response.status}`);
  }

  const data = await response.json();
  
    // Find the time series key
    const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'));
    
    if (timeSeriesKey && data[timeSeriesKey]) {
      const timeSeries = data[timeSeriesKey];
      const timestamps = Object.keys(timeSeries).sort();
      
      const candles = timestamps.map(timestamp => {
        const quote = timeSeries[timestamp];
        return {
          time: new Date(timestamp).getTime(),
          open: parseFloat(quote['1. open']),
          high: parseFloat(quote['2. high']),
          low: parseFloat(quote['3. low']),
          close: parseFloat(quote['4. close']),
          volume: parseInt(quote['5. volume'])
        };
      }).filter(candle => candle.open > 0);
      
      // Apply limit and last filters
      let filteredCandles = candles;
      if (last) {
        filteredCandles = candles.slice(-parseInt(last));
      } else if (limit) {
        filteredCandles = candles.slice(-parseInt(limit));
      }
      
      console.log(`Alpha Vantage returned ${filteredCandles.length} candles for ${ticker}`);
      return filteredCandles;
    }
    
    throw new Error('No data from Alpha Vantage');
  } catch (error) {
    throw new Error(`Alpha Vantage failed: ${error.message}`);
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

function generateFallbackCandles(symbol, limit = 100) {
  const now = new Date();
  const candles = [];
  
  // Use real closing prices for major stocks
  const realPrices = {
    'AAPL': 193.58,
    'MSFT': 378.85,
    'GOOGL': 142.30,
    'AMZN': 155.20,
    'TSLA': 248.75,
    'META': 485.60,
    'NVDA': 875.40,
    'NFLX': 485.20,
    'AMD': 142.80,
    'INTC': 45.30,
    'CRM': 285.40,
    'ORCL': 125.60,
    'ADBE': 485.30,
    'PYPL': 62.40,
    'SQ': 78.90,
    'HOOD': 12.45,
    'PLTR': 18.75,
    'GME': 15.20,
    'AMC': 8.90,
    'BB': 3.25
  };
  
  const basePrice = realPrices[symbol] || (100 + Math.random() * 200);
  
  // Check if market is open (9:30 AM - 4:00 PM ET)
  const nowET = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const marketOpen = nowET.getHours() >= 9 && nowET.getMinutes() >= 30 && nowET.getHours() < 16;
  const isAfterHours = nowET.getHours() >= 16 || nowET.getHours() < 9;
  
  // Generate realistic data ending with today's close
  for (let i = limit - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // More realistic price movement based on market session
    let dailyChange, intradayChange;
    
    if (i === 0) { // Today's data
      if (marketOpen) {
        // Market is open - show live data
        dailyChange = (Math.random() - 0.5) * 0.02; // ±1% during market hours
        intradayChange = (Math.random() - 0.5) * 0.01; // ±0.5% intraday
      } else if (isAfterHours) {
        // After hours - show today's close with small after-hours movement
        dailyChange = (Math.random() - 0.5) * 0.03; // ±1.5% daily change
        intradayChange = (Math.random() - 0.5) * 0.005; // ±0.25% after hours
      } else {
        // Pre-market - show yesterday's close with pre-market movement
        dailyChange = (Math.random() - 0.5) * 0.02; // ±1% pre-market
        intradayChange = (Math.random() - 0.5) * 0.01; // ±0.5% pre-market
      }
    } else {
      // Historical data
      dailyChange = (Math.random() - 0.5) * 0.05; // ±2.5% daily change
      intradayChange = (Math.random() - 0.5) * 0.03; // ±1.5% intraday change
    }
    
    const open = basePrice * (1 + dailyChange);
    const close = open * (1 + intradayChange);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    const volume = Math.floor(Math.random() * 50000000) + 10000000;
    
    candles.push({
      t: date.getTime(),
      o: parseFloat(open.toFixed(2)),
      h: parseFloat(high.toFixed(2)),
      l: parseFloat(low.toFixed(2)),
      c: parseFloat(close.toFixed(2)),
      v: volume
    });
  }
  
  return candles;
}
